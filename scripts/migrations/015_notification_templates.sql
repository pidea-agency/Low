-- Migration: 015_notification_templates.sql
-- Description: Creates notification_templates table with office isolation, customizable channels (in_app, whatsapp), and placeholders.

CREATE TABLE IF NOT EXISTS public.notification_templates (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id text NOT NULL,
  event_type text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  title_template text NOT NULL,
  body_template text NOT NULL,
  channels jsonb NOT NULL DEFAULT '{"in_app": true, "whatsapp": false}'::jsonb,
  default_recipient_role text NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  CONSTRAINT uq_office_event_type UNIQUE (office_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_office_id ON public.notification_templates(office_id);
CREATE INDEX IF NOT EXISTS idx_notification_templates_event_type ON public.notification_templates(event_type);

-- Row Level Security
ALTER TABLE IF EXISTS public.notification_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notification_templates_isolation' AND tablename = 'notification_templates') THEN
    CREATE POLICY notification_templates_isolation ON public.notification_templates
      FOR ALL USING (office_id = NULLIF(current_setting('app.current_office_id', true), '') OR auth.role() = 'service_role');
  END IF;
END $$;
