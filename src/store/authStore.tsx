import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import * as authApi from '@/api/authApi';
import { clearStoredSession, readStoredSession, writeStoredSession } from '@/services/sessionStorage';
import type { MobileCapabilities } from '@/types/api';
import type { SessionUser } from '@/types/domain';
import { ApiError } from '@/types/errors';

type SessionStatus = 'checking' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: SessionStatus;
  user: SessionUser | null;
  accessToken?: string;
  capabilities?: MobileCapabilities;
  warning?: string;
  bootstrap: () => Promise<void>;
  syncCapabilities: (next?: MobileCapabilities) => void;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isUnauthorizedError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const normalized = error.message.toLowerCase();
  return normalized.includes('401') || normalized.includes('unauthorized');
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

function normalizeCapabilities(next?: MobileCapabilities): MobileCapabilities {
  return {
    paidDriveTime: next?.paidDriveTime === true,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('checking');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined);
  const [capabilities, setCapabilities] = useState<MobileCapabilities | undefined>(undefined);
  const [warning, setWarning] = useState<string | undefined>(undefined);

  const syncCapabilities = useCallback((next?: MobileCapabilities) => {
    setCapabilities(normalizeCapabilities(next));
  }, []);

  const bootstrap = useCallback(async () => {
    setStatus('checking');
    setWarning(undefined);

    const stored = await readStoredSession();
    setAccessToken(stored.accessToken);

    if (!stored.accessToken) {
      setCapabilities(undefined);
      setStatus('unauthenticated');
      return;
    }

    try {
      const session = await authApi.getSession(stored.accessToken);
      if (!session.user) {
        await clearStoredSession();
        setUser(null);
        setAccessToken(undefined);
        setCapabilities(undefined);
        setStatus('unauthenticated');
        return;
      }

      setUser(session.user);
      syncCapabilities(session.capabilities);
      setStatus('authenticated');
    } catch (error) {
      await clearStoredSession();
      setUser(null);
      setAccessToken(undefined);
      setCapabilities(undefined);
      if (isUnauthorizedError(error)) {
        setWarning('Session expired. Please log in again.');
      }
      setStatus('unauthenticated');
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password);
      setUser(response.user);
      syncCapabilities(response.capabilities);

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
      setCapabilities(undefined);
      setStatus('unauthenticated');
      return { ok: false, error: mapLoginError(error) };
    }
  }, [syncCapabilities]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout(accessToken);
    } catch {
      // Ignore logout errors and clear local session state.
    }

    await clearStoredSession();
    setUser(null);
    setAccessToken(undefined);
    setCapabilities(undefined);
    setStatus('unauthenticated');
    setWarning(undefined);
  }, [accessToken]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    accessToken,
    capabilities,
    warning,
    bootstrap,
    syncCapabilities,
    login,
    logout,
  }), [status, user, accessToken, capabilities, warning, bootstrap, syncCapabilities, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthStore() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthStore must be used inside AuthProvider');
  }
  return ctx;
}
