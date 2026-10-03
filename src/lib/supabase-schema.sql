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
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    coordinator_name TEXT,
    coordinator_email TEXT,
    coordinator_phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
    speaker_id UUID NOT NULL REFERENCES public.speakers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    song_number INTEGER NOT NULL,
    theme_number INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABLA: incoming_assignments (conferencias de entrada / visitantes)
CREATE TABLE IF NOT EXISTS public.incoming_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_congregation_id UUID NOT NULL REFERENCES public.congregations(id) ON DELETE CASCADE,
    origin_congregation_id UUID NOT NULL REFERENCES public.congregations(id) ON DELETE RESTRICT,
    speaker_id UUID NOT NULL REFERENCES public.speakers(id) ON DELETE RESTRICT,
    talk_id UUID NOT NULL REFERENCES public.talks(id) ON DELETE RESTRICT,
    song_number INTEGER NOT NULL,
    meeting_date DATE NOT NULL,
    meeting_time TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABLA: outgoing_assignments (conferencias de salida)
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
CREATE INDEX IF NOT EXISTS idx_incoming_local_date ON public.incoming_assignments(local_congregation_id, meeting_date);
CREATE INDEX IF NOT EXISTS idx_outgoing_local_date ON public.outgoing_assignments(local_congregation_id, meeting_date);
CREATE INDEX IF NOT EXISTS idx_outgoing_month_year ON public.outgoing_assignments(local_congregation_id, year, month);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS): DESHABILITADO EN TODAS LAS TABLAS
-- ====================================================================

ALTER TABLE IF EXISTS public.congregations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.speakers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.talks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.incoming_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.outgoing_assignments DISABLE ROW LEVEL SECURITY;

-- Quitar restricción estricta de usuarios en profiles para creación flexible
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE IF EXISTS public.profiles ALTER COLUMN user_id DROP NOT NULL;

-- Otorgar permisos directos completos
GRANT ALL ON TABLE public.congregations TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.speakers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.talks TO anon, authenticated, service_role;
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
