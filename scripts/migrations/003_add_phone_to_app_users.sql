-- Migration: 003_add_phone_to_app_users.sql
-- Description: Adds optional phone column to public.app_users for staff & admins

ALTER TABLE IF EXISTS public.app_users 
  ADD COLUMN IF NOT EXISTS phone text;

-- Add index if useful
CREATE INDEX IF NOT EXISTS idx_app_users_phone ON public.app_users(phone);

