-- Add authentication columns to telegram_subscribers
-- Run this in: Supabase Dashboard → SQL Editor → New Query

ALTER TABLE public.telegram_subscribers
  ADD COLUMN IF NOT EXISTS is_authenticated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS user_name TEXT DEFAULT '';
