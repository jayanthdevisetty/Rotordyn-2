from supabase import create_client, Client
from config import settings

# Create a single supabase client instance using the service role key for backend admin operations.
supabase_url = settings.SUPABASE_URL
supabase_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY

if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY must be configured in environment variables.")

supabase: Client = create_client(supabase_url, supabase_key)

async def ping_database():
    """Verify database connection by performing a simple select query."""
    try:
        # Perform a lightweight query on the profiles table
        supabase.table("profiles").select("id").limit(1).execute()
        return True
    except Exception as e:
        print(f"Database ping failed: {e}")
        return False
