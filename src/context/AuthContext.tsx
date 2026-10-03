import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile, Congregation, UserRole } from '../types/database';
import { dataService } from '../services/dataService';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

export interface LocalCredential {
  email: string;
  password?: string;
  profile: Profile;
}

export const DEFAULT_INITIAL_ADMIN: Profile = {
  id: 'usr-admin-initial',
  user_id: 'usr-admin-initial',
  congregation_id: null,
  role: 'super_admin',
  full_name: 'Administrador Principal',
  email: 'admin@conferencias.org',
  phone: '',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const DEFAULT_ADMIN_PASSWORD = 'admin123';

interface AuthContextType {
  currentUser: Profile | null;
  currentCongregation: Congregation | null;
  role: UserRole | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  register: (params: {
    email: string;
    password: string;
    full_name: string;
    role?: UserRole;
    congregation_id?: string | null;
    phone?: string;
  }) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  switchCongregation: (congregationId: string) => Promise<void>;
  allCongregations: Congregation[];
  refreshData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_PROFILE_KEY = 'jw_prog_active_profile_id';
const SELECTED_CONG_KEY = 'jw_prog_selected_cong_id';
const LOCAL_CREDENTIALS_KEY = 'jw_prog_auth_users_v2';

function getLocalCredentials(): LocalCredential[] {
  try {
    const raw = localStorage.getItem(LOCAL_CREDENTIALS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalCredential(cred: LocalCredential) {
  try {
    const list = getLocalCredentials().filter((c) => c.email.toLowerCase() !== cred.email.toLowerCase());
    list.push(cred);
    localStorage.setItem(LOCAL_CREDENTIALS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error saving local credential:', e);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [currentCongregation, setCurrentCongregation] = useState<Congregation | null>(null);
  const [allCongregations, setAllCongregations] = useState<Congregation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadInitialAuth = async () => {
    setIsLoading(true);
    try {
      const congs = await dataService.getCongregations();
      setAllCongregations(congs);

      const profiles = await dataService.getProfiles();
      let activeProfile: Profile | null = null;

      // 1. Si Supabase está configurado, verificar sesión activa de auth
      if (isSupabaseConfigured()) {
        const sb = getSupabaseClient();
        if (sb) {
          const { data: sessionData } = await sb.auth.getSession();
          if (sessionData.session?.user) {
            const userEmail = sessionData.session.user.email?.toLowerCase();
            activeProfile =
              profiles.find(
                (p) =>
                  p.email.toLowerCase() === userEmail ||
                  p.id === sessionData.session?.user.id ||
                  p.user_id === sessionData.session?.user.id
              ) || null;
          }
        }
      }

      // 2. Si no hay sesión de Supabase, verificar profile guardado previamente
      if (!activeProfile) {
        const savedProfileId = localStorage.getItem(CURRENT_PROFILE_KEY);
        if (savedProfileId) {
          if (savedProfileId === DEFAULT_INITIAL_ADMIN.id) {
            activeProfile = DEFAULT_INITIAL_ADMIN;
          } else {
            activeProfile = profiles.find((p) => p.id === savedProfileId) || null;
            if (!activeProfile) {
              const localCreds = getLocalCredentials();
              const found = localCreds.find((c) => c.profile.id === savedProfileId);
              if (found) activeProfile = found.profile;
            }
          }
        }
      }

      setCurrentUser(activeProfile);

      if (activeProfile) {
        let targetCongId = activeProfile.congregation_id;
        const savedCongId = localStorage.getItem(SELECTED_CONG_KEY);

        if (activeProfile.role === 'super_admin' && savedCongId) {
          targetCongId = savedCongId;
        }

        let selectedCong: Congregation | null = null;
        if (targetCongId) {
          selectedCong = congs.find((c) => c.id === targetCongId) || null;
        }

        // Si la congregación objetivo no existe (ej. ID antiguo de prueba) o no está definida,
        // seleccionar automáticamente la primera congregación disponible
        if (!selectedCong && congs.length > 0) {
          selectedCong = congs[0];
          localStorage.setItem(SELECTED_CONG_KEY, congs[0].id);
        }

        setCurrentCongregation(selectedCong);
      } else {
        // Si no hay perfil activo pero hay congregaciones registradas, seleccionar la primera por defecto
        setCurrentCongregation(congs[0] || null);
      }
    } catch (err) {
      console.error('Error al inicializar sesión:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialAuth();

    // Escuchar eventos de cambio de sesión en Supabase
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data: authListener } = sb.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_OUT') {
            setCurrentUser(null);
            setCurrentCongregation(null);
            localStorage.removeItem(CURRENT_PROFILE_KEY);
            localStorage.removeItem(SELECTED_CONG_KEY);
          } else if (event === 'SIGNED_IN' && session?.user) {
            const profiles = await dataService.getProfiles();
            const matched = profiles.find(
              (p) =>
                p.email.toLowerCase() === session.user.email?.toLowerCase() ||
                p.id === session.user.id
            );
            if (matched) {
              setCurrentUser(matched);
              localStorage.setItem(CURRENT_PROFILE_KEY, matched.id);
            }
          }
        });

        return () => {
          authListener.subscription.unsubscribe();
        };
      }
    }

    const handleDataUpdate = () => {
      refreshData();
    };

    window.addEventListener('jw_data_updated', handleDataUpdate);
    return () => {
      window.removeEventListener('jw_data_updated', handleDataUpdate);
    };
  }, []);

  const refreshData = async () => {
    const congs = await dataService.getCongregations();
    setAllCongregations(congs);
    setCurrentCongregation((prev) => {
      if (!prev) {
        const savedId = localStorage.getItem(SELECTED_CONG_KEY);
        const match = savedId ? congs.find((c) => c.id === savedId) : null;
        const selected = match || congs[0] || null;
        if (selected) {
          localStorage.setItem(SELECTED_CONG_KEY, selected.id);
        }
        return selected;
      }
      const updated = congs.find((c) => c.id === prev.id);
      const selected = updated || congs[0] || null;
      if (selected) {
        localStorage.setItem(SELECTED_CONG_KEY, selected.id);
      }
      return selected;
    });
  };

  const login = async (email: string, password?: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const cleanEmail = email.toLowerCase().trim();
      const cleanPass = (password || '').trim();

      // 1. Verificación del Administrador Inicial por defecto
      if (
        cleanEmail === DEFAULT_INITIAL_ADMIN.email.toLowerCase() &&
        (cleanPass === 'admin' || cleanPass === 'admin123' || cleanPass === 'admin123456')
      ) {
        setCurrentUser(DEFAULT_INITIAL_ADMIN);
        localStorage.setItem(CURRENT_PROFILE_KEY, DEFAULT_INITIAL_ADMIN.id);
        const congs = await dataService.getCongregations();
        setCurrentCongregation(congs[0] || null);
        setIsLoading(false);
        return true;
      }

      // 2. Intentar inicio de sesión directo con Supabase Auth si está configurado
      if (isSupabaseConfigured() && cleanPass) {
        const sb = getSupabaseClient();
        if (sb) {
          const { data, error } = await sb.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPass,
          });

          if (!error && data.user) {
            const profiles = await dataService.getProfiles();
            let matched: Profile | undefined = profiles.find(
              (p) => p.email.toLowerCase() === cleanEmail || p.id === data.user.id
            );

            if (!matched) {
              matched = {
                id: data.user.id,
                user_id: data.user.id,
                congregation_id: null,
                email: cleanEmail,
                full_name: data.user.user_metadata?.full_name || cleanEmail.split('@')[0],
                role: (data.user.user_metadata?.role as UserRole) || 'super_admin',
                phone: data.user.user_metadata?.phone || '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
            }

            const activeProfile: Profile = matched;
            setCurrentUser(activeProfile);
            localStorage.setItem(CURRENT_PROFILE_KEY, activeProfile.id);

            if (activeProfile.congregation_id) {
              const cong = await dataService.getCongregation(activeProfile.congregation_id);
              setCurrentCongregation(cong);
            } else {
              const congs = await dataService.getCongregations();
              setCurrentCongregation(congs[0] || null);
            }

            setIsLoading(false);
            return true;
          }
        }
      }

      // 3. Verificación en usuarios registrados localmente
      const localCreds = getLocalCredentials();
      const localMatch = localCreds.find((c) => c.email.toLowerCase() === cleanEmail);
      if (localMatch && (!localMatch.password || localMatch.password === cleanPass)) {
        setCurrentUser(localMatch.profile);
        localStorage.setItem(CURRENT_PROFILE_KEY, localMatch.profile.id);
        if (localMatch.profile.congregation_id) {
          const cong = await dataService.getCongregation(localMatch.profile.congregation_id);
          setCurrentCongregation(cong);
        } else {
          const congs = await dataService.getCongregations();
          setCurrentCongregation(congs[0] || null);
        }
        setIsLoading(false);
        return true;
      }

      // 4. Verificación en perfiles de dataService
      const profiles = await dataService.getProfiles();
      const matched = profiles.find((p) => p.email.toLowerCase() === cleanEmail);
      if (matched) {
        setCurrentUser(matched);
        localStorage.setItem(CURRENT_PROFILE_KEY, matched.id);
        if (matched.congregation_id) {
          const cong = await dataService.getCongregation(matched.congregation_id);
          setCurrentCongregation(cong);
        } else {
          const congs = await dataService.getCongregations();
          setCurrentCongregation(congs[0] || null);
        }
        setIsLoading(false);
        return true;
      }

      setIsLoading(false);
      return false;
    } catch (e) {
      console.error('Error de autenticación:', e);
      setIsLoading(false);
      return false;
    }
  };

  const register = async (params: {
    email: string;
    password: string;
    full_name: string;
    role?: UserRole;
    congregation_id?: string | null;
    phone?: string;
  }): Promise<{ success: boolean; message?: string }> => {
    setIsLoading(true);
    try {
      const cleanEmail = params.email.toLowerCase().trim();
      const cleanName = params.full_name.trim();
      const userRole: UserRole = params.role || 'super_admin';
      const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `usr-${Date.now()}`;
      const now = new Date().toISOString();

      let supabaseUserId = newId;

      // 1. Si Supabase está configurado, registrar en Supabase Auth
      if (isSupabaseConfigured()) {
        const sb = getSupabaseClient();
        if (sb) {
          const { data, error } = await sb.auth.signUp({
            email: cleanEmail,
            password: params.password,
            options: {
              data: {
                full_name: cleanName,
                role: userRole,
              },
            },
          });

          if (error) {
            setIsLoading(false);
            return { success: false, message: error.message };
          }

          if (data.user) {
            supabaseUserId = data.user.id;
          }
        }
      }

      const newProfile: Profile = {
        id: supabaseUserId,
        user_id: supabaseUserId,
        congregation_id: params.congregation_id || null,
        role: userRole,
        full_name: cleanName,
        email: cleanEmail,
        phone: params.phone || '',
        created_at: now,
        updated_at: now,
      };

      // Guardar en Supabase o localmente
      if (isSupabaseConfigured()) {
        const sb = getSupabaseClient();
        if (sb) {
          await sb.from('profiles').insert(newProfile);
        }
      }

      saveLocalCredential({
        email: cleanEmail,
        password: params.password,
        profile: newProfile,
      });

      setCurrentUser(newProfile);
      localStorage.setItem(CURRENT_PROFILE_KEY, newProfile.id);

      if (newProfile.congregation_id) {
        const cong = await dataService.getCongregation(newProfile.congregation_id);
        setCurrentCongregation(cong);
      } else {
        const congs = await dataService.getCongregations();
        setCurrentCongregation(congs[0] || null);
      }

      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      console.error('Error al registrar usuario:', err);
      setIsLoading(false);
      return { success: false, message: err.message || 'Error al crear la cuenta' };
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        try {
          await sb.auth.signOut();
        } catch (e) {
          console.error('Error al cerrar sesión en Supabase:', e);
        }
      }
    }
    localStorage.removeItem(CURRENT_PROFILE_KEY);
    localStorage.removeItem(SELECTED_CONG_KEY);
    setCurrentUser(null);
    setCurrentCongregation(null);
  };

  const switchCongregation = async (congregationId: string) => {
    const cong = await dataService.getCongregation(congregationId);
    if (cong) {
      setCurrentCongregation(cong);
      localStorage.setItem(SELECTED_CONG_KEY, congregationId);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentCongregation,
        role: currentUser?.role || null,
        isLoading,
        login,
        register,
        logout,
        switchCongregation,
        allCongregations,
        refreshData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
