import os
from dotenv import load_dotenv

load_dotenv()

def run_migrations():
    db_url = os.getenv("SUPABASE_DB_URL")
    if not db_url:
        print("\n" + "="*80)
        print("DATABASE SCHEMA SYNC INSTRUCTIONS")
        print("="*80)
        print("To apply backend schema changes, copy the SQL content from 'backend/schema.sql'")
        print("and run it inside the SQL Editor on your Supabase Dashboard:")
        print("👉 https://supabase.com/dashboard/project/wqgsqyvtugcnwahblpnn/sql/new")
        print("\nAlternatively, set the 'SUPABASE_DB_URL' environment variable in your backend .env")
        print("and run this script again to automate database migration.")
        print("="*80 + "\n")
        return

    try:
        import psycopg2
        print(f"Connecting to database using connection string: {db_url[:25]}...")
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
        with open(schema_path, "r") as f:
            sql = f.read()
            
        print("Executing migration SQL...")
        cur.execute(sql)
        conn.commit()
        print("Migrations applied successfully!")
        
        cur.close()
        conn.close()
    except ImportError:
        print("psycopg2-binary is not installed. To execute automatically run: pip install psycopg2-binary")
    except Exception as e:
        print(f"Failed to execute automated migrations: {e}")

if __name__ == "__main__":
    run_migrations()
