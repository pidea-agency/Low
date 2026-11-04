-- Migration: 004_member_activation.sql
-- Description: Adds activation token columns and allows 'pending_activation' status on public.app_users

-- 1. Add activation token hash and expiration timestamp
ALTER TABLE IF EXISTS public.app_users
  ADD COLUMN IF NOT EXISTS activation_token_hash text,
  ADD COLUMN IF NOT EXISTS activation_token_expires_at timestamptz;

-- 2. Update status constraint if a check constraint exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'app_users_status_check'
  ) THEN
    ALTER TABLE public.app_users DROP CONSTRAINT app_users_status_check;
    ALTER TABLE public.app_users 
      ADD CONSTRAINT app_users_status_check 
      CHECK (status IN ('active', 'suspended', 'pending_activation'));
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 3. Create index on activation_token_hash for fast single-use token lookup
CREATE INDEX IF NOT EXISTS idx_app_users_activation_token_hash 
  ON public.app_users(activation_token_hash);

-- 4. Create index on status for quick filtering of pending/active accounts
CREATE INDEX IF NOT EXISTS idx_app_users_status 
  ON public.app_users(status);

