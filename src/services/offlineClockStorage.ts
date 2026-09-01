import * as SQLite from 'expo-sqlite';
import type { OfflineClockCache, OfflineClockCommand, OfflineShiftMapping } from '@/features/offlineClocking/types';
import { SUPPORTED_OFFLINE_CLOCK_SCHEMA_VERSIONS } from '@/features/offlineClocking/types';

const DATABASE_NAME = 'oliveops-offline-clock.db';
let databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;

function storageCommandId(identityKey: string, commandId: string) {
  return `${identityKey}:${commandId}`;
}

async function database() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }
  const db = await databasePromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS offline_clock_commands (
      id TEXT PRIMARY KEY NOT NULL,
      identity_key TEXT NOT NULL,
      queued_at TEXT NOT NULL,
      status TEXT NOT NULL,
      command_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS offline_clock_commands_identity_order
      ON offline_clock_commands(identity_key, queued_at, id);
    CREATE TABLE IF NOT EXISTS offline_clock_shift_mappings (
      identity_key TEXT NOT NULL,
      local_shift_id TEXT NOT NULL,
      server_entry_id TEXT NOT NULL,
      PRIMARY KEY(identity_key, local_shift_id)
    );
    CREATE TABLE IF NOT EXISTS offline_clock_cache (
      identity_key TEXT PRIMARY KEY NOT NULL,
      updated_at TEXT NOT NULL,
      cache_json TEXT NOT NULL
    );
  `);
  return db;
}

export async function loadOfflineCommands(identityKey: string): Promise<OfflineClockCommand[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ command_json: string }>(
    `SELECT command_json FROM offline_clock_commands
     WHERE identity_key = ? AND status != 'synced'
     ORDER BY queued_at ASC, id ASC`,
    identityKey,
  );
  const commands = rows.map((row) => JSON.parse(row.command_json) as OfflineClockCommand);
  for (const command of commands) {
    if (SUPPORTED_OFFLINE_CLOCK_SCHEMA_VERSIONS.has(command.schemaVersion)) continue;
    const attention = {
      ...command,
      status: 'needs_attention' as const,
      lastErrorCategory: 'offline_queue_schema_unsupported',
    };
    await db.runAsync(
      `UPDATE offline_clock_commands SET status = 'needs_attention', command_json = ?
       WHERE id = ? AND identity_key = ?`,
      JSON.stringify(attention),
      command.id,
      identityKey,
    );
    Object.assign(command, attention);
  }
  return commands;
}

export async function insertOfflineCommand(command: OfflineClockCommand) {
  const db = await database();
  await db.runAsync(
    `INSERT OR IGNORE INTO offline_clock_commands
      (id, identity_key, queued_at, status, command_json)
     VALUES (?, ?, ?, ?, ?)`,
    storageCommandId(command.identityKey, command.id),
    command.identityKey,
    command.queuedAt,
    command.status,
    JSON.stringify(command),
  );
}

export async function updateOfflineCommand(command: OfflineClockCommand) {
  const db = await database();
  await db.runAsync(
    `UPDATE offline_clock_commands SET status = ?, command_json = ?
     WHERE id IN (?, ?) AND identity_key = ?`,
    command.status,
    JSON.stringify(command),
    storageCommandId(command.identityKey, command.id),
    command.id,
    command.identityKey,
  );
}

export async function completeOfflineCommand(
  command: OfflineClockCommand,
  mapping?: OfflineShiftMapping,
) {
  const db = await database();
  await db.withTransactionAsync(async () => {
    if (mapping) {
      await db.runAsync(
        `INSERT INTO offline_clock_shift_mappings (identity_key, local_shift_id, server_entry_id)
         VALUES (?, ?, ?)
         ON CONFLICT(identity_key, local_shift_id)
         DO UPDATE SET server_entry_id = excluded.server_entry_id`,
        mapping.identityKey,
        mapping.localShiftId,
        mapping.serverEntryId,
      );
    }
    const synced = { ...command, status: 'synced' as const };
    await db.runAsync(
      `UPDATE offline_clock_commands SET status = 'synced', command_json = ?
       WHERE id IN (?, ?) AND identity_key = ?`,
      JSON.stringify(synced),
      storageCommandId(command.identityKey, command.id),
      command.id,
      command.identityKey,
    );
  });
}

export async function completeOfflineShiftCommands(commands: OfflineClockCommand[]) {
  if (commands.length === 0) return;
  const db = await database();
  await db.withTransactionAsync(async () => {
    for (const command of commands) {
      const synced = { ...command, status: 'synced' as const };
      await db.runAsync(
        `UPDATE offline_clock_commands SET status = 'synced', command_json = ?
         WHERE id IN (?, ?) AND identity_key = ?`,
        JSON.stringify(synced),
        storageCommandId(command.identityKey, command.id),
        command.id,
        command.identityKey,
      );
    }
  });
}

export async function loadShiftMapping(identityKey: string, localShiftId: string) {
  const db = await database();
  const row = await db.getFirstAsync<{ server_entry_id: string }>(
    `SELECT server_entry_id FROM offline_clock_shift_mappings
     WHERE identity_key = ? AND local_shift_id = ?`,
    identityKey,
    localShiftId,
  );
  return row?.server_entry_id;
}

export async function saveOfflineClockCache(cache: OfflineClockCache) {
  const db = await database();
  await db.runAsync(
    `INSERT INTO offline_clock_cache (identity_key, updated_at, cache_json)
     VALUES (?, ?, ?)
     ON CONFLICT(identity_key) DO UPDATE SET
       updated_at = excluded.updated_at,
       cache_json = excluded.cache_json`,
    cache.identityKey,
    cache.updatedAt,
    JSON.stringify(cache),
  );
}

export async function loadOfflineClockCache(identityKey: string): Promise<OfflineClockCache | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ cache_json: string }>(
    'SELECT cache_json FROM offline_clock_cache WHERE identity_key = ?',
    identityKey,
  );
  return row ? JSON.parse(row.cache_json) as OfflineClockCache : null;
}

export function resetOfflineClockStorageForTests() {
  databasePromise = null;
}
