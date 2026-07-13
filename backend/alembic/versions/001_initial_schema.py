"""initial schema migrations

Revision ID: 001
Revises: None
Create Date: 2026-07-13 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # 1. Create audit_logs table
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            action VARCHAR(255) NOT NULL,
            details JSONB DEFAULT '{}'::jsonb,
            ip_address VARCHAR(45),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );
    """)
    
    # 2. Add columns to profiles table safely
    op.execute("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS report_generation_count INTEGER DEFAULT 0;")
    op.execute("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'Viewer';")
    
    # 3. Create indices
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON public.uploads(user_id);")

    # 4. Create alarms table and indexes
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.alarms (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            bearing_name VARCHAR(100) NOT NULL,
            severity VARCHAR(50) DEFAULT 'warning',
            message TEXT NOT NULL,
            value DOUBLE PRECISION NOT NULL,
            status VARCHAR(50) DEFAULT 'active',
            acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            acknowledged_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_alarms_bearing_name ON public.alarms(bearing_name);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_alarms_status ON public.alarms(status);")

def downgrade():
    # Revert alarms table and indexes
    op.execute("DROP INDEX IF EXISTS idx_alarms_status;")
    op.execute("DROP INDEX IF EXISTS idx_alarms_bearing_name;")
    op.execute("DROP TABLE IF EXISTS public.alarms;")

    # Revert indices
    op.execute("DROP INDEX IF EXISTS idx_uploads_user_id;")
    op.execute("DROP INDEX IF EXISTS idx_profiles_role;")
    op.execute("DROP INDEX IF EXISTS idx_audit_logs_action;")
    op.execute("DROP INDEX IF EXISTS idx_audit_logs_user_id;")
    
    # Revert profile columns
    op.execute("ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;")
    op.execute("ALTER TABLE public.profiles DROP COLUMN IF EXISTS report_generation_count;")
    
    # Revert audit logs table
    op.execute("DROP TABLE IF EXISTS public.audit_logs;")
