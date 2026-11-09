-- Migration: 012_payments_table.sql
-- Description: Creates payments table for Super Admin manual record-keeping of office subscription payments and invoices.

CREATE TABLE IF NOT EXISTS public.payments (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  office_id text NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL DEFAULT 0.00,
  currency text NOT NULL DEFAULT 'SAR',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  method text NOT NULL DEFAULT 'bank_transfer',
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'overdue')),
  notes text,
  recorded_by text,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Indexes for fast filtering and chronological queries
CREATE INDEX IF NOT EXISTS idx_payments_office_id ON public.payments(office_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);
