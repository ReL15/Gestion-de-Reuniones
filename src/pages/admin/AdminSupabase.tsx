import React, { useState } from 'react';
import {
  Database,
  Key,
  Globe,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Link2,
} from 'lucide-react';
import {
  getStoredSupabaseConfig,
  saveStoredSupabaseConfig,
  clearStoredSupabaseConfig,
  isSupabaseConfigured,
  resetSupabaseClient,
  parseSupabaseUrl,
} from '../../lib/supabase';
import { useToast } from '../../components/common/Toast';

const SUPABASE_SCHEMA_SQL = `-- ====================================================================
-- SISTEMA DE GESTIÓN DEL PROGRAMA DE CONFERENCIAS
-- Esquema de Base de Datos y Políticas RLS para Supabase
-- ====================================================================

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

-- 2. TABLA: profiles (usuarios con roles)
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

-- 5. TABLA: incoming_assignments (conferencias de entrada)
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

ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE IF EXISTS public.profiles ALTER COLUMN user_id DROP NOT NULL;

GRANT ALL ON TABLE public.congregations TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.speakers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.talks TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.incoming_assignments TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.outgoing_assignments TO anon, authenticated, service_role;`;

export const AdminSupabase: React.FC = () => {
  const { showToast } = useToast();
  const currentConfig = getStoredSupabaseConfig();
  const isConnected = isSupabaseConfigured();

  const [connectionString, setConnectionString] = useState(
    currentConfig.rawConnection || currentConfig.url
  );
  const [anonKey, setAnonKey] = useState(currentConfig.anonKey);
  const [hasCopied, setHasCopied] = useState(false);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectionString.trim() || !anonKey.trim()) {
      showToast('Por favor completa la URL/cadena de conexión y la Clave Anónima.', 'error');
      return;
    }

    saveStoredSupabaseConfig(connectionString, anonKey);
    resetSupabaseClient();

    const parsed = parseSupabaseUrl(connectionString);
    showToast(`Conexión a Supabase configurada (${parsed}).`);
  };

  const handleClear = () => {
    clearStoredSupabaseConfig();
    setConnectionString('');
    setAnonKey('');
    resetSupabaseClient();
    showToast('Configuración de Supabase limpiada.');
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setHasCopied(true);
    showToast('Script SQL copiado al portapapeles.');
    setTimeout(() => setHasCopied(false), 3000);
  };

  const parsedUrl = parseSupabaseUrl(connectionString);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Conexión Directa a Supabase y Esquema SQL
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Conexión directa a tu base de datos Supabase en la nube y script de migración SQL
          </p>
        </div>
      </div>

      {/* Status banner */}
      <div
        className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
          isConnected
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}
      >
        <div className="flex items-center gap-3">
          {isConnected ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
          )}
          <div>
            <span className="font-bold text-sm block">
              {isConnected
                ? 'Conexión a Supabase Activa'
                : 'Supabase Pendiente de Conexión'}
            </span>
            <span className="text-xs opacity-90">
              {isConnected
                ? `Conectado a ${currentConfig.url}. Las congregaciones, conferenciantes y programas se sincronizan directamente.`
                : 'Configura las variables en el archivo .env o introduce la cadena de conexión directa y la anon key a continuación.'}
            </span>
          </div>
        </div>
      </div>

      {/* Supabase direct connection form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-600" />
          <span>Cadena de Conexión Directa de Supabase</span>
        </h3>

        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Cadena de Conexión Directa o URL del Proyecto
            </label>
            <div className="relative">
              <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                placeholder="https://xyzabcdefg.supabase.co o postgresql://postgres:password@db.xyz.supabase.co:5432/postgres"
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-mono"
              />
            </div>
            {connectionString && parsedUrl !== connectionString && (
              <p className="text-[11px] text-indigo-600 mt-1 font-medium">
                URL de proyecto detectada: <span className="font-mono">{parsedUrl}</span>
              </p>
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              Acepta la URL del proyecto (<code className="text-slate-600 font-mono">https://xxxx.supabase.co</code>) o la cadena directa PostgreSQL (<code className="text-slate-600 font-mono">postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres</code>).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Clave Anónima Pública (Anon Key)
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="password"
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-mono"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Disponible en Supabase Dashboard &gt; Project Settings &gt; API &gt; Project API keys (anon public).
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            {isConnected && (
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
              >
                Limpiar Configuración
              </button>
            )}
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
            >
              Guardar Conexión
            </button>
          </div>
        </form>
      </div>

      {/* SQL Migration Script Box */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Script SQL de Migración para Supabase
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Copia y pega este script en el <strong>SQL Editor</strong> de Supabase para crear las tablas, índices y políticas RLS
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopySql}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl transition-colors"
          >
            {hasCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{hasCopied ? '¡Copiado!' : 'Copiar SQL'}</span>
          </button>
        </div>

        <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto max-h-72 leading-relaxed">
          {SUPABASE_SCHEMA_SQL}
        </pre>
      </div>
    </div>
  );
};
