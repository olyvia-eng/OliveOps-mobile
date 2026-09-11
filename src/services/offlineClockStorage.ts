import * as SQLite from 'expo-sqlite';
import type { OfflineClockCache, OfflineClockCommand, OfflineShiftMapping } from '@/features/offlineClocking/types';
import { OFFLINE_CLOCK_CACHE_SCHEMA_VERSION, SUPPORTED_OFFLINE_CLOCK_SCHEMA_VERSIONS } from '@/features/offlineClocking/types';
import type { Job } from '@/types/domain';

const DATABASE_NAME = 'oliveops-offline-clock.db';
let databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;

const JOB_STATUSES = new Set<Job['status']>(['scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled']);
const LEGACY_CACHE_SCHEMA_VERSIONS = new Set([1, 2, 3, OFFLINE_CLOCK_CACHE_SCHEMA_VERSION]);

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function normalizeCachedJob(value: unknown): OfflineClockCache['jobs'][number] | null {
  if (!value || typeof value !== 'object') return null;
  const job = value as Record<string, unknown>;
  if (typeof job.id !== 'string' || typeof job.title !== 'string' || !JOB_STATUSES.has(job.status as Job['status'])) return null;
  const eligibleOperationalWorkAreas = Array.isArray(job.eligibleOperationalWorkAreas)
    ? job.eligibleOperationalWorkAreas.flatMap((value) => {
        if (!value || typeof value !== 'object') return [];
        const workArea = value as Record<string, unknown>;
        if (typeof workArea.id !== 'string' || typeof workArea.name !== 'string') return [];
        return [{
          id: workArea.id,
          name: workArea.name,
          status: workArea.status === 'in_progress' ? 'in_progress' as const : 'not_started' as const,
        }];
      })
    : undefined;

  return {
    id: job.id,
    title: job.title,
    status: job.status as Job['status'],
    assignedEmployeeIds: stringArray(job.assignedEmployeeIds),
    assignedForemanId: typeof job.assignedForemanId === 'string' || job.assignedForemanId === null
      ? job.assignedForemanId
      : undefined,
    assignedCrewEmployeeIds: stringArray(job.assignedCrewEmployeeIds),
    scheduledToday: job.scheduledToday === true,
    customerName: optionalString(job.customerName),
    propertyAddress: optionalString(job.propertyAddress),
    jobNumber: optionalString(job.jobNumber),
    hasOperationalWorkAreas: typeof job.hasOperationalWorkAreas === 'boolean' ? job.hasOperationalWorkAreas : undefined,
    eligibleOperationalWorkAreas,
  };
}

function normalizeOfflineClockCache(value: unknown, identityKey: string): OfflineClockCache | null {
  if (!value || typeof value !== 'object') return null;
  const cache = value as Record<string, unknown>;
  if (!LEGACY_CACHE_SCHEMA_VERSIONS.has(cache.schemaVersion as number) || cache.identityKey !== identityKey || !Array.isArray(cache.jobs)) return null;
  if (!Array.isArray(cache.unbillableCategories)) return null;

  return {
    schemaVersion: OFFLINE_CLOCK_CACHE_SCHEMA_VERSION,
    identityKey,
    updatedAt: typeof cache.updatedAt === 'string' ? cache.updatedAt : new Date(0).toISOString(),
    jobs: cache.jobs.flatMap((job) => normalizeCachedJob(job) ?? []),
    unbillableCategories: cache.unbillableCategories.flatMap((value) => {
      if (!value || typeof value !== 'object') return [];
      const category = value as Record<string, unknown>;
      if (typeof category.id !== 'string' || typeof category.name !== 'string' || typeof category.active !== 'boolean') return [];
      return [{ id: category.id, name: category.name, active: category.active }];
    }),
    driveTimeAvailable: cache.driveTimeAvailable !== false,
    jobWorkAvailable: cache.jobWorkAvailable !== false,
    unbillableAvailable: cache.unbillableAvailable === true,
    requiredBeforeClockInForms: typeof cache.requiredBeforeClockInForms === 'boolean' ? cache.requiredBeforeClockInForms : undefined,
    requiredAfterClockOutForms: typeof cache.requiredAfterClockOutForms === 'boolean' ? cache.requiredAfterClockOutForms : undefined,
    todayServiceVisits: Array.isArray(cache.todayServiceVisits) ? cache.todayServiceVisits as OfflineClockCache['todayServiceVisits'] : [],
    upcomingServiceVisits: Array.isArray(cache.upcomingServiceVisits) ? cache.upcomingServiceVisits as OfflineClockCache['upcomingServiceVisits'] : [],
  };
}

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
  if (!row) return null;
  try {
    const raw = JSON.parse(row.cache_json) as unknown;
    const cache = normalizeOfflineClockCache(raw, identityKey);
    if (cache && (raw as { schemaVersion?: unknown }).schemaVersion !== OFFLINE_CLOCK_CACHE_SCHEMA_VERSION) {
      await saveOfflineClockCache(cache);
    }
    return cache;
  } catch {
    return null;
  }
}

export function resetOfflineClockStorageForTests() {
  databasePromise = null;
}
