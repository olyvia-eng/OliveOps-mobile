import * as SQLite from 'expo-sqlite';
import type { PendingClockInWorkflow } from '@/types/api';
import type { SubmitEmployeeFormRequest } from '@/types/forms';

const DATABASE_NAME = 'oliveops-offline-clock.db';
let databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;

export type PendingClockInRecord = {
  workflow: PendingClockInWorkflow;
  submissionIds: Record<string, string>;
  queuedSubmissions: SubmitEmployeeFormRequest[];
};

async function database() {
  if (!databasePromise) databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  const db = await databasePromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS pending_clock_in_workflows (
      identity_key TEXT PRIMARY KEY NOT NULL,
      updated_at TEXT NOT NULL,
      record_json TEXT NOT NULL
    );
  `);
  return db;
}

export async function loadPendingClockInRecord(identityKey: string): Promise<PendingClockInRecord | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ record_json: string }>(
    'SELECT record_json FROM pending_clock_in_workflows WHERE identity_key = ?',
    identityKey,
  );
  return row ? JSON.parse(row.record_json) as PendingClockInRecord : null;
}

export async function savePendingClockInRecord(identityKey: string, record: PendingClockInRecord) {
  const db = await database();
  await db.runAsync(
    `INSERT INTO pending_clock_in_workflows (identity_key, updated_at, record_json)
     VALUES (?, ?, ?)
     ON CONFLICT(identity_key) DO UPDATE SET updated_at = excluded.updated_at, record_json = excluded.record_json`,
    identityKey,
    new Date().toISOString(),
    JSON.stringify(record),
  );
}

export async function clearPendingClockInRecord(identityKey: string) {
  const db = await database();
  await db.runAsync('DELETE FROM pending_clock_in_workflows WHERE identity_key = ?', identityKey);
}

export function resetPendingClockInStorageForTests() {
  databasePromise = null;
}