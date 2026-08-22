import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ApiError } from '@/types/errors';
import type { OfflineClockCommand, OfflineShiftMapping } from '@/features/offlineClocking/types';

const mockClockIn = jest.fn();
const mockClockOut = jest.fn();
const mockSwitchActivity = jest.fn();
const mockLoadBootstrap = jest.fn();
const mockCaptureMessage = jest.fn();
const mockStoredCommands: OfflineClockCommand[] = [];
const mockShiftMappings = new Map<string, string>();

let mockAuthState = {
  accessToken: 'token-1',
  status: 'authenticated' as const,
  user: {
    id: 'user-1',
    businessId: 'business-1',
    employeeId: 'employee-1',
    name: 'Alex',
    email: 'alex@oliveops.ca',
    role: 'crew_member' as const,
    businessName: 'OliveOps',
  },
};

const mockClockingState = {
  jobs: [],
  timeEntries: [],
  timeCorrections: [],
  unbillableCategories: [],
  currentActiveEntryId: null,
  activeShiftWarnings: { possibleForgottenClockOut: false, thresholdHours: 12 },
  activityConfigs: undefined,
  setJobs: jest.fn(),
  setBusinessTimeZone: jest.fn(),
  setTimeEntries: jest.fn(),
  setTimeCorrections: jest.fn(),
  setCurrentActiveEntryId: jest.fn(),
  setActiveShiftWarnings: jest.fn(),
  setActivityConfigs: jest.fn(),
  upsertTimeEntry: jest.fn(),
};

jest.mock('@/api/clockingApi', () => ({
  clockIn: (...args: unknown[]) => mockClockIn(...args),
  clockOut: (...args: unknown[]) => mockClockOut(...args),
  switchActivity: (...args: unknown[]) => mockSwitchActivity(...args),
  loadBootstrap: (...args: unknown[]) => mockLoadBootstrap(...args),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

jest.mock('@/store/clockingStore', () => ({
  useClockingStore: () => mockClockingState,
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
  },
}));

jest.mock('@sentry/react-native', () => ({
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
}));

jest.mock('@/services/offlineClockStorage', () => ({
  loadOfflineCommands: async (identityKey: string) => mockStoredCommands
    .filter((command) => command.identityKey === identityKey && command.status !== 'synced')
    .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt) || left.id.localeCompare(right.id)),
  insertOfflineCommand: async (command: OfflineClockCommand) => {
    const existing = mockStoredCommands.find((item) => item.identityKey === command.identityKey && item.id === command.id);
    if (!existing) mockStoredCommands.push(command);
  },
  updateOfflineCommand: async (command: OfflineClockCommand) => {
    const index = mockStoredCommands.findIndex((item) => item.identityKey === command.identityKey && item.id === command.id);
    if (index >= 0) mockStoredCommands[index] = command;
  },
  completeOfflineCommand: async (command: OfflineClockCommand, mapping?: OfflineShiftMapping) => {
    const index = mockStoredCommands.findIndex((item) => item.identityKey === command.identityKey && item.id === command.id);
    if (index >= 0) mockStoredCommands[index] = { ...command, status: 'synced' };
    if (mapping) mockShiftMappings.set(`${mapping.identityKey}:${mapping.localShiftId}`, mapping.serverEntryId);
  },
  loadShiftMapping: async (identityKey: string, localShiftId: string) => (
    mockShiftMappings.get(`${identityKey}:${localShiftId}`)
  ),
  loadOfflineClockCache: jest.fn().mockResolvedValue(null),
  saveOfflineClockCache: jest.fn().mockResolvedValue(undefined),
}));

import { OfflineClockProvider, useOfflineClockStore } from '@/store/offlineClockStore';

let offlineClock: ReturnType<typeof useOfflineClockStore>;

function OfflineClockProbe() {
  offlineClock = useOfflineClockStore();
  return React.createElement('offline-clock-probe', {
    hydrated: offlineClock.hydrated,
    pendingCount: offlineClock.effectiveState.pendingCount,
    activeEntryId: offlineClock.effectiveState.activeEntry?.id,
  });
}

function command(overrides: Partial<OfflineClockCommand> = {}): OfflineClockCommand {
  return {
    schemaVersion: 1,
    id: 'key-1',
    identityKey: 'business-1:user-1:employee-1',
    employeeId: 'employee-1',
    businessId: 'business-1',
    localShiftId: 'local-shift-1',
    type: 'clock_in',
    logicalPayload: { employeeId: 'employee-1', workType: 'job', jobIds: ['job-1'] },
    requestId: 'request-1',
    idempotencyKey: 'key-1',
    clientOccurredAt: '2026-08-20T10:00:00.000Z',
    queuedAt: '2026-08-20T10:00:00.100Z',
    status: 'pending',
    retryCount: 0,
    ...overrides,
  };
}

async function renderProvider() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(React.createElement(OfflineClockProvider, null, React.createElement(OfflineClockProbe)));
  });
  return tree;
}

describe('OfflineClockProvider', () => {
  let tree: ReactTestRenderer | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-20T10:00:00.000Z'));
    mockStoredCommands.splice(0);
    mockShiftMappings.clear();
    mockAuthState = {
      ...mockAuthState,
      accessToken: 'token-1',
      status: 'authenticated',
      user: { ...mockAuthState.user, id: 'user-1', employeeId: 'employee-1' },
    };
    mockClockIn.mockReset();
    mockClockOut.mockReset();
    mockSwitchActivity.mockReset();
    mockLoadBootstrap.mockReset().mockResolvedValue({
      ok: true,
      jobs: [],
      timeEntries: [],
      timeCorrections: [],
      currentActiveEntryId: null,
      activeShiftWarnings: { possibleForgottenClockOut: false, thresholdHours: 12 },
      activityConfigs: [],
    });
    mockCaptureMessage.mockReset();
    tree = undefined;
  });

  afterEach(async () => {
    if (tree) {
      await act(async () => tree?.unmount());
    }
    jest.useRealTimers();
  });

  it('hydrates only the active employee queue and restores its effective shift', async () => {
    mockStoredCommands.push(
      command(),
      command({
        id: 'other-key',
        identityKey: 'business-1:user-2:employee-2',
        employeeId: 'employee-2',
        requestId: 'other-request',
        idempotencyKey: 'other-key',
      }),
    );
    mockClockIn.mockRejectedValue(new TypeError('offline'));

    tree = await renderProvider();

    expect(offlineClock.commands).toHaveLength(1);
    expect(offlineClock.commands[0].employeeId).toBe('employee-1');
    expect(offlineClock.effectiveState.activeEntry?.employeeId).toBe('employee-1');
    expect(offlineClock.effectiveState.pendingCount).toBe(1);
  });

  it('replays in order with immutable metadata and resolves a local shift before clock-out', async () => {
    mockClockIn.mockRejectedValue(new TypeError('offline'));
    mockSwitchActivity.mockRejectedValue(new TypeError('offline'));
    mockClockOut.mockRejectedValue(new TypeError('offline'));
    tree = await renderProvider();

    await act(async () => {
      await offlineClock.submitClockIn(
        { employeeId: 'employee-1', workType: 'job', jobIds: ['job-1'] },
        { requestId: 'request-in', idempotencyKey: 'key-in', clientOccurredAt: '2026-08-20T10:00:00.000Z' },
      );
    });
    const localShiftId = offlineClock.effectiveState.localShiftId;
    await act(async () => {
      await offlineClock.submitSwitchActivity(
        { workType: 'drive_time', jobIds: [] },
        { requestId: 'request-switch', idempotencyKey: 'key-switch', clientOccurredAt: '2026-08-20T11:00:00.000Z' },
      );
    });
    await act(async () => {
      await offlineClock.submitClockOut(
        { breakMinutes: 0, notes: 'Done' },
        { requestId: 'request-out', idempotencyKey: 'key-out', clientOccurredAt: '2026-08-20T12:00:00.000Z' },
      );
    });

    const queued = mockStoredCommands.filter((item) => item.status !== 'synced');
    expect(queued.map((item) => item.type)).toEqual(['clock_in', 'switch_activity', 'clock_out']);
    expect(new Set(queued.map((item) => item.localShiftId))).toEqual(new Set([localShiftId]));

    mockClockIn.mockReset().mockResolvedValue({
      ok: true,
      timeEntry: {
        id: 'server-entry-1', employeeId: 'employee-1', workType: 'job', jobIds: ['job-1'],
        clockIn: '2026-08-20T10:00:00.000Z', breakMinutes: 0, notes: '', status: 'clocked_in',
      },
    });
    mockSwitchActivity.mockReset().mockResolvedValue({
      ok: true,
      timeEntry: {
        id: 'server-entry-1', employeeId: 'employee-1', workType: 'drive_time', jobIds: [],
        clockIn: '2026-08-20T11:00:00.000Z', breakMinutes: 0, notes: '', status: 'clocked_in',
      },
    });
    mockClockOut.mockReset().mockResolvedValue({ ok: true });

    await act(async () => offlineClock.syncNow());

    expect(mockClockIn).toHaveBeenCalledWith(expect.objectContaining({
      requestId: 'request-in',
      idempotencyKey: 'key-in',
      clientOccurredAt: '2026-08-20T10:00:00.000Z',
    }), 'token-1');
    expect(mockSwitchActivity).toHaveBeenCalledWith(expect.objectContaining({
      requestId: 'request-switch',
      idempotencyKey: 'key-switch',
      clientOccurredAt: '2026-08-20T11:00:00.000Z',
    }), 'token-1');
    expect(mockClockOut).toHaveBeenCalledWith({
      entryId: 'server-entry-1',
      breakMinutes: 0,
      notes: 'Done',
      requestId: 'request-out',
      idempotencyKey: 'key-out',
      clientOccurredAt: '2026-08-20T12:00:00.000Z',
    }, 'token-1');
    expect(mockStoredCommands.every((item) => item.status === 'synced')).toBe(true);
    expect(mockLoadBootstrap).toHaveBeenCalledWith('token-1', { force: true });
  });

  it('marks the first conflict for attention and does not send later commands', async () => {
    mockStoredCommands.push(
      command(),
      command({
        id: 'key-switch',
        type: 'switch_activity',
        logicalPayload: { workType: 'drive_time', jobIds: [] },
        requestId: 'request-switch',
        idempotencyKey: 'key-switch',
        clientOccurredAt: '2026-08-20T11:00:00.000Z',
        queuedAt: '2026-08-20T11:00:00.100Z',
      }),
    );
    mockClockIn.mockRejectedValue(new ApiError('Shift changed', 409, 'OFFLINE_SHIFT_STATE_CONFLICT'));

    tree = await renderProvider();

    expect(mockStoredCommands[0].status).toBe('needs_attention');
    expect(mockStoredCommands[1].status).toBe('pending');
    expect(mockSwitchActivity).not.toHaveBeenCalled();
    expect(offlineClock.effectiveState.needsAttentionCount).toBe(1);
    expect(offlineClock.effectiveState.currentShiftConflict).toBeNull();
  });

  it('syncs a newer shift while preserving historical attention', async () => {
    mockStoredCommands.push(
      command({ status: 'needs_attention', lastErrorCategory: 'offline_shift_state_conflict' }),
      command({
        id: 'key-new',
        localShiftId: 'local-shift-2',
        logicalPayload: { employeeId: 'employee-1', workType: 'job', jobIds: ['job-2'] },
        requestId: 'request-new',
        idempotencyKey: 'key-new',
        clientOccurredAt: '2026-08-21T10:00:00.000Z',
        queuedAt: '2026-08-21T10:00:00.100Z',
      }),
    );
    mockClockIn.mockResolvedValue({
      ok: true,
      timeEntry: {
        id: 'server-entry-2', employeeId: 'employee-1', workType: 'job', jobIds: ['job-2'],
        clockIn: '2026-08-21T10:00:00.000Z', breakMinutes: 0, notes: '', status: 'clocked_in',
      },
    });

    tree = await renderProvider();

    expect(mockClockIn).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'key-new' }), 'token-1');
    expect(mockStoredCommands[0].status).toBe('needs_attention');
    expect(mockStoredCommands[1].status).toBe('synced');
    expect(offlineClock.effectiveState.needsAttentionCount).toBe(1);
  });

  it('does not enqueue another clock-in while a local clock-in is effective', async () => {
    mockStoredCommands.push(command());
    mockClockIn.mockRejectedValue(new TypeError('offline'));
    tree = await renderProvider();

    let result: Awaited<ReturnType<typeof offlineClock.submitClockIn>> | undefined;
    await act(async () => {
      result = await offlineClock.submitClockIn(
        { employeeId: 'employee-1', workType: 'job', jobIds: ['job-2'] },
        { requestId: 'request-2', idempotencyKey: 'key-2', clientOccurredAt: '2026-08-20T10:05:00.000Z' },
      );
    });

    expect(result).toEqual({ ok: false, error: 'You are already clocked in.' });
    expect(mockStoredCommands).toHaveLength(1);
  });

  it('keeps an authorization failure pending instead of inventing a conflict', async () => {
    mockStoredCommands.push(command());
    mockClockIn.mockRejectedValue(new ApiError('Session expired', 401, 'UNAUTHORIZED'));

    tree = await renderProvider();

    expect(mockStoredCommands[0].status).toBe('pending');
    expect(mockStoredCommands[0].lastErrorCategory).toBe('unauthorized');
    expect(offlineClock.effectiveState.needsAttentionCount).toBe(0);
    expect(offlineClock.effectiveState.activeEntry).not.toBeNull();
  });
});