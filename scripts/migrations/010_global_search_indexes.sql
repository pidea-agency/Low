-- Migration: 010_global_search_indexes.sql
-- Description: Btree indexes on text columns used by global search to optimize ILIKE queries

CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);
CREATE INDEX IF NOT EXISTS idx_poa_client_name ON public.poa(client_name);
CREATE INDEX IF NOT EXISTS idx_sessions_case_number ON public.sessions(case_number);
CREATE INDEX IF NOT EXISTS idx_sessions_plaintiff ON public.sessions(plaintiff);
CREATE INDEX IF NOT EXISTS idx_sessions_defendant ON public.sessions(defendant);
CREATE INDEX IF NOT EXISTS idx_judgments_plaintiff ON public.judgments(plaintiff);
CREATE INDEX IF NOT EXISTS idx_judgments_defendant ON public.judgments(defendant);
CREATE INDEX IF NOT EXISTS idx_tasks_title ON public.tasks(title);
