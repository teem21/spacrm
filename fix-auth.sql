-- ============================================================
-- Fix: Create confirmed admin + helper functions for user mgmt
-- Run ONCE in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create users with auto-confirmed email (bypasses GoTrue email confirmation)
CREATE OR REPLACE FUNCTION public.create_confirmed_user(
  p_email text,
  p_password text,
  p_name text,
  p_login text,
  p_role text DEFAULT 'worker'
) RETURNS uuid AS $$
DECLARE
  new_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', p_name, 'login', p_login, 'role', p_role),
    now(), now(), ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    new_id, new_id, p_email, 'email',
    jsonb_build_object('sub', new_id::text, 'email', p_email, 'email_verified', true),
    now(), now(), now()
  );

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update user password
CREATE OR REPLACE FUNCTION public.update_user_password(p_user_id uuid, p_new_password text)
RETURNS void AS $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Delete auth user (profile cascades via FK)
CREATE OR REPLACE FUNCTION public.delete_auth_user(p_user_id uuid)
RETURNS void AS $$
BEGIN
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissions: only authenticated users can call these
REVOKE EXECUTE ON FUNCTION public.create_confirmed_user FROM public;
REVOKE EXECUTE ON FUNCTION public.update_user_password FROM public;
REVOKE EXECUTE ON FUNCTION public.delete_auth_user FROM public;
GRANT EXECUTE ON FUNCTION public.create_confirmed_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_password TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_auth_user TO authenticated;
-- Allow anon for initial admin creation
GRANT EXECUTE ON FUNCTION public.create_confirmed_user TO anon;

-- 4. Create admin user (or confirm existing unconfirmed one)
DO $$
DECLARE
  admin_exists boolean;
  admin_id uuid;
BEGIN
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'admin@example.com') INTO admin_exists;

  IF admin_exists THEN
    UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE email = 'admin@example.com';

    SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@example.com';

    INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    VALUES (admin_id, admin_id, 'admin@example.com', 'email',
      jsonb_build_object('sub', admin_id::text, 'email', 'admin@example.com', 'email_verified', true),
      now(), now(), now())
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Admin user confirmed';
  ELSE
    PERFORM public.create_confirmed_user('admin@example.com', 'admin123', 'Администратор', 'admin', 'admin');
    RAISE NOTICE 'Admin user created';
  END IF;
END $$;
