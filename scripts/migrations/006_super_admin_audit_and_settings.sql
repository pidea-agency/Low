-- Migration: 006_super_admin_audit_and_settings.sql
-- Description: Creates audit_log and platform_settings tables for Super Admin platform governance.

-- 1. Create audit_log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  actor_id text NOT NULL,
  actor_username text,
  action text NOT NULL,
  target_office_id text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW()
);

-- Indexes for fast filtering and chronological queries
CREATE INDEX IF NOT EXISTS idx_audit_log_target_office_id ON public.audit_log(target_office_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log(action);

-- 2. Create platform_settings table
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT NOW()
);

-- Seed initial general platform configuration if not present
INSERT INTO public.platform_settings (key, value, updated_at)
VALUES (
  'general',
  '{
    "activation_link_expiry_hours": 48,
    "new_office_registration_enabled": true,
    "support_contact_email": "support@law.local",
    "support_contact_phone": "+966500000000"
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO NOTHING;

