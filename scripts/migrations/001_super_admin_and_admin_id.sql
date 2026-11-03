-- Migration: 001_super_admin_and_admin_id.sql
-- Description: Adds super_admin role and admin_id column to public.app_users for 3-tier hierarchy

-- 1. Add admin_id column for staff members linking them to their office admin
ALTER TABLE IF EXISTS public.app_users 
  ADD COLUMN IF NOT EXISTS admin_id text REFERENCES public.app_users(id) ON DELETE SET NULL;

-- 2. Add office_name column for admin accounts
ALTER TABLE IF EXISTS public.app_users 
  ADD COLUMN IF NOT EXISTS office_name text;

-- 3. Modify role constraint to allow 'super_admin'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'app_users_role_check'
  ) THEN
    ALTER TABLE public.app_users DROP CONSTRAINT app_users_role_check;
  END IF;
  
  ALTER TABLE public.app_users 
    ADD CONSTRAINT app_users_role_check 
    CHECK (role IN ('super_admin', 'admin', 'staff'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 4. Migrate existing platform admins to super_admin (non-destructive)
UPDATE public.app_users
SET role = 'super_admin'
WHERE role = 'admin';

-- 5. Create index on admin_id for fast office queries
CREATE INDEX IF NOT EXISTS idx_app_users_admin_id ON public.app_users(admin_id);

