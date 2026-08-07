import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

import { clearStoredSession, readStoredSession, writeStoredSession } from '@/services/sessionStorage';

describe('sessionStorage', () => {
  beforeEach(() => {
    mockStore.clear();
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
});
