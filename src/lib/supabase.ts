import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ====================================================================
// CREDENCIALES DIRECTAS DE CONEXIÓN A SUPABASE
// ====================================================================
export const SUPABASE_DIRECT_URL = 'https://ykkcjxbjxnpaunzzndaj.supabase.co';
export const SUPABASE_DIRECT_ANON_KEY = 'sb_publishable_0FvRWRm5MfuPT6wOwHvKlg_ZnIo6zu6';
export const SUPABASE_DIRECT_CONN = 'postgresql://postgres:Kurumi.1015@db.ykkcjxbjxnpaunzzndaj.supabase.co:5432/postgres';

const STORAGE_KEY_URL = 'app_supabase_url';
const STORAGE_KEY_KEY = 'app_supabase_anon_key';
const STORAGE_KEY_CONN = 'app_supabase_direct_conn';

/**
 * Parsea una URL directa de Supabase o una cadena de conexión PostgreSQL directa
 * (e.g. postgresql://postgres:pass@db.[ref].supabase.co:5432/postgres)
 * para extraer la URL del proyecto https://[ref].supabase.co
 */
export function parseSupabaseUrl(connectionStringOrUrl: string): string {
  if (!connectionStringOrUrl) return '';
  const trimmed = connectionStringOrUrl.trim();

  // Si ya es formato HTTP/HTTPS
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/+$/, '');
  }

  // Cadena directa de Supabase PostgreSQL: db.[ref].supabase.co
  const dbMatch = trimmed.match(/db\.([a-z0-9_-]+)\.supabase\.co/i);
  if (dbMatch && dbMatch[1]) {
    return `https://${dbMatch[1]}.supabase.co`;
  }

  // Cadena de Session/Transaction pooler: postgresql://postgres.[ref]:pass@...
  const userMatch = trimmed.match(/postgres(?:ql)?:\/\/postgres\.([a-z0-9_-]+):/i);
  if (userMatch && userMatch[1]) {
    return `https://${userMatch[1]}.supabase.co`;
  }

  // Coincidencia genérica para cualquier subdominio de supabase.co
  const genericMatch = trimmed.match(/([a-z0-9_-]+)\.supabase\.co/i);
  if (genericMatch && genericMatch[1]) {
    return `https://${genericMatch[1]}.supabase.co`;
  }

  return trimmed;
}

export function getStoredSupabaseConfig(): {
  url: string;
  anonKey: string;
  rawConnection: string;
} {
  // 1. Variables de entorno de Vite
  const envConn =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_CONNECTION_STRING) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_DIRECT_URL) ||
    '';
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
  const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '';

  // 2. Almacenamiento local del navegador
  let storedConn = '';
  let storedUrl = '';
  let storedKey = '';
  if (typeof localStorage !== 'undefined') {
    try {
      storedConn = localStorage.getItem(STORAGE_KEY_CONN) || '';
      storedUrl = localStorage.getItem(STORAGE_KEY_URL) || '';
      storedKey = localStorage.getItem(STORAGE_KEY_KEY) || '';
    } catch {
      // Ignorar errores de localStorage
    }
  }

  // 3. Resolución con credenciales directas predeterminadas
  const rawConnection = envConn || storedConn || envUrl || storedUrl || SUPABASE_DIRECT_CONN;
  const resolvedUrl = parseSupabaseUrl(rawConnection) || SUPABASE_DIRECT_URL;
  const anonKey = (envKey || storedKey || SUPABASE_DIRECT_ANON_KEY).trim();

  return {
    url: resolvedUrl,
    anonKey,
    rawConnection,
  };
}

export function saveStoredSupabaseConfig(connectionOrUrl: string, anonKey: string): void {
  const parsedUrl = parseSupabaseUrl(connectionOrUrl);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_CONN, connectionOrUrl.trim());
      localStorage.setItem(STORAGE_KEY_URL, parsedUrl);
      localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
    } catch {
      // ignore
    }
  }
}

export function clearStoredSupabaseConfig(): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY_CONN);
      localStorage.removeItem(STORAGE_KEY_URL);
      localStorage.removeItem(STORAGE_KEY_KEY);
    } catch {
      // ignore
    }
  }
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getStoredSupabaseConfig();
  return Boolean(url && anonKey && url.startsWith('http'));
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  const { url, anonKey } = getStoredSupabaseConfig();
  const effectiveUrl = url || SUPABASE_DIRECT_URL;
  const effectiveKey = anonKey || SUPABASE_DIRECT_ANON_KEY;

  if (!cachedClient) {
    try {
      cachedClient = createClient(effectiveUrl, effectiveKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    } catch (e) {
      console.error('Error al inicializar cliente Supabase:', e);
      cachedClient = createClient(SUPABASE_DIRECT_URL, SUPABASE_DIRECT_ANON_KEY);
    }
  }
  return cachedClient;
}

export function resetSupabaseClient(): void {
  cachedClient = null;
}

export const supabase = getSupabaseClient();
