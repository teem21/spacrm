-- Add master_name and payment_method columns to bookings
-- Run this in: Supabase Dashboard → SQL Editor → New Query

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS master_name TEXT DEFAULT '';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';
