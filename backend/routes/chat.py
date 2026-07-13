from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
import httpx
from config import settings
from routes.auth import get_current_approved_user

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatMessage(BaseModel):
    role: str # "user" or "assistant"
    content: str

class ChatPayload(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []

SYSTEM_INSTRUCTION = (
    "You are RoDy, a warm, professional, and highly human-like machinery health co-pilot and AI diagnostics assistant for Rotordyn.ai. "
    "You are pair-programming and troubleshooting dynamic rotor vibration datasets with the user. "
    "Engage in natural, friendly general conversation when the user says hi, asks how you are doing, or chats about other topics. "
    "Be helpful, clever, and natural. Speak in first person, showing enthusiasm for rotor dynamics, engineering, and helping the user. "
    "Keep your responses relatively concise (usually 1-3 short paragraphs) to fit comfortably in a chat widget, but always maintain a warm, human, and encouraging tone. "
    "You also have voice synthesis enabled, so speak in a way that sounds natural when read aloud (avoid writing excessively long lists of numbers or complex symbols unless asked)."
)

@router.post("")
async def query_rody(payload: ChatPayload, current_user: dict = Depends(get_current_approved_user)):
    """Secured chat endpoint that queries Gemini AI with co-pilot personality system prompt."""
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gemini API Key is not configured on the backend server."
        )

    # 1. Format contents with history
    contents = []
    if payload.history:
        for msg in payload.history:
            contents.append({
                "role": "user" if msg.role == "user" else "model",
                "parts": [{"text": msg.content}]
            })
            
    # Append current user query
    contents.append({
        "role": "user",
        "parts": [{"text": payload.message}]
    })

    # 2. Build Gemini API Payload
    gemini_payload = {
        "systemInstruction": {
            "parts": [
                {"text": SYSTEM_INSTRUCTION}
            ]
        },
        "contents": contents
    }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
    headers = {"Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(url, headers=headers, json=gemini_payload)
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Gemini API returned status code {response.status_code}: {response.text}"
                )
            
            data = response.json()
            candidates = data.get("candidates", [])
            if not candidates:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Gemini API returned an empty completion response."
                )
            
            reply_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            return {"reply": reply_text}
            
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Request to Gemini API server timed out: {exc}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating chat reply: {str(e)}"
        )
