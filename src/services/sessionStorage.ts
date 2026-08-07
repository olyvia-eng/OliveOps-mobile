import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'oliveops.accessToken';
const REFRESH_TOKEN_KEY = 'oliveops.refreshToken';

export interface StoredSession {
  accessToken?: string;
  refreshToken?: string;
}

export async function readStoredSession(): Promise<StoredSession> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);

  return {
    accessToken: accessToken || undefined,
    refreshToken: refreshToken || undefined,
  };
}

export async function writeStoredSession(next: StoredSession): Promise<void> {
  if (next.accessToken) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, next.accessToken);
  }
  if (next.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, next.refreshToken);
  }
}

export async function clearStoredSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}
