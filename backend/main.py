import os
import sys
# Ensure backend directory is in python search path dynamically
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from config import settings
from database import ping_database
from routes import auth, admin, uploads, reports, scada

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
