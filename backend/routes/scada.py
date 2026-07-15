from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import math
import time
import httpx
from jose import jwt
from config import settings
from database import supabase

router = APIRouter(prefix="/scada", tags=["scada"])

@router.websocket("/stream")
async def scada_stream(websocket: WebSocket):
    """Streams live machinery telemetry data packet-by-packet via WebSocket."""
    token = websocket.query_params.get("token")
    if not token:
        # Deny connection if token parameter is missing
        await websocket.close(code=4008)
        return
        
    user_id = None
    user_status = "pending"
    
    # Verify signature locally using SUPABASE_JWT_SECRET
    if settings.SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(token, settings.SUPABASE_JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})
            user_id = payload.get("sub")
        except Exception:
            pass
            
    # Try calling Supabase endpoint as fallback if JWT secret is missing or validation fails
    if not user_id:
        try:
            url = f"{settings.SUPABASE_URL}/auth/v1/user"
            headers = {
                "Authorization": f"Bearer {token}",
                "apikey": settings.SUPABASE_ANON_KEY
            }
            async with httpx.AsyncClient() as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    user_id = res.json().get("id")
        except Exception:
            pass
            
    if not user_id:
        # Close connection with policy violation code if unauthenticated
        await websocket.close(code=4008)
        return
        
    # Check user approval status in database profiles
    try:
        db_res = supabase.table("profiles").select("status").eq("id", user_id).execute()
        if db_res.data and len(db_res.data) > 0:
            user_status = db_res.data[0].get("status", "pending")
    except Exception:
        user_status = "pending"
        
    if user_status != "approved":
        # Deny connection if user account is not approved by administrator
        await websocket.close(code=4008)
        return
        
    await websocket.accept()
    print(f"WebSocket client {user_id} connected to SCADA live stream.")
    
    count = 0
    base_time_ms = int(time.time() * 1000) - 50000
    
    try:
        while True:
            # Simulate speed profile
            if count < 50:
                # Run-up phase
                rpm = 500 + count * 35
            else:
                # Steady state + slight fluctuation
                rpm = 2250 + (count - 50) * 20
                if rpm > 3612:
                    rpm = 3612 + math.sin(count * 0.1) * 15
            
            # Amplitude resonant peak at 1800 RPM (Critical speed)
            amp_factor = math.exp(-pow(rpm - 1800, 2) / 120000)
            amp1x = 0.4 + 2.8 * amp_factor
            
            # Phase shift through resonance
            phase1x = 35 + 110 * (1 / (1 + math.exp(-(rpm - 1800) / 80)))
            
            # Formulate telemetry row
            data = {
                "_index": count,
                "_time_ms": base_time_ms + count * 1000,
                "_date": time.strftime("%H:%M:%S", time.localtime((base_time_ms + count * 1000) / 1000)),
                "Speed": rpm,
                "BRG1X_direct": amp1x + 0.3 * (count % 3) * 0.2,
                "BRG1X_amp_1x": amp1x,
                "BRG1X_phase_1x": phase1x,
                "BRG1Y_direct": amp1x + 0.4 * (count % 2) * 0.25,
                "BRG1Y_amp_1x": max(0.2, amp1x - 0.3),
                "BRG1Y_phase_1x": (phase1x + 90) % 360,
                "BRG1X_gap": -8.27 + math.sin(count * 0.05) * 0.1,
                "BRG1Y_gap": -8.12 + math.cos(count * 0.05) * 0.12
            }
            
            await websocket.send_json(data)
            count += 1
            await asyncio.sleep(0.1) # 100ms (10 Hz stream rate)
            
    except WebSocketDisconnect:
        print("WebSocket client disconnected from SCADA stream.")
    except Exception as e:
        print(f"WebSocket error in stream: {e}")
