import os
import sys
import asyncio
from datetime import datetime, timezone, timedelta

# Ensure backend directory is in python search path dynamically
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from database import ping_database, supabase, log_audit_action
from routes import auth, admin, uploads, reports, scada
from services.email_service import send_pending_approvals_reminder_email

async def pending_approvals_reminder_loop():
    """Background loop that runs periodically to check and send reminders to the admin about pending registrations."""
    print("INFO: Starting background approvals reminder loop...")
    while True:
        try:
            # 1. Query the latest ADMIN_REMINDER_SENT log from database
            res = supabase.table("audit_logs").select("created_at").eq("action", "ADMIN_REMINDER_SENT").order("created_at", desc=True).limit(1).execute()
            
            should_send = False
            last_sent_dt = None
            if res.data:
                last_sent_str = res.data[0].get("created_at")
                if last_sent_str:
                    try:
                        # Clean and parse UTC iso format robustly
                        clean_str = last_sent_str.replace("Z", "+00:00").split(".")[0]
                        # Handle potential timezone offsets
                        if "+" in clean_str:
                            last_sent_dt = datetime.fromisoformat(clean_str)
                        else:
                            last_sent_dt = datetime.fromisoformat(clean_str).replace(tzinfo=timezone.utc)
                    except Exception as e:
                        print(f"Error parsing audit log timestamp '{last_sent_str}': {e}")
            
            now_dt = datetime.now(timezone.utc)
            if not last_sent_dt or (now_dt - last_sent_dt) >= timedelta(hours=48):
                should_send = True
                
            if should_send:
                # 2. Query database for pending access approvals
                pending_res = supabase.table("profiles").select("name, email, company, plant").eq("status", "pending").execute()
                if pending_res.data:
                    pending_users = pending_res.data
                    print(f"INFO: Found {len(pending_users)} pending user approvals. Sending reminder email to admin...")
                    await send_pending_approvals_reminder_email(pending_users)
                    # 3. Log reminder action so we don't send again for another 48 hours
                    log_audit_action(
                        user_id="00000000-0000-0000-0000-000000000000",
                        action="ADMIN_REMINDER_SENT",
                        details={"pending_count": len(pending_users)}
                    )
                else:
                    print("INFO: No pending access requests found. Skipping reminder.")
                    
        except Exception as e:
            print(f"ERROR: Exception in approvals reminder background task: {e}")
            
        # Poll every 4 hours
        await asyncio.sleep(4 * 3600)

app = FastAPI(
    title="Rotordyn.ai SaaS API",
    description="Backend API for Rotordyn.ai Vibration Analysis SaaS",
    version="1.0.0"
)

# CORS setup
origins = [
    "http://localhost",
    "http://localhost:8000",
    "http://localhost:5000",
    "http://localhost:3000",
    "https://cosmic-dodol-084d0a.netlify.app",
    "https://cosmic-dodol-084d0a.netlify.app/",
    "https://rotordyn-ai-v2.vercel.app",
]

# Add custom frontend URL if configured in settings
if settings.FRONTEND_URL:
    # Ensure no trailing slash for exact origin matching
    frontend_origin = settings.FRONTEND_URL.rstrip("/")
    if frontend_origin not in origins:
        origins.append(frontend_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"(https://.*\.vercel\.app|http://localhost:\d+|http://127\.0\.0\.1:\d+|http://10\.\d+\.\d+\.\d+:\d+|http://192\.168\.\d+\.\d+:\d+|http://172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:\d+)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(uploads.router)
app.include_router(reports.router)
app.include_router(scada.router)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(pending_approvals_reminder_loop())

@app.get("/health")
async def health_check():
    """Health check route that also verifies MongoDB connectivity."""
    db_alive = await ping_database()
    return {
        "status": "healthy" if db_alive else "degraded",
        "database": "connected" if db_alive else "disconnected",
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
