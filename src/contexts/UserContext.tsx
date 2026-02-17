import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getAuthToken, authFetch } from '../lib/api';

export type Locale = 'en' | 'am';

export interface UserProfile {
  id: number;
  email: string;
  first_name: string;
  onboarding_completed: boolean;
  certificate_section_collapsed?: boolean;
  tradingview_username?: string;
  indicator_access_status?: string;
  indicator_requested_at?: string | null;
  indicator_rejected_reason?: string | null;
  indicator_rejected_at?: string | null;
  locale: Locale;
}

interface UserContextType {
  profile: UserProfile | null;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  refetch: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const refetch = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setProfile(null);
      return;
    }
    try {
      const res = await authFetch('/api/me');
      if (res.status === 401) {
        // JWT expired or invalid – clear token and mark session as expired for UX
        if (typeof window !== 'undefined') {
          try {
            window.sessionStorage.setItem('session_expired', '1');
          } catch {
            // ignore
          }
        }
        localStorage.removeItem('auth_token');
        setProfile(null);
        return;
      }
      if (!res.ok) {
        setProfile(null);
        return;
      }
      const data = await res.json();
      const locale: Locale = data.locale === 'am' ? 'am' : 'en';
      setProfile({
        id: data.id,
        email: data.email,
        first_name: data.first_name || '',
        onboarding_completed: data.onboarding_completed === true,
        certificate_section_collapsed: data.certificate_section_collapsed === true,
        tradingview_username: data.tradingview_username || '',
        indicator_access_status: data.indicator_access_status || 'none',
        indicator_requested_at: data.indicator_requested_at ?? null,
        indicator_rejected_reason: data.indicator_rejected_reason ?? null,
        indicator_rejected_at: data.indicator_rejected_at ?? null,
        locale,
      });
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    if (getAuthToken()) {
      refetch();
    } else {
      setProfile(null);
    }
  }, [refetch]);

  const value: UserContextType = { profile, setProfile, refetch };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  const ctx = useContext(UserContext);
  if (ctx === undefined) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
