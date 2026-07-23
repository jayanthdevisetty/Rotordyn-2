-- Rotordyn.ai Database Migrations
-- Target: Supabase Postgres (Public Schema)
-- Execute this script in the Supabase SQL Editor to synchronize your schema state.

-- 0. Create alembic_version table and seed initial version status
CREATE TABLE IF NOT EXISTS public.alembic_version (
    version_num VARCHAR(32) PRIMARY KEY
);
INSERT INTO public.alembic_version (version_num) VALUES ('001') ON CONFLICT DO NOTHING;

-- 1. Create audit_logs Table for enterprise logging & compliance
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row-Level Security for audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only Admins can view all audit logs
CREATE POLICY "Admins can view audit logs" 
ON public.audit_logs FOR SELECT 
TO authenticated 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Authenticated users can insert their own audit logs
CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);


-- 2. Add report_generation_count Column to profiles if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS report_generation_count INTEGER DEFAULT 0;

-- 3. Add enterprise role column to profiles if missing (Owner, Admin, Manager, Engineer, Viewer, Billing, Support)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'Viewer';

-- 4. Create Performance & Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON public.uploads(user_id);

-- 5. Foreign Key & Constraints check on uploads table
-- Ensure uploads has a foreign key to auth.users with cascade delete rules if needed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_uploads_user'
    ) THEN
        ALTER TABLE public.uploads 
        ADD CONSTRAINT fk_uploads_user 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 6. Create alarms table for industrial telemetry alarms log
CREATE TABLE IF NOT EXISTS public.alarms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bearing_name VARCHAR(100) NOT NULL,
    severity VARCHAR(50) DEFAULT 'warning', -- info, warning, critical
    message TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- active, acknowledged, resolved
    acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for alarms
ALTER TABLE public.alarms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select alarms"
ON public.alarms FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert alarms"
ON public.alarms FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update/acknowledge alarms"
ON public.alarms FOR UPDATE
TO authenticated
USING (true);

-- Create Alarms Indexes
CREATE INDEX IF NOT EXISTS idx_alarms_bearing_name ON public.alarms(bearing_name);
CREATE INDEX IF NOT EXISTS idx_alarms_status ON public.alarms(status);

-- 7. Enable RLS and define policies for profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- 8. Enable RLS and define policies for uploads table
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view uploads of same company"
ON public.uploads FOR SELECT
TO authenticated
USING (
  company = (SELECT company FROM public.profiles WHERE id = auth.uid())
  OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Users can insert their own uploads"
ON public.uploads FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can delete uploads"
ON public.uploads FOR DELETE
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

