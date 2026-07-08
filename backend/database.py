from supabase import create_client, Client
from config import settings

# Create a single supabase client instance using the service role key for backend admin operations.
supabase_url = settings.SUPABASE_URL
supabase_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY

if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY must be configured in environment variables.")

supabase: Client = create_client(supabase_url, supabase_key)

# Ensure the private storage bucket 'vibration-datasets' exists in Supabase
try:
    supabase.storage.create_bucket("vibration-datasets", options={"public": False})
    print("Supabase Storage: Checked/Created private bucket 'vibration-datasets' successfully.")
except Exception as e:
    # Safely ignore if the bucket already exists
    pass

async def ping_database():
    """Verify database connection by performing a simple select query."""
    try:
        # Perform a lightweight query on the profiles table
        supabase.table("profiles").select("id").limit(1).execute()
        return True
    except Exception as e:
        print(f"Database ping failed: {e}")
        return False

def log_audit_action(user_id: str, action: str, details: dict = None, ip_address: str = None):
    """Log user operations to public.audit_logs for security and compliance audits."""
    try:
        log_entry = {
            "user_id": user_id,
            "action": action,
            "details": details or {},
            "ip_address": ip_address
        }
        supabase.table("audit_logs").insert(log_entry).execute()
    except Exception as e:
        print(f"Failed to write audit log to database: {e}")
