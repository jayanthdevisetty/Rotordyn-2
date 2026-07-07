import os
from dotenv import load_dotenv

# Load .env file if it exists
load_dotenv()

class Settings:
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    DB_NAME: str = os.getenv("DB_NAME", "rotordyn")
    
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")
    
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "supersecretkeychangeinproduction")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))
    
    GMAIL_USERNAME: str = os.getenv("GMAIL_USERNAME", "")
    GMAIL_APP_PASSWORD: str = os.getenv("GMAIL_APP_PASSWORD", "")
    ADMIN_UPLOAD_EMAIL: str = os.getenv("ADMIN_UPLOAD_EMAIL", "djay8im@gmail.com")
    
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5000")
    BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:8000")
    
    ADMIN_NAME: str = os.getenv("ADMIN_NAME", "Admin")
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@rotordyn.ai")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "AdminPassword123")
    
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

settings = Settings()
