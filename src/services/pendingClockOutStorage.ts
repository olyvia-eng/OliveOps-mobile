import * as SQLite from 'expo-sqlite';
import type { PendingClockOutWorkflow } from '@/types/api';
import type { SubmitEmployeeFormRequest } from '@/types/forms';

const DATABASE_NAME = 'oliveops-offline-clock.db';
let databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;

export type QueuedRequiredFormSubmission = {
  workflowOccurrenceId: string;
  workflowRequirementId: string;
  payload: SubmitEmployeeFormRequest;
  queuedAt: string;
};

export type PendingClockOutRecord = {
  workflow: PendingClockOutWorkflow;
  submissionIds: Record<string, string>;
  queuedSubmissions: QueuedRequiredFormSubmission[];
};

async function database() {
  if (!databasePromise) databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  const db = await databasePromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS pending_clock_out_workflows (
      identity_key TEXT PRIMARY KEY NOT NULL,
      updated_at TEXT NOT NULL,
      record_json TEXT NOT NULL
    );
  `);
  return db;
}

export async function loadPendingClockOutRecord(identityKey: string): Promise<PendingClockOutRecord | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ record_json: string }>(
    'SELECT record_json FROM pending_clock_out_workflows WHERE identity_key = ?',
    identityKey,
  );
  return row ? JSON.parse(row.record_json) as PendingClockOutRecord : null;
}

export async function savePendingClockOutRecord(identityKey: string, record: PendingClockOutRecord) {
  const db = await database();
  await db.runAsync(
    `INSERT INTO pending_clock_out_workflows (identity_key, updated_at, record_json)
     VALUES (?, ?, ?)
     ON CONFLICT(identity_key) DO UPDATE SET
       updated_at = excluded.updated_at,
       record_json = excluded.record_json`,
    identityKey,
    new Date().toISOString(),
    JSON.stringify(record),
  );
}

export async function clearPendingClockOutRecord(identityKey: string) {
  const db = await database();
  await db.runAsync('DELETE FROM pending_clock_out_workflows WHERE identity_key = ?', identityKey);
}

export function resetPendingClockOutStorageForTests() {
  databasePromise = null;
}