-- Migration: 007_clients_and_lawyer_assignment.sql
-- Description: Creates clients table and adds client_id, assigned_lawyer_id, and client_role to sessions, poa, judgments, and tasks.

-- 1. Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL,
  name text NOT NULL,
  phone text NULL DEFAULT '',
  notes text NULL DEFAULT '',
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_office_id ON public.clients(office_id);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(name);

-- Enable RLS on clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'clients_isolation_policy' AND tablename = 'clients') THEN
    CREATE POLICY clients_isolation_policy ON public.clients
      FOR ALL USING (office_id = NULLIF(current_setting('app.current_office_id', true), '') OR auth.role() = 'service_role');
  END IF;
END $$;

-- 2. Add client_id, assigned_lawyer_id, and created_by to poa
ALTER TABLE IF EXISTS public.poa
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_lawyer_id text,
  ADD COLUMN IF NOT EXISTS created_by text;

CREATE INDEX IF NOT EXISTS idx_poa_client_id ON public.poa(client_id);
CREATE INDEX IF NOT EXISTS idx_poa_assigned_lawyer_id ON public.poa(assigned_lawyer_id);

-- 3. Add client_id, assigned_lawyer_id, client_role, and created_by to sessions
ALTER TABLE IF EXISTS public.sessions
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_lawyer_id text,
  ADD COLUMN IF NOT EXISTS client_role text CHECK (client_role IS NULL OR client_role IN ('plaintiff', 'defendant')),
  ADD COLUMN IF NOT EXISTS created_by text;

CREATE INDEX IF NOT EXISTS idx_sessions_client_id ON public.sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_sessions_assigned_lawyer_id ON public.sessions(assigned_lawyer_id);

-- 4. Add client_id, assigned_lawyer_id, client_role, and created_by to judgments
ALTER TABLE IF EXISTS public.judgments
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_lawyer_id text,
  ADD COLUMN IF NOT EXISTS client_role text CHECK (client_role IS NULL OR client_role IN ('plaintiff', 'defendant')),
  ADD COLUMN IF NOT EXISTS created_by text;

CREATE INDEX IF NOT EXISTS idx_judgments_client_id ON public.judgments(client_id);
CREATE INDEX IF NOT EXISTS idx_judgments_assigned_lawyer_id ON public.judgments(assigned_lawyer_id);

-- 5. Add client_id, assigned_lawyer_id, and created_by to tasks
ALTER TABLE IF EXISTS public.tasks
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_lawyer_id text,
  ADD COLUMN IF NOT EXISTS created_by text;

CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON public.tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_lawyer_id ON public.tasks(assigned_lawyer_id);

