-- Migration: 013_platform_settings_and_integrations.sql
-- Description: Creates platform_settings table if missing, ensuring WhatsApp and platform integration settings are safely persisted in Supabase with AES-256-GCM encryption at rest.

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT NOW()
);

-- Index for key lookups
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON public.platform_settings(key);
