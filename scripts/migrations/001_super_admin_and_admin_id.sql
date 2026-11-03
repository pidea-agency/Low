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

-- 6. Insert default office admin (admin1 / admin123) if not exists
INSERT INTO public.app_users (
  id,
  username,
  email,
  role,
  display_name,
  office_name,
  status,
  subscription_end_date,
  subscription_notes,
  plan_tier,
  billing_cycle,
  ai_quota_limit,
  ai_usage_count,
  password_hash
)
SELECT
  'local-office-admin',
  'admin1',
  'office.admin@law.local',
  'admin',
  'مدير المكتب (أدمن)',
  'مكتب المحاماة الرئيسي',
  'active',
  NOW() + INTERVAL '1 year',
  'اشتراك سنوي معتمد للمكتب',
  'plus',
  'annual',
  100,
  0,
  '$2a$10$Qa1SqzAyvyxscLxNbhY1p.0DQRjNZYXGtLY/vGKtQ0BAzPjO5y/dS'
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_users WHERE username = 'admin1'
);

-- 7. Link default staff (12345) to admin1 if unlinked
UPDATE public.app_users
SET admin_id = (SELECT id FROM public.app_users WHERE username = 'admin1' LIMIT 1)
WHERE username = '12345' AND admin_id IS NULL;

