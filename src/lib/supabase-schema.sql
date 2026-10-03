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

-- 2. TABLA: profiles (extensión de auth.users con roles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
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

-- Índices para optimizar consultas de calendario y filtrado por congregación
CREATE INDEX IF NOT EXISTS idx_speakers_congregation ON public.speakers(congregation_id);
CREATE INDEX IF NOT EXISTS idx_talks_speaker ON public.talks(speaker_id);
CREATE INDEX IF NOT EXISTS idx_incoming_local_date ON public.incoming_assignments(local_congregation_id, meeting_date);
CREATE INDEX IF NOT EXISTS idx_outgoing_local_date ON public.outgoing_assignments(local_congregation_id, meeting_date);
CREATE INDEX IF NOT EXISTS idx_outgoing_month_year ON public.outgoing_assignments(local_congregation_id, year, month);

-- ====================================================================
-- FUNCIONES AUXILIARES PARA RLS
-- ====================================================================

-- Obtener el rol del usuario autenticado
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Obtener la congregación del usuario autenticado
CREATE OR REPLACE FUNCTION public.get_auth_congregation_id()
RETURNS UUID AS $$
  SELECT congregation_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ====================================================================
-- CONFIGURACIÓN DE ROW LEVEL SECURITY (RLS)
-- ====================================================================

ALTER TABLE public.congregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incoming_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outgoing_assignments ENABLE ROW LEVEL SECURITY;

-- 1. Políticas de Congregaciones:
-- Lectura: Todos los usuarios autenticados pueden ver congregaciones activas (necesario para elegir origen/destino)
CREATE POLICY "Lectura global de congregaciones activas"
  ON public.congregations FOR SELECT
  TO authenticated
  USING (is_active = true OR public.get_auth_role() = 'super_admin');

-- Modificación: Solo el super administrador
CREATE POLICY "Super admin gestiona congregaciones"
  ON public.congregations FOR ALL
  TO authenticated
  USING (public.get_auth_role() = 'super_admin');

-- Administrador de congregación puede actualizar el logo o detalles de su congregación
CREATE POLICY "Admin de congregacion actualiza su logo"
  ON public.congregations FOR UPDATE
  TO authenticated
  USING (id = public.get_auth_congregation_id())
  WITH CHECK (id = public.get_auth_congregation_id());

-- 2. Políticas de Perfiles:
CREATE POLICY "Usuarios leen su propio perfil"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.get_auth_role() = 'super_admin');

CREATE POLICY "Super admin administra perfiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.get_auth_role() = 'super_admin');

-- 3. Políticas de Speakers:
-- Lectura: Cualquier usuario autenticado puede leer conferenciantes activos (para seleccionarlos como visitantes)
CREATE POLICY "Lectura de conferenciantes activos"
  ON public.speakers FOR SELECT
  TO authenticated
  USING (is_active = true OR congregation_id = public.get_auth_congregation_id() OR public.get_auth_role() = 'super_admin');

-- Escritura: Solo de su propia congregación
CREATE POLICY "Admin gestiona sus propios conferenciantes"
  ON public.speakers FOR ALL
  TO authenticated
  USING (congregation_id = public.get_auth_congregation_id() OR public.get_auth_role() = 'super_admin')
  WITH CHECK (congregation_id = public.get_auth_congregation_id() OR public.get_auth_role() = 'super_admin');

-- 4. Políticas de Talks:
-- Lectura: Todos los autenticados leen conferencias activas (para asignar visitante con su tema)
CREATE POLICY "Lectura de conferencias activas"
  ON public.talks FOR SELECT
  TO authenticated
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM public.speakers s
    WHERE s.id = speaker_id AND (s.congregation_id = public.get_auth_congregation_id() OR public.get_auth_role() = 'super_admin')
  ));

-- Escritura: Solo para conferenciantes de su congregación
CREATE POLICY "Admin gestiona conferencias de su congregacion"
  ON public.talks FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.speakers s
    WHERE s.id = speaker_id AND (s.congregation_id = public.get_auth_congregation_id() OR public.get_auth_role() = 'super_admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.speakers s
    WHERE s.id = speaker_id AND (s.congregation_id = public.get_auth_congregation_id() OR public.get_auth_role() = 'super_admin')
  ));

-- 5. Políticas de Entradas (incoming_assignments):
CREATE POLICY "Admin gestiona entradas de su congregacion"
  ON public.incoming_assignments FOR ALL
  TO authenticated
  USING (local_congregation_id = public.get_auth_congregation_id() OR public.get_auth_role() = 'super_admin')
  WITH CHECK (local_congregation_id = public.get_auth_congregation_id() OR public.get_auth_role() = 'super_admin');

-- 6. Políticas de Salidas (outgoing_assignments):
CREATE POLICY "Admin gestiona salidas de su congregacion"
  ON public.outgoing_assignments FOR ALL
  TO authenticated
  USING (local_congregation_id = public.get_auth_congregation_id() OR public.get_auth_role() = 'super_admin')
  WITH CHECK (local_congregation_id = public.get_auth_congregation_id() OR public.get_auth_role() = 'super_admin');

-- ====================================================================
-- STORAGE BUCKET PARA LOGOS DE CONGREGACIONES
-- ====================================================================

-- Insertar bucket si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('congregation-logos', 'congregation-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para logos
CREATE POLICY "Logos de congregaciones son públicos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'congregation-logos');

CREATE POLICY "Usuarios autenticados suben logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'congregation-logos');

CREATE POLICY "Usuarios actualizan logos de su congregación"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'congregation-logos');
