-- Migration: 018_password_reset.sql
-- Description: Adds password reset token and OTP tracking fields to public.app_users

ALTER TABLE IF EXISTS public.app_users
  ADD COLUMN IF NOT EXISTS reset_code_hash text,
  ADD COLUMN IF NOT EXISTS reset_code_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS reset_attempts integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_app_users_reset_code_hash
  ON public.app_users(reset_code_hash);
