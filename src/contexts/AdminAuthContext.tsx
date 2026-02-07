import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';
const STORAGE_KEY = 'adminSession';

interface AdminSession {
  token: string;
  expiresAt: string;
}

interface AdminAuthContextType {
  token: string | null;
  expiresAt: string | null;
  isValid: boolean;
  requestCode: (password: string) => Promise<{ success: boolean; emailMasked?: string; setupRequired?: boolean; otpauthUrl?: string; error?: string }>;
  verify: (email: string, code: string, rememberMe?: boolean, rememberDuration?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  fetchWithAdminAuth: (url: string, opts?: RequestInit) => Promise<Response>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

function loadSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AdminSession;
    if (!data.token || !data.expiresAt) return null;
    if (new Date(data.expiresAt) <= new Date()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function saveSession(token: string, expiresAt: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, expiresAt }));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(loadSession);

  const isValid = useMemo(() => {
    if (!session?.token || !session?.expiresAt) return false;
    return new Date(session.expiresAt) > new Date();
  }, [session]);

  const requestCode = useCallback(async (password: string): Promise<{ success: boolean; emailMasked?: string; setupRequired?: boolean; otpauthUrl?: string; error?: string }> => {
    try {
      const res = await fetch(`${API_URL}/api/admin-auth/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Invalid secret password' };
      }
      return {
        success: true,
        emailMasked: data.emailMasked,
        setupRequired: data.setupRequired,
        otpauthUrl: data.otpauthUrl
      };
    } catch (e) {
      return { success: false, error: 'Request failed' };
    }
  }, []);

  const verify = useCallback(async (
    email: string,
    code: string,
    rememberMe?: boolean,
    rememberDuration?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_URL}/api/admin-auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          rememberMe: !!rememberMe,
          rememberDuration: rememberDuration || '1h'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Invalid or expired code' };
      }
      saveSession(data.token, data.expiresAt);
      setSession({ token: data.token, expiresAt: data.expiresAt });
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Verification failed' };
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const fetchWithAdminAuth = useCallback(async (url: string, opts: RequestInit = {}): Promise<Response> => {
    const session = loadSession();
    const token = session?.token;
    const headers = new Headers(opts.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const res = await fetch(url, { ...opts, headers });
    if (res.status === 401) {
      clearSession();
      setSession(null);
    }
    return res;
  }, []);

  const value: AdminAuthContextType = useMemo(() => ({
    token: session?.token ?? null,
    expiresAt: session?.expiresAt ?? null,
    isValid,
    requestCode,
    verify,
    logout,
    fetchWithAdminAuth
  }), [session, isValid, requestCode, verify, logout, fetchWithAdminAuth]);

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (ctx === undefined) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return ctx;
}
