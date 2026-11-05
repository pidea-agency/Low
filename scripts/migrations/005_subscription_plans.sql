-- Migration: 005_subscription_plans.sql
-- Description: Introduces subscription_plans table, links offices to plans, and adds ai_quota_limit_override.

-- 1. Create subscription_plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  ai_quota_limit integer NOT NULL DEFAULT 100,
  price text DEFAULT '',
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- 2. Seed initial default plans
INSERT INTO public.subscription_plans (id, name, slug, ai_quota_limit, price, features)
VALUES 
  (
    'plan-basic',
    'الأساسية',
    'basic',
    50,
    '99 ر.س / شهرياً',
    '{"google_sheets_export": true, "whatsapp_reminders": false, "max_members": 3, "custom_branding": false, "ai_assistant": true, "court_session_analytics": false}'::jsonb
  ),
  (
    'plan-plus',
    'بلس (Plus)',
    'plus',
    150,
    '249 ر.س / شهرياً',
    '{"google_sheets_export": true, "whatsapp_reminders": true, "max_members": 10, "custom_branding": false, "ai_assistant": true, "court_session_analytics": true}'::jsonb
  ),
  (
    'plan-pro',
    'برو الاحترافية (Pro)',
    'pro',
    500,
    '499 ر.س / شهرياً',
    '{"google_sheets_export": true, "whatsapp_reminders": true, "max_members": 30, "custom_branding": true, "ai_assistant": true, "court_session_analytics": true}'::jsonb
  )
ON CONFLICT (slug) DO UPDATE 
SET 
  name = EXCLUDED.name,
  ai_quota_limit = EXCLUDED.ai_quota_limit,
  price = EXCLUDED.price,
  features = EXCLUDED.features,
  updated_at = NOW();

-- 3. Extend app_users with plan_id and ai_quota_limit_override
ALTER TABLE IF EXISTS public.app_users
  ADD COLUMN IF NOT EXISTS plan_id text,
  ADD COLUMN IF NOT EXISTS ai_quota_limit_override integer DEFAULT NULL;

-- 4. Add index for plan_id
CREATE INDEX IF NOT EXISTS idx_app_users_plan_id ON public.app_users(plan_id);

-- 5. Migrate existing office admins to link with the corresponding plan
UPDATE public.app_users
SET plan_id = (
  CASE 
    WHEN plan_tier = 'pro' THEN 'plan-pro'
    WHEN plan_tier = 'basic' THEN 'plan-basic'
    ELSE 'plan-plus'
  END
)
WHERE role = 'admin' AND (plan_id IS NULL OR plan_id = '');

-- 6. Add foreign key constraint if supported
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_app_users_plan_id' AND table_name = 'app_users'
  ) THEN
    ALTER TABLE public.app_users
      ADD CONSTRAINT fk_app_users_plan_id
      FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

