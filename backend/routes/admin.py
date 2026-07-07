from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from models.user import UserResponse
from database import supabase
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

async def update_user_status(user_id: str, new_status: str) -> dict:
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
    return await update_user_status(user_id, "approved")

@router.patch("/users/{user_id}/reject", response_model=UserResponse)
async def reject_user(user_id: str, admin: dict = Depends(get_current_admin)):
    """Rejects a user's registration request."""
    return await update_user_status(user_id, "rejected")

@router.patch("/users/{user_id}/block", response_model=UserResponse)
async def block_user(user_id: str, admin: dict = Depends(get_current_admin)):
    """Blocks an approved user from accessing the system."""
    return await update_user_status(user_id, "blocked")

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
        
        return {"detail": "Upload record and file deleted successfully."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete upload: {str(e)}"
        )
