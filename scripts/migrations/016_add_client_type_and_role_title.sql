-- Migration: 016_add_client_type_and_role_title.sql
-- Description: Adds client_type column to clients table and role_title to app_users

ALTER TABLE IF EXISTS public.clients
  ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'individual';

ALTER TABLE IF EXISTS public.app_users
  ADD COLUMN IF NOT EXISTS role_title text;
