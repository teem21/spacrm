-- ============================================================
-- SPA CRM — Supabase Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. TABLES
-- ============================================================

CREATE TABLE public.salons (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  rooms           JSONB NOT NULL DEFAULT '[]',
  therapist_count INTEGER NOT NULL DEFAULT 0,
  has_sauna       BOOLEAN NOT NULL DEFAULT FALSE,
  sauna_capacity  INTEGER NOT NULL DEFAULT 0,
  sauna_duration  INTEGER NOT NULL DEFAULT 60,
  has_peeling     BOOLEAN NOT NULL DEFAULT FALSE,
  peeling_max_per_hour    INTEGER NOT NULL DEFAULT 0,
  peeling_masters_max     INTEGER NOT NULL DEFAULT 0,
  peeling_time_per_person INTEGER NOT NULL DEFAULT 30,
  work_start      TEXT NOT NULL DEFAULT '10:00',
  work_end        TEXT NOT NULL DEFAULT '22:00',
  day_off         TEXT,
  buffer_minutes  INTEGER NOT NULL DEFAULT 15
);

CREATE TABLE public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  login      TEXT UNIQUE NOT NULL,
  role       TEXT NOT NULL DEFAULT 'worker' CHECK (role IN ('admin', 'worker')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.procedures (
  id                  TEXT PRIMARY KEY,
  salon_id            TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  category            TEXT NOT NULL,
  duration            INTEGER NOT NULL,
  price               INTEGER NOT NULL,
  therapists_required INTEGER NOT NULL DEFAULT 1,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_procedures_salon ON public.procedures(salon_id);

CREATE TABLE public.combos (
  id             TEXT PRIMARY KEY,
  salon_id       TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  steps          JSONB NOT NULL DEFAULT '[]',
  price          INTEGER NOT NULL DEFAULT 0,
  total_duration INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_combos_salon ON public.combos(salon_id);

CREATE TABLE public.bookings (
  id               TEXT PRIMARY KEY,
  salon_id         TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  client_name      TEXT NOT NULL,
  client_phone     TEXT DEFAULT '',
  client_count     INTEGER NOT NULL DEFAULT 1,
  booking_type     TEXT NOT NULL DEFAULT 'single_procedure',
  procedure_id     TEXT,
  combo_id         TEXT,
  segments         JSONB NOT NULL DEFAULT '[]',
  total_start_time TEXT NOT NULL,
  total_end_time   TEXT NOT NULL,
  total_price      INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'booked',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes            TEXT DEFAULT ''
);
CREATE INDEX idx_bookings_salon_date ON public.bookings(salon_id, date);

CREATE TABLE public.activity_logs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  user_name   TEXT,
  action      TEXT NOT NULL,
  target_date TEXT,
  target_time TEXT,
  client_name TEXT,
  details     TEXT,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.telegram_subscribers (
  chat_id  BIGINT PRIMARY KEY,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. RLS POLICIES
-- ============================================================

ALTER TABLE public.salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_subscribers ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (
  id = auth.uid() OR public.get_my_role() = 'admin'
);
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE TO authenticated USING (
  public.get_my_role() = 'admin'
);

-- Salons: everyone reads, admins write
CREATE POLICY "salons_select" ON public.salons FOR SELECT TO authenticated USING (true);
CREATE POLICY "salons_insert" ON public.salons FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "salons_update" ON public.salons FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin');
CREATE POLICY "salons_delete" ON public.salons FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- Procedures: everyone reads, admins write
CREATE POLICY "procedures_select" ON public.procedures FOR SELECT TO authenticated USING (true);
CREATE POLICY "procedures_insert" ON public.procedures FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "procedures_update" ON public.procedures FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin');
CREATE POLICY "procedures_delete" ON public.procedures FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- Combos: everyone reads, admins write
CREATE POLICY "combos_select" ON public.combos FOR SELECT TO authenticated USING (true);
CREATE POLICY "combos_insert" ON public.combos FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "combos_update" ON public.combos FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin');
CREATE POLICY "combos_delete" ON public.combos FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- Bookings: all authenticated users can CRUD
CREATE POLICY "bookings_select" ON public.bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "bookings_insert" ON public.bookings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "bookings_update" ON public.bookings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "bookings_delete" ON public.bookings FOR DELETE TO authenticated USING (true);

-- Activity logs: all can read/insert, admins can delete
CREATE POLICY "logs_select" ON public.activity_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "logs_insert" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "logs_delete" ON public.activity_logs FOR DELETE TO authenticated USING (public.get_my_role() = 'admin');

-- Telegram subscribers: service_role only (for Edge Functions)
CREATE POLICY "tg_service" ON public.telegram_subscribers FOR ALL TO service_role USING (true);

-- 3. AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
-- Trigger: when a new auth.user is created, insert a profiles row
-- The raw_user_meta_data must contain { name, login, role }

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, login, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'login', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'worker')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
