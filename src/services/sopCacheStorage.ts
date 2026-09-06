import * as SQLite from 'expo-sqlite';
import type { SopCache } from '@/types/sop';

const DATABASE_NAME = 'oliveops-offline-clock.db';
let databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;

async function database() {
  if (!databasePromise) databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  const db = await databasePromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sop_cache (
      identity_key TEXT PRIMARY KEY NOT NULL,
      updated_at TEXT NOT NULL,
      cache_json TEXT NOT NULL
    );
  `);
  return db;
}

export async function loadSopCache(identityKey: string): Promise<SopCache | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ cache_json: string }>('SELECT cache_json FROM sop_cache WHERE identity_key = ?', identityKey);
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.cache_json) as SopCache;
    return parsed.identityKey === identityKey && Array.isArray(parsed.sops) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveSopCache(cache: SopCache): Promise<void> {
  const db = await database();
  await db.runAsync(
    `INSERT INTO sop_cache (identity_key, updated_at, cache_json) VALUES (?, ?, ?)
     ON CONFLICT(identity_key) DO UPDATE SET updated_at = excluded.updated_at, cache_json = excluded.cache_json`,
    cache.identityKey,
    cache.updatedAt,
    JSON.stringify(cache),
  );
}

export function resetSopCacheStorageForTests() { databasePromise = null; }