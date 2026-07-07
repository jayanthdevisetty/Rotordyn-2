import asyncio
import os
import sys

# Add the backend root to python path to resolve local imports correctly
BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

try:
    from config import settings
    from database import supabase
except ImportError:
    from backend.config import settings
    from backend.database import supabase

async def seed_admin():
    """Seeds the initial admin account directly in Supabase Auth and Profiles table."""
    print("=" * 60)
    print("  ROTORDYN.AI SUPABASE ADMIN SEEDER")
    print("=" * 60)
    print(f"  Target Admin Email: {settings.ADMIN_EMAIL}")
    print(f"  Target Admin Name : {settings.ADMIN_NAME}")
    
    # Validate environment values
    if not settings.ADMIN_EMAIL or not settings.ADMIN_PASSWORD:
        print("ERROR: ADMIN_EMAIL or ADMIN_PASSWORD settings are empty. Seed aborted.")
        return
        
    try:
        # Check if admin profile already exists
        res = supabase.table("profiles").select("*").eq("email", settings.ADMIN_EMAIL).execute()
        if res.data:
            print(f"INFO: Admin profile with email {settings.ADMIN_EMAIL} already exists in database. Seeding skipped.")
            return
            
        # 1. Create admin user in Supabase Auth via Admin API (bypassing confirmation)
        print("Creating admin in Supabase Auth...")
        auth_res = supabase.auth.admin.create_user({
            "email": settings.ADMIN_EMAIL,
            "password": settings.ADMIN_PASSWORD,
            "email_confirm": True,  # Confirm email automatically
            "user_metadata": {
                "name": settings.ADMIN_NAME,
                "company": "Rotordyn System",
                "plant": "Default Plant",
                "role": "admin",
                "status": "approved"
            }
        })
        
        if not auth_res or not getattr(auth_res, "user", None):
            print("ERROR: Failed to create admin user in Supabase Auth (response was invalid).")
            return
            
        admin_user_id = auth_res.user.id
        print(f"Auth user created successfully with ID: {admin_user_id}")
            
        # 2. Create entry in profiles table
        print("Creating profile record in public.profiles table...")
        profile_data = {
            "id": admin_user_id,
            "name": settings.ADMIN_NAME,
            "email": settings.ADMIN_EMAIL,
            "company": "Rotordyn System",
            "plant": "Default Plant",
            "purpose": "Administration",
            "role": "admin",
            "status": "approved"
        }
        
        db_res = supabase.table("profiles").insert(profile_data).execute()
        if db_res.data:
            print(f"SUCCESS: Created admin account for '{settings.ADMIN_NAME}' ({settings.ADMIN_EMAIL}) successfully.")
        else:
            print("ERROR: Failed to insert admin profile in the profiles table.")
    except Exception as e:
        print(f"ERROR: Failed to seed admin user: {e}")

if __name__ == "__main__":
    asyncio.run(seed_admin())
