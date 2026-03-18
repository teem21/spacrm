-- Add therapists JSONB column to salons table
-- Replace the old therapist_count with a named therapists array
-- Run this in: Supabase Dashboard → SQL Editor → New Query

ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS therapists JSONB NOT NULL DEFAULT '[]';

-- Migrate existing therapist_count data to therapists array
-- This creates named entries like [{"id":"salon-1-ther-1","name":"Массажистка 1"}, ...]
UPDATE public.salons
SET therapists = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id || '-ther-' || i,
      'name', 'Массажистка ' || i
    )
  )
  FROM generate_series(1, GREATEST(therapist_count, 1)) AS i
)
WHERE therapists = '[]'::jsonb;
