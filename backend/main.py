import os
import sys
import asyncio
from datetime import datetime, timezone, timedelta

# Ensure backend directory is in python search path dynamically
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from database import ping_database, supabase, log_audit_action, verify_schema_version
from utils.metrics import metrics_collector
from routes import auth, admin, uploads, reports, scada, chat, alarms
from services.email_service import send_pending_approvals_reminder_email
from middleware import SecurityAndLoggingMiddleware

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

# Initialize Sentry SDK dynamically if SENTRY_DSN is configured
sentry_dsn = os.getenv("SENTRY_DSN")
if sentry_dsn:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        sentry_sdk.init(
            dsn=sentry_dsn,
            integrations=[FastApiIntegration()],
            traces_sample_rate=1.0,
            send_default_pii=False,
        )
        print("INFO: Sentry monitoring enabled successfully.")
    except Exception as sentry_err:
        print(f"WARNING: Could not initialize Sentry SDK: {sentry_err}")

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

app.add_middleware(SecurityAndLoggingMiddleware)

# Enforce strict origin matching in production; enable development subnets regex only in dev/test ENV
is_prod = os.getenv("ENV") == "production"
allow_regex = None if is_prod else r"(https://.*\.vercel\.app|http://localhost:\d+|http://127\.0\.0\.1:\d+|http://10\.\d+\.\d+\.\d+:\d+|http://192\.168\.\d+\.\d+:\d+|http://172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:\d+)"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=allow_regex,
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
app.include_router(chat.router)
app.include_router(alarms.router)

@app.on_event("startup")
async def startup_event():
    # Only verify migrations status if not bypassed in settings/testing
    if os.getenv("BYPASS_SCHEMA_VERIFICATION") != "true":
        verify_schema_version()
    asyncio.create_task(pending_approvals_reminder_loop())

@app.get("/health")
async def health_check():
    """Health check route that also verifies database connectivity."""
    db_alive = await ping_database()
    return {
        "status": "healthy" if db_alive else "degraded",
        "database": "connected" if db_alive else "disconnected",
        "timestamp": datetime.utcnow().isoformat(),
        "sentry_enabled": bool(os.getenv("SENTRY_DSN"))
    }

@app.get("/health/liveness")
async def liveness_check():
    """K8s Liveness check verifying if application is running."""
    return {"status": "ok"}

@app.get("/health/readiness")
async def readiness_check(response: Response):
    """K8s Readiness check verifying active database downstream dependencies."""
    db_alive = await ping_database()
    if not db_alive:
        response.status_code = 503
        return {"status": "unready", "detail": "PostgreSQL database connection is offline"}
    return {"status": "ready"}

@app.get("/metrics")
async def get_metrics():
    """Prometheus-compatible monitoring metrics endpoint."""
    metrics_data = metrics_collector.get_prometheus_metrics()
    return Response(content=metrics_data, media_type="text/plain; version=0.0.4")

@app.get("/sentry-debug")
async def trigger_error():
    """Trigger a division-by-zero exception to verify Sentry event capture reporting."""
    division_by_zero = 1 / 0

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
