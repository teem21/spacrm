-- ============================================================
-- CLEANUP + FIX: Reset auth state and create confirmed admin
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Step 1: Clean up any broken admin entries
DELETE FROM auth.identities WHERE provider_id = 'admin@example.com';
DELETE FROM auth.users WHERE email = 'admin@example.com';
DELETE FROM public.profiles WHERE login = 'admin';

-- Step 2: Create fresh admin user with confirmed email
DO $$
DECLARE
  new_id uuid := gen_random_uuid();
BEGIN
  -- Insert into auth.users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_id,
    'authenticated',
    'authenticated',
    'admin@example.com',
    crypt('admin123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Администратор","login":"admin","role":"admin"}'::jsonb,
    now(), now()
  );

  -- Insert identity (required for GoTrue sign-in)
  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    new_id, new_id, new_id::text, 'email',
    jsonb_build_object('sub', new_id::text, 'email', 'admin@example.com', 'email_verified', true),
    now(), now(), now()
  );

  -- Insert profile (in case trigger doesn't fire)
  INSERT INTO public.profiles (id, name, login, role)
  VALUES (new_id, 'Администратор', 'admin', 'admin')
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Admin created with id: %', new_id;
END $$;

-- Step 3: Helper functions for user management from the app

-- Create user with auto-confirmed email
CREATE OR REPLACE FUNCTION public.create_confirmed_user(
  p_email text, p_password text, p_name text, p_login text, p_role text DEFAULT 'worker'
) RETURNS uuid AS $$
DECLARE
  new_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', new_id,
    'authenticated', 'authenticated', p_email,
    crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', p_name, 'login', p_login, 'role', p_role),
    now(), now()
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    new_id, new_id, new_id::text, 'email',
    jsonb_build_object('sub', new_id::text, 'email', p_email, 'email_verified', true),
    now(), now(), now()
  );

  -- Profile is created by handle_new_user trigger, but insert manually as backup
  INSERT INTO public.profiles (id, name, login, role)
  VALUES (new_id, p_name, p_login, p_role)
  ON CONFLICT (id) DO NOTHING;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update password
CREATE OR REPLACE FUNCTION public.update_user_password(p_user_id uuid, p_new_password text)
RETURNS void AS $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete user
CREATE OR REPLACE FUNCTION public.delete_auth_user(p_user_id uuid)
RETURNS void AS $$
BEGIN
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissions
GRANT EXECUTE ON FUNCTION public.create_confirmed_user TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_user_password TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_auth_user TO authenticated;
