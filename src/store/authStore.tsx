import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import * as authApi from '@/api/authApi';
import { clearStoredSession, readStoredSession, writeStoredSession } from '@/services/sessionStorage';
import type { SessionUser } from '@/types/domain';

type SessionStatus = 'checking' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: SessionStatus;
  user: SessionUser | null;
  accessToken?: string;
  warning?: string;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('checking');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined);
  const [warning, setWarning] = useState<string | undefined>(undefined);

  const bootstrap = useCallback(async () => {
    setStatus('checking');
    setWarning(undefined);

    const stored = await readStoredSession();
    setAccessToken(stored.accessToken);

    if (!stored.accessToken) {
      setStatus('unauthenticated');
      return;
    }

    try {
      const session = await authApi.getSession(stored.accessToken);
      if (!session.user) {
        setStatus('unauthenticated');
        return;
      }

      setUser(session.user);
      setStatus('authenticated');
    } catch {
      await clearStoredSession();
      setUser(null);
      setAccessToken(undefined);
      setStatus('unauthenticated');
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password);
      if (!response.user) {
        setStatus('unauthenticated');
        return { ok: false, error: response.error || 'Login failed.' };
      }

      setUser(response.user);

      if (response.accessToken) {
        setAccessToken(response.accessToken);
        await writeStoredSession({
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
        });
        setWarning(undefined);
      } else {
        // Current web backend is cookie-session based; mobile token endpoint is still needed.
        setWarning('Authenticated via cookie session. Mobile secure token persistence requires backend token endpoint.');
      }

      setStatus('authenticated');
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed.';
      setStatus('unauthenticated');
      return { ok: false, error: message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout(accessToken);
    } catch {
      // Ignore logout errors and clear local session state.
    }

    await clearStoredSession();
    setUser(null);
    setAccessToken(undefined);
    setStatus('unauthenticated');
    setWarning(undefined);
  }, [accessToken]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    accessToken,
    warning,
    bootstrap,
    login,
    logout,
  }), [status, user, accessToken, warning]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthStore() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthStore must be used inside AuthProvider');
  }
  return ctx;
}
