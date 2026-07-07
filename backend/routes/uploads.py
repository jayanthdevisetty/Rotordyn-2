from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from fastapi.responses import RedirectResponse
from typing import List
from datetime import datetime
from pydantic import BaseModel
from models.upload import UploadResponse
from database import supabase
from routes.auth import get_current_approved_user
from services.email_service import send_upload_email
import os

router = APIRouter(prefix="/uploads", tags=["uploads"])

class UploadMetadataRequest(BaseModel):
    original_filename: str
    stored_filename: str
    file_url: str
    file_size: int

def serialize_upload(upload_doc) -> dict:
    """Helper to convert Supabase uploads record to standard response format."""
    # Ensure upload_time is parsed/formatted correctly
    upload_time = upload_doc.get("upload_time")
    if isinstance(upload_time, str):
        try:
            upload_time_val = datetime.fromisoformat(upload_time.replace("Z", "+00:00"))
        except Exception:
            upload_time_val = datetime.utcnow()
    elif isinstance(upload_time, datetime):
        upload_time_val = upload_time
    else:
        upload_time_val = datetime.utcnow()

    return {
        "id": str(upload_doc.get("id")),
        "user_id": str(upload_doc.get("user_id")),
        "original_filename": upload_doc.get("original_filename"),
        "stored_filename": upload_doc.get("stored_filename"),
        # Map file_url to file_path for frontend compatibility
        "file_path": upload_doc.get("file_url") or upload_doc.get("file_path", ""),
        "file_type": os.path.splitext(upload_doc.get("original_filename", ""))[1].replace(".", ""),
        "file_size": upload_doc.get("file_size"),
        "upload_time": upload_time_val,
        "analysis_status": upload_doc.get("analysis_status", "completed")
    }

@router.post("", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def log_upload_metadata(
    payload: UploadMetadataRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_approved_user)
):
    """Records the metadata of a file uploaded directly to Supabase storage and emails the URL to admin."""
    try:
        # Create metadata entry in Supabase Postgres
        upload_doc = {
            "user_id": current_user["id"],
            "company": current_user.get("company", "Default Company"),
            "plant": current_user.get("plant", "Default Plant"),
            "original_filename": payload.original_filename,
            "stored_filename": payload.stored_filename,
            "file_url": payload.file_url,
            "file_size": payload.file_size,
            "analysis_status": "completed"
        }
        
        db_res = supabase.table("uploads").insert(upload_doc).execute()
        if not db_res.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to record upload metadata in database."
            )
            
        record = db_res.data[0]
        upload_time_str = record.get("upload_time", datetime.utcnow().isoformat())
        
        # Trigger non-blocking email notification to admin with the URL
        background_tasks.add_task(
            send_upload_email,
            user_name=current_user["name"],
            user_email=current_user["email"],
            company=current_user["company"],
            timestamp=upload_time_str,
            filename=payload.original_filename,
            file_size_bytes=payload.file_size,
            file_path=payload.file_url
        )
        
        return serialize_upload(record)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process upload metadata: {str(e)}"
        )

@router.get("/history", response_model=List[UploadResponse])
async def get_upload_history(current_user: dict = Depends(get_current_approved_user)):
    """Retrieves the upload history log filtered by tenant boundaries (company & plant)."""
    try:
        if current_user["role"] == "admin":
            res = supabase.table("uploads").select("*").order("upload_time", desc=True).execute()
        else:
            company = current_user.get("company", "Default Company")
            plant = current_user.get("plant", "Default Plant")
            # Query uploads matching company and plant or the specific user
            res = supabase.table("uploads").select("*")\
                .or_(f"user_id.eq.{current_user['id']},company.eq.{company}")\
                .order("upload_time", desc=True).execute()
                
        history = []
        for doc in res.data:
            history.append(serialize_upload(doc))
        return history
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve upload history: {str(e)}"
        )

@router.get("/{upload_id}")
async def get_upload_file(
    upload_id: str,
    current_user: dict = Depends(get_current_approved_user)
):
    """Retrieves the file by redirecting to its secure Supabase Storage URL."""
    try:
        res = supabase.table("uploads").select("*").eq("id", upload_id).execute()
        if not res.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found.")
            
        upload = res.data[0]
        
        # Check ownership and tenant boundaries (Admins are authorized)
        is_owner = str(upload["user_id"]) == current_user["id"]
        is_admin = current_user["role"] == "admin"
        is_same_tenant = (
            upload.get("company") == current_user.get("company") and
            upload.get("plant") == current_user.get("plant")
        )
        if not (is_owner or is_admin or is_same_tenant):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this upload.")
            
        file_url = upload.get("file_url")
        if not file_url:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File download URL not found in record.")
            
        return RedirectResponse(url=file_url)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download upload: {str(e)}"
        )
