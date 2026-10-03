import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile, Congregation, UserRole } from '../types/database';
import { dataService } from '../services/dataService';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  currentUser: Profile | null;
  currentCongregation: Congregation | null;
  role: UserRole | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  loginWithPhone: (
    phone: string,
    selectedBrotherId?: string
  ) => Promise<{
    success: boolean;
    candidates?: Array<{
      id: string;
      full_name: string;
      phone: string;
      congregation_id: string;
      congregation_name: string;
      roles_description: string;
    }>;
    message?: string;
  }>;
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
const BROTHER_SESSION_KEY = 'jw_prog_brother_session';

function hasCoordinatorAccess(profile: Profile | null | undefined): profile is Profile {
  return Boolean(
    profile &&
      (profile.role === 'super_admin' ||
        (profile.role === 'congregation_admin' && profile.congregation_id))
  );
}

async function getAuthenticatedProfile(userId: string, email?: string): Promise<Profile | null> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;

  let profile = data as Profile | null;
  if (!profile) {
    const { data: legacyProfile, error: legacyError } = await sb
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (legacyError) return null;
    profile = legacyProfile as Profile | null;
  }

  if (!profile && email) {
    const { data: emailProfile, error: emailError } = await sb
      .from('profiles')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('role', 'congregation_admin')
      .not('congregation_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (emailError) return null;
    profile = emailProfile as Profile | null;
  }

  return hasCoordinatorAccess(profile) ? profile : null;
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

      let activeProfile: Profile | null = null;

      // 1. Si Supabase está configurado, verificar sesión activa de auth
      if (isSupabaseConfigured()) {
        const sb = getSupabaseClient();
        if (sb) {
          const { data: sessionData } = await sb.auth.getSession();
          if (sessionData.session?.user) {
            activeProfile = await getAuthenticatedProfile(
              sessionData.session.user.id,
              sessionData.session.user.email
            );
            if (!activeProfile) await sb.auth.signOut();
          }
        }
      }

      // 2. Si no hay sesión de Supabase, verificar profile guardado previamente
      if (!activeProfile) {
        const savedProfileId = localStorage.getItem(CURRENT_PROFILE_KEY);
        if (savedProfileId) {
          if (savedProfileId.startsWith('brother-')) {
            const rawSession = localStorage.getItem(BROTHER_SESSION_KEY);
            if (rawSession) {
              try {
                const parsed = JSON.parse(rawSession);
                if (parsed?.profile && parsed.profile.id === savedProfileId) {
                  activeProfile = parsed.profile;
                }
              } catch (e) {
                console.error('Error al restaurar sesión de hermano:', e);
              }
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
            const matched = await getAuthenticatedProfile(session.user.id, session.user.email);
            if (matched) {
              setCurrentUser(matched);
              localStorage.setItem(CURRENT_PROFILE_KEY, matched.id);
            } else {
              setCurrentUser(null);
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

  const login = async (
    email: string,
    password?: string
  ): Promise<{ success: boolean; message?: string }> => {
    setIsLoading(true);
    try {
      const cleanEmail = email.toLowerCase().trim();
      const cleanPass = (password || '').trim();
      if (!cleanPass || !isSupabaseConfigured()) {
        return { success: false, message: 'Ingresa tu contraseña para continuar.' };
      }

      const sb = getSupabaseClient();
      const { data, error } = await sb.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPass,
      });
      if (error || !data.user) {
        return { success: false, message: 'Correo o contraseña incorrectos.' };
      }

      const matched = await getAuthenticatedProfile(data.user.id, data.user.email);
      if (!matched) {
        await sb.auth.signOut();
        return {
          success: false,
          message:
            'La contraseña es correcta, pero esta cuenta no tiene un perfil de coordinador vinculado. Ejecuta el SQL actualizado de Supabase y verifica que el correo coincida con el registrado.',
        };
      }

      setCurrentUser(matched);
      localStorage.setItem(CURRENT_PROFILE_KEY, matched.id);
      const congregation = matched.congregation_id
        ? await dataService.getCongregation(matched.congregation_id)
        : (await dataService.getCongregations())[0] || null;
      setCurrentCongregation(congregation);
      return { success: true };
    } catch (e) {
      console.error('Error de autenticación:', e);
      return { success: false, message: 'No se pudo conectar con Supabase. Intenta de nuevo.' };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (params: {
    email: string;
    password: string;
    full_name: string;
    congregation_id?: string | null;
    phone?: string;
  }): Promise<{ success: boolean; message?: string }> => {
    setIsLoading(true);
    try {
      const cleanEmail = params.email.toLowerCase().trim();
      const cleanName = params.full_name.trim();
      const userRole: UserRole = 'congregation_admin';
      if (!params.congregation_id) {
        setIsLoading(false);
        return { success: false, message: 'Selecciona una congregación para continuar.' };
      }
      if (!isSupabaseConfigured()) {
        setIsLoading(false);
        return { success: false, message: 'La autenticación segura no está configurada.' };
      }
      const sb = getSupabaseClient();
      const { data, error } = await sb.auth.signUp({
        email: cleanEmail,
        password: params.password,
        options: {
          data: {
            full_name: cleanName,
            role: userRole,
            congregation_id: params.congregation_id,
            phone: params.phone || '',
          },
        },
      });
      if (error || !data.user) {
        setIsLoading(false);
        return { success: false, message: error?.message || 'No se pudo crear la cuenta.' };
      }

      if (data.session) {
        const newProfile = await getAuthenticatedProfile(data.user.id, data.user.email);
        if (!newProfile) {
          setIsLoading(false);
          return {
            success: false,
            message: 'La cuenta se creó, pero no pudo vincularse a una congregación activa.',
          };
        }
        setCurrentUser(newProfile);
        localStorage.setItem(CURRENT_PROFILE_KEY, newProfile.id);
        const congregation = await dataService.getCongregation(params.congregation_id);
        setCurrentCongregation(congregation);
      } else {
        setIsLoading(false);
        return {
          success: true,
          message: 'Cuenta creada. Confirma tu correo electrónico antes de iniciar sesión.',
        };
      }

      setIsLoading(false);
      return { success: true, message: 'Cuenta creada e inicio de sesión exitoso.' };
    } catch (err: any) {
      console.error('Error al registrar usuario:', err);
      setIsLoading(false);
      return { success: false, message: err.message || 'Error al crear la cuenta' };
    }
  };

  const loginWithPhone = async (
    phone: string,
    selectedBrotherId?: string
  ): Promise<{
    success: boolean;
    candidates?: Array<{
      id: string;
      full_name: string;
      phone: string;
      congregation_id: string;
      congregation_name: string;
      roles_description: string;
    }>;
    message?: string;
  }> => {
    setIsLoading(true);
    try {
      const candidates = await dataService.findBrothersByPhone(phone);
      if (candidates.length === 0) {
        setIsLoading(false);
        return {
          success: false,
          message: 'No se encontró ningún lector, presidente o discursante registrado con este número.',
        };
      }

      let selected = candidates[0];
      if (selectedBrotherId) {
        const match = candidates.find((c) => c.id === selectedBrotherId);
        if (match) selected = match;
      } else if (candidates.length > 1) {
        setIsLoading(false);
        return {
          success: false,
          candidates,
          message: 'Se encontraron varios hermanos registrados con este número. Por favor selecciona tu nombre.',
        };
      }

      const congs = await dataService.getCongregations();
      const targetCong = congs.find((c) => c.id === selected.congregation_id) || null;

      const brotherProfile: Profile = {
        id: `brother-${selected.id}`,
        user_id: `brother-${selected.id}`,
        congregation_id: selected.congregation_id,
        role: 'brother_viewer',
        full_name: selected.full_name,
        email: `${selected.phone}@participante.jw`,
        phone: selected.phone,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setCurrentUser(brotherProfile);
      setCurrentCongregation(targetCong);
      localStorage.setItem(CURRENT_PROFILE_KEY, brotherProfile.id);
      localStorage.setItem(SELECTED_CONG_KEY, selected.congregation_id);
      localStorage.setItem(
        BROTHER_SESSION_KEY,
        JSON.stringify({ profile: brotherProfile, congregation: targetCong, brother: selected })
      );

      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      console.error('Error en loginWithPhone:', err);
      setIsLoading(false);
      return { success: false, message: err.message || 'Error al autenticar por teléfono' };
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
    localStorage.removeItem(BROTHER_SESSION_KEY);
    setCurrentUser(null);
    setCurrentCongregation(null);
  };

  const switchCongregation = async (congregationId: string) => {
    // Si el usuario es un hermano participante, no puede cambiar de congregación
    if (currentUser?.role === 'brother_viewer') return;

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
        loginWithPhone,
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
