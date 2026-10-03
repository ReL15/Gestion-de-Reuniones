import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile, Congregation, UserRole } from '../types/database';
import { dataService } from '../services/dataService';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  currentUser: Profile | null;
  currentCongregation: Congregation | null;
  role: UserRole | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
  switchCongregation: (congregationId: string) => Promise<void>;
  quickLoginAs: (profileId: string) => Promise<void>;
  allCongregations: Congregation[];
  refreshData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_PROFILE_KEY = 'jw_prog_active_profile_id';
const SELECTED_CONG_KEY = 'jw_prog_selected_cong_id';

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
      const savedProfileId = localStorage.getItem(CURRENT_PROFILE_KEY);

      let activeProfile: Profile | null = null;
      if (savedProfileId) {
        activeProfile = profiles.find((p) => p.id === savedProfileId) || null;
      }

      // Default to Congregation Central Admin if none stored
      if (!activeProfile) {
        activeProfile = profiles.find((p) => p.role === 'congregation_admin') || profiles[0] || null;
        if (activeProfile) {
          localStorage.setItem(CURRENT_PROFILE_KEY, activeProfile.id);
        }
      }

      setCurrentUser(activeProfile);

      if (activeProfile) {
        let targetCongId = activeProfile.congregation_id;
        const savedCongId = localStorage.getItem(SELECTED_CONG_KEY);

        // If super admin and saved another congregation, use it
        if (activeProfile.role === 'super_admin' && savedCongId) {
          targetCongId = savedCongId;
        }

        if (targetCongId) {
          const cong = congs.find((c) => c.id === targetCongId) || null;
          setCurrentCongregation(cong);
        } else if (congs.length > 0) {
          setCurrentCongregation(congs[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load auth initial state:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialAuth();

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
    if (currentCongregation) {
      const updated = congs.find((c) => c.id === currentCongregation.id);
      if (updated) setCurrentCongregation(updated);
    }
  };

  const login = async (email: string, password?: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // If live Supabase client configured, attempt auth sign in
      if (isSupabaseConfigured() && password) {
        const sb = getSupabaseClient();
        if (sb) {
          const { data, error } = await sb.auth.signInWithPassword({ email, password });
          if (!error && data.user) {
            // Find or load profile
            const profiles = await dataService.getProfiles();
            const matched = profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
            if (matched) {
              setCurrentUser(matched);
              localStorage.setItem(CURRENT_PROFILE_KEY, matched.id);
              if (matched.congregation_id) {
                const cong = await dataService.getCongregation(matched.congregation_id);
                setCurrentCongregation(cong);
              }
              setIsLoading(false);
              return true;
            }
          }
        }
      }

      // Fallback local match
      const profiles = await dataService.getProfiles();
      const matched = profiles.find((p) => p.email.toLowerCase() === email.toLowerCase().trim());
      if (matched) {
        setCurrentUser(matched);
        localStorage.setItem(CURRENT_PROFILE_KEY, matched.id);
        if (matched.congregation_id) {
          const cong = await dataService.getCongregation(matched.congregation_id);
          setCurrentCongregation(cong);
        } else {
          // Super admin: default to first congregation
          const congs = await dataService.getCongregations();
          setCurrentCongregation(congs[0] || null);
        }
        setIsLoading(false);
        return true;
      }

      setIsLoading(false);
      return false;
    } catch (e) {
      console.error('Login error:', e);
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
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

  const quickLoginAs = async (profileId: string) => {
    const profiles = await dataService.getProfiles();
    const matched = profiles.find((p) => p.id === profileId);
    if (matched) {
      setCurrentUser(matched);
      localStorage.setItem(CURRENT_PROFILE_KEY, matched.id);
      if (matched.congregation_id) {
        const cong = await dataService.getCongregation(matched.congregation_id);
        setCurrentCongregation(cong);
        if (cong) localStorage.setItem(SELECTED_CONG_KEY, cong.id);
      } else {
        const congs = await dataService.getCongregations();
        setCurrentCongregation(congs[0] || null);
      }
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
        logout,
        switchCongregation,
        quickLoginAs,
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
