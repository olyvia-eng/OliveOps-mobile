import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockStore = new Map<string, string>();
const mockGetItemAsync = jest.fn(async (key: string) => mockStore.get(key) ?? null);
const mockSetItemAsync = jest.fn(async (key: string, value: string) => {
  mockStore.set(key, value);
});
const mockDeleteItemAsync = jest.fn(async (key: string) => {
  mockStore.delete(key);
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: [string]) => mockGetItemAsync(...args),
  setItemAsync: (...args: [string, string]) => mockSetItemAsync(...args),
  deleteItemAsync: (...args: [string]) => mockDeleteItemAsync(...args),
}));

import {
  clearStoredSession,
  readStoredSession,
  SecureSessionStorageError,
  writeStoredSession,
} from '@/services/sessionStorage';

describe('sessionStorage', () => {
  beforeEach(() => {
    mockStore.clear();
    mockGetItemAsync.mockClear();
    mockSetItemAsync.mockClear();
    mockDeleteItemAsync.mockClear();
  });

  it('writes and restores persisted secure session', async () => {
    await writeStoredSession({ accessToken: 'a1', refreshToken: 'r1' });
    await expect(readStoredSession()).resolves.toEqual({ accessToken: 'a1', refreshToken: 'r1' });
  });

  it('clears secure session on logout', async () => {
    await writeStoredSession({ accessToken: 'a1', refreshToken: 'r1' });
    await clearStoredSession();
    await expect(readStoredSession()).resolves.toEqual({ accessToken: undefined, refreshToken: undefined });
  });

  it('converts a SecureStore read failure into a sanitized recoverable error', async () => {
    mockGetItemAsync.mockRejectedValueOnce(new Error('native keychain details'));

    await expect(readStoredSession()).rejects.toEqual(new SecureSessionStorageError('read'));
  });

  it('never logs stored session values', async () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    mockStore.set('oliveops.accessToken', 'secret-access-token');
    mockStore.set('oliveops.refreshToken', 'secret-refresh-token');

    await readStoredSession();

    const loggedOutput = JSON.stringify(consoleSpy.mock.calls);
    expect(loggedOutput).not.toContain('secret-access-token');
    expect(loggedOutput).not.toContain('secret-refresh-token');
    consoleSpy.mockRestore();
  });
});
