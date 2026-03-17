-- ============================================================
-- CLEANUP: Remove everything that breaks GoTrue
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Drop pgcrypto (this is what breaks GoTrue!)
DROP EXTENSION IF EXISTS pgcrypto CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.create_confirmed_user(text, text, text, text, text);
DROP FUNCTION IF EXISTS public.update_user_password(uuid, text);
DROP FUNCTION IF EXISTS public.delete_auth_user(uuid);

-- Clean up any broken auth entries
DELETE FROM public.profiles WHERE login = 'admin';
DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'admin@example.com');
DELETE FROM auth.users WHERE email = 'admin@example.com';
