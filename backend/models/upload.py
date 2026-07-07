from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class UploadResponse(BaseModel):
    id: str
    user_id: str
    original_filename: str
    stored_filename: str
    file_path: str
    file_type: str
    file_size: int
    upload_time: datetime
    analysis_status: str

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
