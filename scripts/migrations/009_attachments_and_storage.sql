-- Migration: 009_attachments_and_storage.sql
-- Description: Creates attachments table for documents/files linked to client, poa, judgment, session, or task.

CREATE TABLE IF NOT EXISTS public.attachments (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id text NOT NULL,
  uploaded_by text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  related_record_type text NOT NULL CHECK (related_record_type IN ('client', 'poa', 'judgment', 'session', 'task')),
  related_record_id text NOT NULL,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_office_id ON public.attachments(office_id);
CREATE INDEX IF NOT EXISTS idx_attachments_record ON public.attachments(office_id, related_record_type, related_record_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON public.attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_attachments_created_at ON public.attachments(created_at);

-- Row Level Security
ALTER TABLE IF EXISTS public.attachments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'attachments_isolation_policy' AND tablename = 'attachments') THEN
    CREATE POLICY attachments_isolation_policy ON public.attachments
      FOR ALL USING (office_id = NULLIF(current_setting('app.current_office_id', true), '') OR auth.role() = 'service_role');
  END IF;
END $$;

