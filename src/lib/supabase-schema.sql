-- ====================================================================
-- SISTEMA DE GESTIÓN DEL PROGRAMA DE CONFERENCIAS
-- Esquema de Base de Datos y Políticas RLS para Supabase
-- ====================================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA: congregations
CREATE TABLE IF NOT EXISTS public.congregations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    weekday_meeting_day TEXT NOT NULL CHECK (weekday_meeting_day IN ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes')),
    weekday_meeting_time TEXT NOT NULL DEFAULT '19:00',
    weekend_meeting_day TEXT NOT NULL CHECK (weekend_meeting_day IN ('Sábado', 'Domingo')),
    weekend_meeting_time TEXT NOT NULL DEFAULT '09:30',
    maps_url TEXT,
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    coordinator_name TEXT,
    coordinator_email TEXT,
    coordinator_phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.congregations ADD COLUMN IF NOT EXISTS maps_url TEXT;

-- 2. TABLA: profiles (usuarios y administradores)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    congregation_id UUID REFERENCES public.congregations(id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'congregation_admin')),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLA: speakers (conferenciantes)
CREATE TABLE IF NOT EXISTS public.speakers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    congregation_id UUID NOT NULL REFERENCES public.congregations(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABLA: talks (conferencias)
CREATE TABLE IF NOT EXISTS public.talks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    speaker_id UUID REFERENCES public.speakers(id) ON DELETE SET NULL,
    congregation_id UUID NOT NULL REFERENCES public.congregations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    song_number INTEGER NOT NULL,
    theme_number INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.talks ADD COLUMN IF NOT EXISTS congregation_id UUID REFERENCES public.congregations(id) ON DELETE CASCADE;
UPDATE public.talks AS talk
SET congregation_id = speaker.congregation_id
FROM public.speakers AS speaker
WHERE talk.speaker_id = speaker.id AND talk.congregation_id IS NULL;
ALTER TABLE public.talks ALTER COLUMN congregation_id SET NOT NULL;
ALTER TABLE public.talks ALTER COLUMN speaker_id DROP NOT NULL;
ALTER TABLE public.talks DROP CONSTRAINT IF EXISTS talks_speaker_id_fkey;
ALTER TABLE public.talks ADD CONSTRAINT talks_speaker_id_fkey
    FOREIGN KEY (speaker_id) REFERENCES public.speakers(id) ON DELETE SET NULL;

-- 5. TABLA: readers (lectores de La Atalaya locales - separados de oradores)
CREATE TABLE IF NOT EXISTS public.readers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    congregation_id UUID NOT NULL REFERENCES public.congregations(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    can_read BOOLEAN NOT NULL DEFAULT true,
    can_preside BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migraciones seguras para readers
ALTER TABLE public.readers ADD COLUMN IF NOT EXISTS can_read BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.readers ADD COLUMN IF NOT EXISTS can_preside BOOLEAN NOT NULL DEFAULT false;

-- 6. TABLA: incoming_assignments (conferencias de entrada / visitantes)
CREATE TABLE IF NOT EXISTS public.incoming_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_congregation_id UUID NOT NULL REFERENCES public.congregations(id) ON DELETE CASCADE,
    origin_congregation_id UUID REFERENCES public.congregations(id) ON DELETE RESTRICT,
    speaker_id UUID REFERENCES public.speakers(id) ON DELETE RESTRICT,
    talk_id UUID REFERENCES public.talks(id) ON DELETE RESTRICT,
    reader_id UUID REFERENCES public.readers(id) ON DELETE SET NULL,
    president_id UUID REFERENCES public.readers(id) ON DELETE SET NULL,
    song_number INTEGER,
    meeting_date DATE NOT NULL,
    meeting_time TEXT NOT NULL,
    is_no_meeting BOOLEAN NOT NULL DEFAULT false,
    no_meeting_reason TEXT,
    is_memorial BOOLEAN NOT NULL DEFAULT false,
    memorial_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migraciones seguras para incoming_assignments
ALTER TABLE public.incoming_assignments ADD COLUMN IF NOT EXISTS reader_id UUID REFERENCES public.readers(id) ON DELETE SET NULL;
ALTER TABLE public.incoming_assignments ADD COLUMN IF NOT EXISTS president_id UUID REFERENCES public.readers(id) ON DELETE SET NULL;
ALTER TABLE public.incoming_assignments ADD COLUMN IF NOT EXISTS is_no_meeting BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.incoming_assignments ADD COLUMN IF NOT EXISTS no_meeting_reason TEXT;
ALTER TABLE public.incoming_assignments ADD COLUMN IF NOT EXISTS is_memorial BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.incoming_assignments ADD COLUMN IF NOT EXISTS memorial_date DATE;
ALTER TABLE public.incoming_assignments ALTER COLUMN origin_congregation_id DROP NOT NULL;
ALTER TABLE public.incoming_assignments ALTER COLUMN speaker_id DROP NOT NULL;
ALTER TABLE public.incoming_assignments ALTER COLUMN talk_id DROP NOT NULL;
ALTER TABLE public.incoming_assignments ALTER COLUMN song_number DROP NOT NULL;

-- 7. TABLA: outgoing_assignments (conferencias de salida)
CREATE TABLE IF NOT EXISTS public.outgoing_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_congregation_id UUID NOT NULL REFERENCES public.congregations(id) ON DELETE CASCADE,
    destination_congregation_id UUID NOT NULL REFERENCES public.congregations(id) ON DELETE RESTRICT,
    speaker_id UUID NOT NULL REFERENCES public.speakers(id) ON DELETE RESTRICT,
    talk_id UUID NOT NULL REFERENCES public.talks(id) ON DELETE RESTRICT,
    song_number INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 5),
    meeting_date DATE NOT NULL,
    meeting_time TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_speakers_congregation ON public.speakers(congregation_id);
CREATE INDEX IF NOT EXISTS idx_talks_speaker ON public.talks(speaker_id);
CREATE INDEX IF NOT EXISTS idx_talks_congregation ON public.talks(congregation_id);
CREATE INDEX IF NOT EXISTS idx_readers_congregation ON public.readers(congregation_id);
CREATE INDEX IF NOT EXISTS idx_incoming_local_date ON public.incoming_assignments(local_congregation_id, meeting_date);
CREATE INDEX IF NOT EXISTS idx_incoming_reader ON public.incoming_assignments(reader_id);
CREATE INDEX IF NOT EXISTS idx_incoming_president ON public.incoming_assignments(president_id);
CREATE INDEX IF NOT EXISTS idx_outgoing_local_date ON public.outgoing_assignments(local_congregation_id, meeting_date);
CREATE INDEX IF NOT EXISTS idx_outgoing_month_year ON public.outgoing_assignments(local_congregation_id, year, month);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS)
-- ====================================================================

ALTER TABLE IF EXISTS public.congregations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.speakers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.talks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.readers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.incoming_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.outgoing_assignments DISABLE ROW LEVEL SECURITY;

-- Quitar restricción estricta de usuarios en profiles para creación flexible
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE IF EXISTS public.profiles ALTER COLUMN user_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'super_admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.create_congregation_admin_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    selected_congregation_id UUID;
BEGIN
    BEGIN
        selected_congregation_id := NULLIF(NEW.raw_user_meta_data->>'congregation_id', '')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN NEW;
    END;

    IF selected_congregation_id IS NULL OR NEW.email IS NULL THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.profiles (
        id, user_id, congregation_id, role, full_name, email, phone
    )
    SELECT
        NEW.id,
        NEW.id,
        congregation.id,
        'congregation_admin',
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
        NEW.email,
        NULLIF(NEW.raw_user_meta_data->>'phone', '')
    FROM public.congregations AS congregation
    WHERE congregation.id = selected_congregation_id AND congregation.is_active
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_congregation_admin_profile ON auth.users;
CREATE TRIGGER create_congregation_admin_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.create_congregation_admin_profile();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles visible to owner or super admins" ON public.profiles;
CREATE POLICY "Profiles visible to owner or super admins"
    ON public.profiles FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id
        OR lower(email) = lower(auth.jwt()->>'email')
        OR public.is_super_admin()
    );
DROP POLICY IF EXISTS "Super admins manage profiles" ON public.profiles;
CREATE POLICY "Super admins manage profiles"
    ON public.profiles FOR ALL TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

REVOKE ALL ON TABLE public.profiles FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.create_congregation_admin_profile() FROM PUBLIC, anon, authenticated;

-- Otorgar permisos directos completos a las tablas de datos públicas
GRANT ALL ON TABLE public.congregations TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.speakers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.talks TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.readers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.incoming_assignments TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.outgoing_assignments TO anon, authenticated, service_role;

-- ====================================================================
-- STORAGE BUCKET PARA LOGOS DE CONGREGACIONES
-- ====================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('congregation-logos', 'congregation-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Logos de congregaciones son públicos" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios suben logos" ON storage.objects;

CREATE POLICY "Logos de congregaciones son públicos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'congregation-logos');

CREATE POLICY "Usuarios suben logos"
  ON storage.objects FOR ALL
  TO public
  USING (bucket_id = 'congregation-logos')
  WITH CHECK (bucket_id = 'congregation-logos');
