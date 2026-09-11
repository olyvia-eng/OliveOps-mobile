import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { SopCache } from '@/types/sop';

const caches = new Map<string, string>();
const mockDatabase = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  runAsync: jest.fn(async (_sql: string, identityKey: string, _updatedAt: string, cacheJson: string) => {
    caches.set(identityKey, cacheJson);
    return { changes: 1 };
  }),
  getFirstAsync: jest.fn(async (_sql: string, identityKey: string) => {
    const cacheJson = caches.get(identityKey);
    return cacheJson ? { cache_json: cacheJson } : null;
  }),
};

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(async () => mockDatabase) }));

import { loadSopCache, resetSopCacheStorageForTests, saveSopCache } from './sopCacheStorage';

function cache(identityKey: string): SopCache {
  return { identityKey, updatedAt: '2026-09-01T12:00:00.000Z', sops: [{
    sopId: 'sop-1', businessId: identityKey.split(':')[0], version: 1, title: 'Lockout', category: 'Safety',
    shortDescription: 'Isolation', purpose: 'Prevent startup', instructions: 'Stop and isolate.', safetyInformation: 'Wear PPE.',
    attachmentFileIds: ['file-1'], publishedAt: '2026-09-01T12:00:00.000Z', publishedBy: 'admin-1',
  }] };
}

describe('SOP cache persistence', () => {
  beforeEach(() => { caches.clear(); resetSopCacheStorageForTests(); });

  it('restores cached immutable SOP snapshots only for the exact identity', async () => {
    const saved = cache('biz-a:user-a:emp-a');
    await saveSopCache(saved);
    expect(await loadSopCache('biz-a:user-a:emp-a')).toEqual(saved);
    expect(await loadSopCache('biz-b:user-a:emp-a')).toBeNull();
  });

  it('fails closed when persisted JSON is invalid', async () => {
    caches.set('biz-a:user-a:emp-a', '{bad json');
    await expect(loadSopCache('biz-a:user-a:emp-a')).resolves.toBeNull();
  });
});