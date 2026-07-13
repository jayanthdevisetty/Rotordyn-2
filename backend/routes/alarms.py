from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from routes.auth import get_current_approved_user
from database import supabase, log_audit_action

router = APIRouter(prefix="/alarms", tags=["alarms"])

class AlarmTriggerRequest(BaseModel):
    bearing_name: str = Field(..., max_length=100)
    severity: str = Field("warning", pattern="^(info|warning|critical)$")
    message: str = Field(..., max_length=500)
    value: float

class AcknowledgeRequest(BaseModel):
    alarm_id: str

@router.get("")
async def get_alarms(
    status_filter: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_approved_user)
):
    """Retrieve historical alarm logs from the database, supporting status filters and pagination."""
    try:
        query = supabase.table("alarms").select("*").order("created_at", desc=True)
        
        if status_filter:
            query = query.eq("status", status_filter)
            
        res = query.range(offset, offset + limit - 1).execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query alarms: {str(e)}"
        )

@router.post("/trigger", status_code=status.HTTP_201_CREATED)
async def trigger_alarm(
    payload: AlarmTriggerRequest,
    current_user: dict = Depends(get_current_approved_user)
):
    """Enforce industrial alarm thresholds and log new alarm status occurrences persistently."""
    try:
        alarm_entry = {
            "bearing_name": payload.bearing_name,
            "severity": payload.severity,
            "message": payload.message,
            "value": payload.value,
            "status": "active"
        }
        res = supabase.table("alarms").insert(alarm_entry).execute()
        
        # Log Audit Log Trail
        log_audit_action(
            user_id=current_user["id"],
            action="ALARM_TRIGGERED",
            details={"bearing": payload.bearing_name, "severity": payload.severity, "val": payload.value}
        )
        
        return res.data[0] if res.data else {"status": "success"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger persistent alarm: {str(e)}"
        )

@router.post("/acknowledge")
async def acknowledge_alarm(
    payload: AcknowledgeRequest,
    current_user: dict = Depends(get_current_approved_user)
):
    """Acknowledge active alarm records by ID and commit to audit logs."""
    try:
        # Check if alarm exists
        check_res = supabase.table("alarms").select("status").eq("id", payload.alarm_id).execute()
        if not check_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Alarm record not found."
            )
            
        update_data = {
            "status": "acknowledged",
            "acknowledged_by": current_user["id"],
            "acknowledged_at": datetime.utcnow().isoformat()
        }
        
        res = supabase.table("alarms").update(update_data).eq("id", payload.alarm_id).execute()
        
        # Log Audit Action Trail
        log_audit_action(
            user_id=current_user["id"],
            action="ALARM_ACKNOWLEDGED",
            details={"alarm_id": payload.alarm_id}
        )
        
        return {"status": "success", "alarm": res.data[0] if res.data else None}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to acknowledge alarm: {str(e)}"
        )
