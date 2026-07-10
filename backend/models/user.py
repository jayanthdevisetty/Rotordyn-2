from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional

class UserRegister(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    company: str = Field(..., min_length=1, max_length=100)
    plant: str = Field("Default Plant", min_length=1, max_length=100)
    purpose: Optional[str] = Field(None, max_length=500)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    company: str
    plant: str = "Default Plant"
    purpose: Optional[str] = None
    role: str
    status: str
    subscription_status: str = "free-tier"
    report_generation_count: int = 0
    created_at: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None

class UserStatusUpdate(BaseModel):
    status: str = Field(..., description="Must be approved, rejected, or blocked")
