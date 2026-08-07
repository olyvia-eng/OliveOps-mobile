import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    store.delete(key);
  }),
}));

import { clearStoredSession, readStoredSession, writeStoredSession } from '@/services/sessionStorage';

describe('sessionStorage', () => {
  beforeEach(() => {
    store.clear();
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
