-- Migration: 017_add_law_firm_fields.sql
-- Description: Adds enhanced real-world fields across clients, poa, app_users, and offices.

-- 1. Clients Table Additions
ALTER TABLE IF EXISTS public.clients
  ADD COLUMN IF NOT EXISTS company_representative_name text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS secondary_email text,
  ADD COLUMN IF NOT EXISTS referral_source text,
  ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'individual';

-- 2. Power of Attorney (POA) Table Additions
ALTER TABLE IF EXISTS public.poa
  ADD COLUMN IF NOT EXISTS poa_type text DEFAULT 'خاصة',
  ADD COLUMN IF NOT EXISTS scope_description text,
  ADD COLUMN IF NOT EXISTS notarization_authority text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revocation_reason text;

-- 3. Staff Members & Office Admin Additions (app_users Table)
ALTER TABLE IF EXISTS public.app_users
  -- Staff specific fields
  ADD COLUMN IF NOT EXISTS legal_specialty text,
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS license_expiry_date date,
  ADD COLUMN IF NOT EXISTS joined_office_at date,
  -- Office specific fields (on office admin accounts)
  ADD COLUMN IF NOT EXISTS commercial_registration_number text,
  ADD COLUMN IF NOT EXISTS billing_contact_name text,
  ADD COLUMN IF NOT EXISTS billing_contact_phone text,
  ADD COLUMN IF NOT EXISTS billing_contact_email text,
  ADD COLUMN IF NOT EXISTS office_address text;
