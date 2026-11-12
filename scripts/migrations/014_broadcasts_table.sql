-- Migration: 014_broadcasts_table.sql
-- Description: Creates broadcasts table for office-wide announcements (تعميمات) with delivery summary stats.

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id text NOT NULL,
  sender_id text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  in_app_sent_count integer NOT NULL DEFAULT 0,
  whatsapp_sent_count integer NOT NULL DEFAULT 0,
  whatsapp_failed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_office_id ON public.broadcasts(office_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON public.broadcasts(created_at);

-- Row Level Security
ALTER TABLE IF EXISTS public.broadcasts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'broadcasts_isolation_policy' AND tablename = 'broadcasts') THEN
    CREATE POLICY broadcasts_isolation_policy ON public.broadcasts
      FOR ALL USING (office_id = NULLIF(current_setting('app.current_office_id', true), '') OR auth.role() = 'service_role');
  END IF;
END $$;
