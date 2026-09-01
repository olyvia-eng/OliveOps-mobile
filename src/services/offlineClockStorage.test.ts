import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { OfflineClockCommand } from '@/features/offlineClocking/types';
import { analyzeCommandDependencies } from '@/features/offlineClocking/model';

const mockRows = new Map<string, {
  id: string;
  identityKey: string;
  queuedAt: string;
  status: string;
  commandJson: string;
}>();
const mockMappings = new Map<string, string>();
const mockCaches = new Map<string, string>();

const mockDatabase = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  runAsync: jest.fn(async (sql: string, ...args: unknown[]) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('INSERT OR IGNORE INTO offline_clock_commands')) {
      const [id, identityKey, queuedAt, status, commandJson] = args as string[];
      if (!mockRows.has(id)) mockRows.set(id, { id, identityKey, queuedAt, status, commandJson });
    } else if (normalized.startsWith('UPDATE offline_clock_commands SET status = ?')) {
      const [status, commandJson, storageId, legacyId, identityKey] = args as string[];
      const row = mockRows.get(storageId) ?? mockRows.get(legacyId);
      if (row?.identityKey === identityKey) mockRows.set(row.id, { ...row, status, commandJson });
    } else if (normalized.startsWith("UPDATE offline_clock_commands SET status = 'synced'")) {
      const [commandJson, storageId, legacyId, identityKey] = args as string[];
      const row = mockRows.get(storageId) ?? mockRows.get(legacyId);
      if (row?.identityKey === identityKey) mockRows.set(row.id, { ...row, status: 'synced', commandJson });
    } else if (normalized.startsWith('INSERT INTO offline_clock_shift_mappings')) {
      const [identityKey, localShiftId, serverEntryId] = args as string[];
      mockMappings.set(`${identityKey}:${localShiftId}`, serverEntryId);
    } else if (normalized.startsWith('INSERT INTO offline_clock_cache')) {
      const [identityKey, , cacheJson] = args as string[];
      mockCaches.set(identityKey, cacheJson);
    }
    return { changes: 1 };
  }),
  getAllAsync: jest.fn(async (_sql: string, identityKey: string) => Array.from(mockRows.values())
    .filter((row) => row.identityKey === identityKey && row.status !== 'synced')
    .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt) || left.id.localeCompare(right.id))
    .map((row) => ({ command_json: row.commandJson }))),
  getFirstAsync: jest.fn(async (sql: string, ...args: string[]) => {
    if (sql.includes('offline_clock_shift_mappings')) {
      return { server_entry_id: mockMappings.get(`${args[0]}:${args[1]}`) };
    }
    if (sql.includes('offline_clock_cache')) {
      const cacheJson = mockCaches.get(args[0]);
      return cacheJson ? { cache_json: cacheJson } : null;
    }
    return null;
  }),
  withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
};

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => mockDatabase),
}));

import {
  completeOfflineCommand,
  completeOfflineShiftCommands,
  insertOfflineCommand,
  loadOfflineCommands,
  loadShiftMapping,
  resetOfflineClockStorageForTests,
  updateOfflineCommand,
} from './offlineClockStorage';

function command(id: string, localShiftId = 'shift-1', identityKey = 'biz:user:employee'): OfflineClockCommand {
  const minute = Number(id.replace(/\D/g, '')) || 0;
  return {
    schemaVersion: 1,
    id,
    identityKey,
    employeeId: 'employee',
    businessId: 'biz',
    localShiftId,
    type: id === 'command-1' ? 'clock_in' : id === 'command-4' ? 'clock_out' : 'switch_activity',
    logicalPayload: id === 'command-1'
      ? { employeeId: 'employee', workType: 'job', jobIds: ['job-1'] }
      : id === 'command-4'
        ? { breakMinutes: 0, notes: '' }
        : { workType: 'drive_time', jobIds: [] },
    requestId: `request-${id}`,
    idempotencyKey: `key-${id}`,
    clientOccurredAt: `2026-08-23T10:0${minute}:00.000Z`,
    queuedAt: `2026-08-23T10:0${minute}:00.100Z`,
    status: 'pending',
    retryCount: 0,
  };
}

describe('offline clock SQLite persistence', () => {
  beforeEach(() => {
    mockRows.clear();
    mockMappings.clear();
    mockCaches.clear();
    resetOfflineClockStorageForTests();
  });

  it('persists exactly four unique logical commands for a full offline shift', async () => {
    const commands = [1, 2, 3, 4].map((number) => command(`command-${number}`));
    for (const item of commands) await insertOfflineCommand(item);
    await insertOfflineCommand(commands[1]);

    expect(mockRows.size).toBe(4);
    expect(await loadOfflineCommands('biz:user:employee')).toHaveLength(4);
  });

  it('excludes server-confirmed synced rows from every active queue load', async () => {
    const commands = [1, 2, 3, 4].map((number) => command(`command-${number}`));
    for (const item of commands) await insertOfflineCommand(item);
    for (const item of commands) await completeOfflineCommand(item);

    expect(Array.from(mockRows.values()).every((row) => row.status === 'synced')).toBe(true);
    expect(await loadOfflineCommands('biz:user:employee')).toEqual([]);
  });

  it('retires every command in a provisional shift in one transaction', async () => {
    const commands = [1, 2, 3].map((number) => command(`command-${number}`));
    for (const item of commands) await insertOfflineCommand(item);
    mockDatabase.withTransactionAsync.mockClear();

    await completeOfflineShiftCommands(commands);

    expect(mockDatabase.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(await loadOfflineCommands('biz:user:employee')).toEqual([]);
  });

  it('preserves conflict metadata, dependents, independent shifts, and mappings across restart', async () => {
    const root = { ...command('command-1'), status: 'needs_attention' as const };
    const blockedOne = command('command-2');
    const blockedTwo = command('command-3');
    const independent = command('command-4', 'shift-2');
    for (const item of [root, blockedOne, blockedTwo, independent]) await insertOfflineCommand(item);
    await completeOfflineCommand(command('mapping-source'), {
      identityKey: 'biz:user:employee', localShiftId: 'shift-2', serverEntryId: 'server-entry-2',
    });
    await updateOfflineCommand(root);

    resetOfflineClockStorageForTests();
    const restored = await loadOfflineCommands('biz:user:employee');

    expect(restored).toEqual([root, blockedOne, blockedTwo, independent]);
    expect(analyzeCommandDependencies(restored)).toEqual(expect.objectContaining({
      actionable: [root],
      blocked: [blockedOne, blockedTwo],
      replayable: [independent],
    }));
    expect(await loadShiftMapping('biz:user:employee', 'shift-2')).toBe('server-entry-2');
    expect(await loadOfflineCommands('other:user:employee')).toEqual([]);
  });
});
