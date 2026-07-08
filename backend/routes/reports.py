import json
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional
from routes.auth import get_current_approved_user
from config import settings
from database import log_audit_action

router = APIRouter(prefix="/reports", tags=["reports"])

class ReportRequest(BaseModel):
    bearing_name: str
    primary_diagnosis: str
    confidence_score: int
    recommendations: str
    critical_speeds: Dict[str, Any]
    telemetry_summary: Dict[str, Any]

@router.post("/generate")
async def generate_report(
    payload: ReportRequest,
    current_user: dict = Depends(get_current_approved_user)
):
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gemini API Key is not configured on the backend server."
        )

    # Build prompt
    prompt = f"""
    You are an expert rotating machinery engineer and senior vibration analyst.
    Please generate a professional turbomachinery engineering maintenance report based on the following diagnostic metadata:

    - Probe Location: {payload.bearing_name}
    - Primary Diagnosed Issue: {payload.primary_diagnosis}
    - Diagnostic Confidence Score: {payload.confidence_score}%
    - Standard Heuristic Recommendations: {payload.recommendations}
    
    Identified Critical Speeds (Resonance):
    {payload.critical_speeds}

    Telemetry and Operation Bounds:
    {payload.telemetry_summary}

    Please write a comprehensive, highly technical machinery health report. The report must contain the following structured sections:
    1. EXECUTIVE SUMMARY
       - Brief status overview, critical alerts, and core diagnostic conclusion.
    2. SHAFTPATH & ORBIT VIBRATION ANALYSIS
       - Detailed interpretation of the proximity probe orbits, centerline behavior, and dynamic clearance headroom.
    3. DETECTED FAULT MECHANISMS
       - Physical engineering explanation of the diagnosed issues (e.g. unbalance, misalignment, rub, oil whirl) and their root causes.
    4. MAINTENANCE ACTION PLAN & CORRECTIVE RECOMMENDATIONS
       - Specific actionable steps (e.g. dynamic balancing, realignment, check bearing clearances, rotor shaft runout tests).
    5. RECOMMENDED MONITORING & OPERATION SCHEDULE
       - Immediate, short-term, and long-term operating intervals and alarm parameters.

    Format the report entirely in clean, readable Markdown. Do not include raw HTML code. Be thorough, technical, and professional in your writing.
    """

    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:streamGenerateContent?key={settings.GEMINI_API_KEY}"
    
    headers = {
        "Content-Type": "application/json"
    }
    
    data = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt
                    }
                ]
            }
        ]
    }
    
    log_audit_action(current_user["id"], "GENERATE_AI_REPORT", {
        "bearing_name": payload.bearing_name,
        "primary_diagnosis": payload.primary_diagnosis,
        "confidence_score": payload.confidence_score
    })
    
    async def stream_generator():
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", url, headers=headers, json=data) as response:
                    if response.status_code != 200:
                        yield f"data: {json.dumps({'error': f'Gemini API returned status {response.status_code}'})}\n\n"
                        return
                    
                    buffer = ""
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        buffer += line
                        clean_buffer = buffer.strip().lstrip(',[').rstrip(',]')
                        try:
                            chunk_data = json.loads(clean_buffer)
                            candidates = chunk_data.get("candidates", [])
                            if candidates:
                                text_val = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                                if text_val:
                                    yield f"data: {json.dumps({'text': text_val})}\n\n"
                            buffer = ""
                        except Exception:
                            # Incomplete JSON, accumulate in buffer
                            pass
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(stream_generator(), media_type="text/event-stream")
