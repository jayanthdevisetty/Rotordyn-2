from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from models.user import UserResponse
from database import supabase, log_audit_action
from routes.auth import get_current_admin, serialize_user

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/users", response_model=List[UserResponse])
async def list_users(admin: dict = Depends(get_current_admin)):
    """Lists all registered users (Admin only)."""
    try:
        res = supabase.table("profiles").select("*").execute()
        users = []
        for user_doc in res.data:
            users.append(serialize_user(user_doc))
        return users
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch users: {str(e)}"
        )

async def update_user_status(user_id: str, new_status: str, admin_id: str) -> dict:
    """Helper to update a user's status by ID in both database and Supabase Auth metadata."""
    try:
        # 1. Update in profiles table
        db_res = supabase.table("profiles").update({"status": new_status}).eq("id", user_id).execute()
        if not db_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found."
            )
            
        # 2. Update status in Supabase Auth user_metadata using Admin API
        try:
            supabase.auth.admin.update_user_by_id(
                user_id,
                {"user_metadata": {"status": new_status}}
            )
        except Exception as e:
            # log the error but don't fail, as database is updated
            print(f"WARNING: Failed to update Supabase Auth user metadata: {e}")
            
        # Log update action in audit trail
        log_audit_action(admin_id, f"ADMIN_UPDATE_USER_STATUS", {"target_user_id": user_id, "new_status": new_status})
            
        return serialize_user(db_res.data[0])
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user status: {str(e)}"
        )

@router.patch("/users/{user_id}/approve", response_model=UserResponse)
async def approve_user(user_id: str, admin: dict = Depends(get_current_admin)):
    """Approves a user's registration request, granting them system access."""
    return await update_user_status(user_id, "approved", admin["id"])

@router.patch("/users/{user_id}/reject", response_model=UserResponse)
async def reject_user(user_id: str, admin: dict = Depends(get_current_admin)):
    """Rejects a user's registration request."""
    return await update_user_status(user_id, "rejected", admin["id"])

@router.patch("/users/{user_id}/block", response_model=UserResponse)
async def block_user(user_id: str, admin: dict = Depends(get_current_admin)):
    """Blocks an approved user from accessing the system."""
    return await update_user_status(user_id, "blocked", admin["id"])

@router.get("/uploads")
async def list_all_uploads(admin: dict = Depends(get_current_admin)):
    """Lists all uploaded datasets in the system with uploader profile details (Admin only)."""
    try:
        res = supabase.table("uploads").select("*, profile:profiles(name, email, company)").order("upload_time", desc=True).execute()
        uploads = []
        for doc in res.data:
            profile = doc.get("profile") or {}
            # Ensure upload_time is returned as a string format matching standard
            upload_time = doc.get("upload_time")
            uploads.append({
                "id": str(doc["id"]),
                "original_filename": doc["original_filename"],
                "file_size": doc["file_size"],
                "upload_time": upload_time,
                "file_type": doc.get("file_type", "csv"),
                "uploader": {
                    "name": profile.get("name", "Unknown"),
                    "email": profile.get("email", "Unknown"),
                    "company": profile.get("company", "Unknown")
                }
            })
        return uploads
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch uploads: {str(e)}"
        )

@router.delete("/uploads/{upload_id}")
async def delete_upload(upload_id: str, admin: dict = Depends(get_current_admin)):
    """Deletes an uploaded dataset record from the database and deletes the file from Supabase Storage (Admin only)."""
    try:
        # 1. Fetch metadata to get stored_filename
        upload_res = supabase.table("uploads").select("stored_filename").eq("id", upload_id).execute()
        if not upload_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Upload record not found."
            )
            
        stored_filename = upload_res.data[0]["stored_filename"]
        
        # 2. Delete file from Supabase Storage
        try:
            supabase.storage.from_("vibration-datasets").remove([stored_filename])
        except Exception as e:
            print(f"WARNING: Failed to delete file {stored_filename} from Supabase Storage: {e}")
            
        # 3. Delete record from database
        supabase.table("uploads").delete().eq("id", upload_id).execute()
        
        # Log deletion action in audit trail
        log_audit_action(admin["id"], "ADMIN_DELETE_UPLOAD", {"upload_id": upload_id, "stored_filename": stored_filename})
        
        return {"detail": "Upload record and file deleted successfully."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete upload: {str(e)}"
        )

@router.get("/audit-logs")
async def list_audit_logs(admin: dict = Depends(get_current_admin)):
    """Lists all audit logs in the system with user profile details (Admin only)."""
    try:
        # Perform a join query to load profile info along with audit log records
        res = supabase.table("audit_logs")\
            .select("*, profile:profiles(name, email, company)")\
            .order("created_at", desc=True)\
            .execute()
            
        logs = []
        for doc in res.data:
            profile = doc.get("profile") or {}
            logs.append({
                "id": str(doc["id"]),
                "action": doc["action"],
                "details": doc.get("details", {}),
                "ip_address": doc.get("ip_address"),
                "created_at": doc["created_at"],
                "user": {
                    "name": profile.get("name", "Unknown"),
                    "email": profile.get("email", "Unknown"),
                    "company": profile.get("company", "Unknown")
                }
            })
        return logs
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch audit logs: {str(e)}"
        )

async def update_user_subscription(user_id: str, new_status: str, admin_id: str) -> dict:
    """Helper to update a user's subscription_status in profiles and Supabase Auth metadata."""
    try:
        # 1. Update in profiles table
        db_res = supabase.table("profiles").update({"subscription_status": new_status}).eq("id", user_id).execute()
        if not db_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found."
            )
            
        # 2. Update in Supabase Auth user_metadata using Admin API
        try:
            supabase.auth.admin.update_user_by_id(
                user_id,
                {"user_metadata": {"subscription_status": new_status}}
            )
        except Exception as e:
            print(f"WARNING: Failed to update Supabase Auth user subscription metadata: {e}")
            
        # Log action in audit trail
        log_audit_action(admin_id, "ADMIN_UPDATE_SUBSCRIPTION", {"target_user_id": user_id, "subscription_status": new_status})
            
        return serialize_user(db_res.data[0])
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user subscription: {str(e)}"
        )

@router.patch("/users/{user_id}/grant_subscription", response_model=UserResponse)
async def grant_subscription(user_id: str, admin: dict = Depends(get_current_admin)):
    """Manually grants premium subscription status to a user (Admin only)."""
    return await update_user_subscription(user_id, "premium", admin["id"])

@router.patch("/users/{user_id}/revoke_subscription", response_model=UserResponse)
async def revoke_subscription(user_id: str, admin: dict = Depends(get_current_admin)):
    """Manually revokes a user's premium subscription (sets back to 'free') (Admin only)."""
    return await update_user_subscription(user_id, "free", admin["id"])
