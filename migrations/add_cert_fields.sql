-- Add certificate fields to bookings table
-- Run this in Supabase SQL Editor before deploying the new code

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cert_amount integer DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS remainder_method text;

-- Migrate old cert_dep bookings: treat them as full certificate
UPDATE bookings
SET payment_method = 'certificate',
    cert_amount = COALESCE(total_price, 0)
WHERE payment_method = 'cert_dep';
