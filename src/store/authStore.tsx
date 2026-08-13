import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import * as authApi from '@/api/authApi';
import { clearStoredSession, readStoredSession, writeStoredSession } from '@/services/sessionStorage';
import type { SessionUser } from '@/types/domain';
import { ApiError } from '@/types/errors';

type SessionStatus = 'checking' | 'authenticated' | 'unauthenticated' | 'error';

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

function isUnauthorizedError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) return true;
  if (!(error instanceof Error)) return false;
  const normalized = error.message.toLowerCase();
  return normalized.includes('401') || normalized.includes('unauthorized');
}

async function clearStoredSessionSafely() {
  try {
    await clearStoredSession();
  } catch {
    // In-memory auth state must still be cleared if secure storage is unavailable.
  }
}

function mapLoginError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401 || /invalid email or password/i.test(error.message)) {
      return 'Email or password is incorrect.';
    }
    if (error.code === 'MOBILE_AUTH_UNAVAILABLE') {
      return "We couldn't sign you in. Please try again.";
    }
  }

  return "We couldn't sign you in. Please try again.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('checking');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined);
  const [warning, setWarning] = useState<string | undefined>(undefined);

  const bootstrap = useCallback(async () => {
    setStatus('checking');
    setWarning(undefined);

    try {
      let stored;
      try {
        stored = await readStoredSession();
      } catch {
        setUser(null);
        setAccessToken(undefined);
        setWarning("We couldn't restore your secure session. Please try again.");
        setStatus('error');
        return;
      }

      setAccessToken(stored.accessToken);

      if (!stored.accessToken) {
        setStatus('unauthenticated');
        return;
      }

      try {
        const session = await authApi.getSession(stored.accessToken);
        if (!session.user) {
          await clearStoredSessionSafely();
          setUser(null);
          setAccessToken(undefined);
          setWarning('Session expired. Please log in again.');
          setStatus('unauthenticated');
          return;
        }

        setUser(session.user);
        setStatus('authenticated');
      } catch (error) {
        setUser(null);
        if (isUnauthorizedError(error)) {
          await clearStoredSessionSafely();
          setAccessToken(undefined);
          setWarning('Session expired. Please log in again.');
          setStatus('unauthenticated');
          return;
        }

        setAccessToken(stored.accessToken);
        setWarning("We couldn't verify your session. Check your connection and try again.");
        setStatus('error');
      }
    } finally {
      // Bootstrap state is resolved in each success and failure branch.
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password);
      setUser(response.user);

      setAccessToken(response.accessToken);
      await writeStoredSession({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });
      setWarning(undefined);

      setStatus('authenticated');
      return { ok: true };
    } catch (error) {
      setUser(null);
      setAccessToken(undefined);
      setStatus('unauthenticated');
      return { ok: false, error: mapLoginError(error) };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout(accessToken);
    } catch {
      // Ignore logout errors and clear local session state.
    }

    await clearStoredSessionSafely();
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
  }), [status, user, accessToken, warning, bootstrap, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthStore() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthStore must be used inside AuthProvider');
  }
  return ctx;
}
