-- Migration: 002_multi_tenant_postgres_tables.sql
-- Description: Migrates data storage from Google Sheets to shared Supabase Postgres tables with strict multi-tenant office isolation and Row Level Security (RLS).

-- 1. Ensure 'offices' table exists
CREATE TABLE IF NOT EXISTS public.offices (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  admin_id text,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- 1.1 Rate Limits table (for distributed brute-force protection)
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 1,
  reset_time bigint NOT NULL,
  updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_time ON public.rate_limits(reset_time);

-- 2. Extend 'app_users' with office_id if not present
ALTER TABLE IF EXISTS public.app_users
  ADD COLUMN IF NOT EXISTS office_id text;

-- 3. Sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
  id SERIAL PRIMARY KEY,
  office_id text NOT NULL,
  case_number text,
  plaintiff text,
  defendant text,
  court text,
  court_circuit text,
  case_subject text,
  session_type text,
  session_date_hijri text,
  session_day text,
  session_time text,
  notes text,
  status text NOT NULL DEFAULT 'Upcoming',
  reminder24 boolean NOT NULL DEFAULT false,
  reminder6 boolean NOT NULL DEFAULT false,
  report text,
  hearing_at timestamptz,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_office_id ON public.sessions(office_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_hearing_at ON public.sessions(hearing_at);

-- 4. Power of Attorney (POA / الوكالات) table
CREATE TABLE IF NOT EXISTS public.poa (
  id SERIAL PRIMARY KEY,
  office_id text NOT NULL,
  client_name text NOT NULL,
  poa_number text NOT NULL,
  issue_date_hijri text DEFAULT '',
  expiry_date_hijri text DEFAULT '',
  days_remaining integer DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_poa_office_id ON public.poa(office_id);
CREATE INDEX IF NOT EXISTS idx_poa_poa_number ON public.poa(poa_number);

-- 5. Judgments (الأحكام) table
CREATE TABLE IF NOT EXISTS public.judgments (
  id SERIAL PRIMARY KEY,
  office_id text NOT NULL,
  case_number text DEFAULT '',
  court text DEFAULT '',
  plaintiff text DEFAULT '',
  defendant text DEFAULT '',
  assigned_lawyer text DEFAULT '',
  judgment_number text DEFAULT '',
  judgment_date text DEFAULT '',
  summary text DEFAULT '',
  is_favorable text DEFAULT 'نهائي',
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_judgments_office_id ON public.judgments(office_id);
CREATE INDEX IF NOT EXISTS idx_judgments_case_number ON public.judgments(case_number);

-- 6. Tasks (المهام) table
CREATE TABLE IF NOT EXISTS public.tasks (
  id SERIAL PRIMARY KEY,
  office_id text NOT NULL,
  title text NOT NULL,
  assignee text DEFAULT '',
  priority text DEFAULT 'عادية',
  due_date text DEFAULT '',
  remaining_days text DEFAULT '',
  status text DEFAULT 'قيد التنفيذ',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_office_id ON public.tasks(office_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

-- 7. Session Reports (التقارير) table
CREATE TABLE IF NOT EXISTS public.reports (
  id SERIAL PRIMARY KEY,
  office_id text NOT NULL,
  session_id integer NOT NULL,
  report text NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_office_id ON public.reports(office_id);
CREATE INDEX IF NOT EXISTS idx_reports_session_id ON public.reports(session_id);

-- 8. Enable Row Level Security (RLS) on all multi-tenant tables
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS Policies keyed on office_id matching app.current_office_id or service_role
DO $$
BEGIN
  -- Offices
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'offices_isolation_policy' AND tablename = 'offices') THEN
    CREATE POLICY offices_isolation_policy ON public.offices
      FOR ALL USING (id = NULLIF(current_setting('app.current_office_id', true), '') OR auth.role() = 'service_role');
  END IF;

  -- Sessions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sessions_isolation_policy' AND tablename = 'sessions') THEN
    CREATE POLICY sessions_isolation_policy ON public.sessions
      FOR ALL USING (office_id = NULLIF(current_setting('app.current_office_id', true), '') OR auth.role() = 'service_role');
  END IF;

  -- POA
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'poa_isolation_policy' AND tablename = 'poa') THEN
    CREATE POLICY poa_isolation_policy ON public.poa
      FOR ALL USING (office_id = NULLIF(current_setting('app.current_office_id', true), '') OR auth.role() = 'service_role');
  END IF;

  -- Judgments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'judgments_isolation_policy' AND tablename = 'judgments') THEN
    CREATE POLICY judgments_isolation_policy ON public.judgments
      FOR ALL USING (office_id = NULLIF(current_setting('app.current_office_id', true), '') OR auth.role() = 'service_role');
  END IF;

  -- Tasks
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tasks_isolation_policy' AND tablename = 'tasks') THEN
    CREATE POLICY tasks_isolation_policy ON public.tasks
      FOR ALL USING (office_id = NULLIF(current_setting('app.current_office_id', true), '') OR auth.role() = 'service_role');
  END IF;

  -- Reports
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'reports_isolation_policy' AND tablename = 'reports') THEN
    CREATE POLICY reports_isolation_policy ON public.reports
      FOR ALL USING (office_id = NULLIF(current_setting('app.current_office_id', true), '') OR auth.role() = 'service_role');
  END IF;
END $$;

-- 10. Seed default office for existing accounts if not present
INSERT INTO public.offices (id, name, admin_id)
SELECT 'local-office-admin', 'مكتب المحاماة الرئيسي', 'local-office-admin'
WHERE NOT EXISTS (SELECT 1 FROM public.offices WHERE id = 'local-office-admin');

UPDATE public.app_users
SET office_id = 'local-office-admin'
WHERE id = 'local-office-admin' AND (office_id IS NULL OR office_id = '');

UPDATE public.app_users
SET office_id = admin_id
WHERE role = 'staff' AND admin_id IS NOT NULL AND (office_id IS NULL OR office_id = '');

/*
-- ROLLBACK NOTE:
-- To rollback this migration, run:
DROP POLICY IF EXISTS reports_isolation_policy ON public.reports;
DROP POLICY IF EXISTS tasks_isolation_policy ON public.tasks;
DROP POLICY IF EXISTS judgments_isolation_policy ON public.judgments;
DROP POLICY IF EXISTS poa_isolation_policy ON public.poa;
DROP POLICY IF EXISTS sessions_isolation_policy ON public.sessions;
DROP POLICY IF EXISTS offices_isolation_policy ON public.offices;

DROP TABLE IF EXISTS public.reports;
DROP TABLE IF EXISTS public.tasks;
DROP TABLE IF EXISTS public.judgments;
DROP TABLE IF EXISTS public.poa;
DROP TABLE IF EXISTS public.sessions;
DROP TABLE IF EXISTS public.offices;
ALTER TABLE IF EXISTS public.app_users DROP COLUMN IF EXISTS office_id;
*/

