import * as SecureStore from 'expo-secure-store';
import { recordStartupCheckpoint } from '@/services/startupDiagnostics';

const ACCESS_TOKEN_KEY = 'oliveops.accessToken';
const REFRESH_TOKEN_KEY = 'oliveops.refreshToken';

export interface StoredSession {
  accessToken?: string;
  refreshToken?: string;
}

export class SecureSessionStorageError extends Error {
  constructor(operation: 'read' | 'write' | 'clear') {
    super(`Secure session storage ${operation} failed.`);
    this.name = 'SecureSessionStorageError';
  }
}

async function runSecureStoreOperation<T>(
  operation: 'read' | 'write' | 'clear',
  action: () => Promise<T>
): Promise<T> {
  try {
    return await action();
  } catch {
    throw new SecureSessionStorageError(operation);
  }
}

export async function readStoredSession(): Promise<StoredSession> {
  recordStartupCheckpoint('SECURE_STORE_READ_START');

  try {
    const [accessToken, refreshToken] = await Promise.all([
      runSecureStoreOperation('read', () => SecureStore.getItemAsync(ACCESS_TOKEN_KEY)),
      runSecureStoreOperation('read', () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY)),
    ]);

    recordStartupCheckpoint('SECURE_STORE_READ_SUCCESS');

    return {
      accessToken: accessToken || undefined,
      refreshToken: refreshToken || undefined,
    };
  } catch (error) {
    recordStartupCheckpoint('SECURE_STORE_READ_FAILED');
    throw error;
  }
}

export async function writeStoredSession(next: StoredSession): Promise<void> {
  if (next.accessToken) {
    await runSecureStoreOperation('write', () =>
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, next.accessToken!)
    );
  }
  if (next.refreshToken) {
    await runSecureStoreOperation('write', () =>
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, next.refreshToken!)
    );
  }
}

export async function clearStoredSession(): Promise<void> {
  await Promise.all([
    runSecureStoreOperation('clear', () => SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY)),
    runSecureStoreOperation('clear', () => SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)),
  ]);
}
