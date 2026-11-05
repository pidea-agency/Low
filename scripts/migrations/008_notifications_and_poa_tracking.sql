-- Migration: 008_notifications_and_poa_tracking.sql
-- Description: Creates notifications table with office isolation, user scoping, and index support for POA expiry tracking.

CREATE TABLE IF NOT EXISTS public.notifications (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id text NOT NULL,
  user_id text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  related_record_type text,
  related_record_id text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_office_id ON public.notifications(office_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_lookup ON public.notifications(office_id, type, related_record_type, related_record_id, created_at);

-- Row Level Security
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notifications_isolation_policy' AND tablename = 'notifications') THEN
    CREATE POLICY notifications_isolation_policy ON public.notifications
      FOR ALL USING (office_id = NULLIF(current_setting('app.current_office_id', true), '') OR auth.role() = 'service_role');
  END IF;
END $$;

