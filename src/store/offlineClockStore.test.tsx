import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ApiError } from '@/types/errors';
import type { OfflineClockCommand, OfflineShiftMapping } from '@/features/offlineClocking/types';

const mockClockIn = jest.fn();
const mockLoadPendingClockIn = jest.fn();
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
  timeEntries: [] as ReturnType<typeof commandEntry>[],
  timeCorrections: [],
  unbillableCategories: [],
  currentActiveEntryId: null as string | null,
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
  loadPendingClockIn: (...args: unknown[]) => mockLoadPendingClockIn(...args),
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
  completeOfflineShiftCommands: async (commands: OfflineClockCommand[]) => {
    for (const command of commands) {
      const index = mockStoredCommands.findIndex((item) => item.identityKey === command.identityKey && item.id === command.id);
      if (index >= 0) mockStoredCommands[index] = { ...command, status: 'synced' };
    }
  },
  loadShiftMapping: async (identityKey: string, localShiftId: string) => (
    mockShiftMappings.get(`${identityKey}:${localShiftId}`)
  ),
  loadOfflineClockCache: jest.fn().mockResolvedValue(null),
  saveOfflineClockCache: jest.fn().mockResolvedValue(undefined),
}));

import { OfflineClockProvider, useOfflineClockStore } from '@/store/offlineClockStore';

let offlineClock: ReturnType<typeof useOfflineClockStore>;

function commandEntry(id: string) {
  return {
    id,
    employeeId: 'employee-1',
    workType: 'job' as const,
    jobIds: ['job-1'],
    clockIn: '2026-08-20T10:00:00.000Z',
    breakMinutes: 0,
    notes: '',
    status: 'clocked_in' as const,
  };
}

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
    mockClockingState.timeEntries = [];
    mockClockingState.currentActiveEntryId = null;
    mockAuthState = {
      ...mockAuthState,
      accessToken: 'token-1',
      status: 'authenticated',
      user: { ...mockAuthState.user, id: 'user-1', employeeId: 'employee-1' },
    };
    mockClockIn.mockReset();
    mockLoadPendingClockIn.mockReset();
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

  it('removes a provisional shift without needs-attention when replay returns required forms', async () => {
    const requiredForm = {
      id: 'form-1', name: 'Morning Truck Inspection', trigger: 'before_clock_in', required: true,
      completionRequirement: 'required', context: { jobId: 'job-1' }, fields: [],
      submissionState: { completed: false },
    };
    const clockIn = command();
    const dependentSwitch = command({
      id: 'key-switch',
      type: 'switch_activity',
      logicalPayload: { workType: 'drive_time', jobIds: [] },
      requestId: 'request-switch',
      idempotencyKey: 'key-switch',
      clientOccurredAt: '2026-08-20T10:30:00.000Z',
      queuedAt: '2026-08-20T10:30:00.100Z',
    });
    mockStoredCommands.push(clockIn, dependentSwitch);
    const pendingWorkflow = {
      ok: true,
      blocked: true,
      status: 'clock_in_pending_required_forms',
      workflowOccurrenceId: 'occurrence-1',
      requiredFormCount: 1,
      completedRequiredFormCount: 0,
      remainingRequiredFormCount: 1,
      requiredForms: [{ requirementId: 'requirement-1', formId: 'form-1', form: requiredForm }],
      remainingForms: [{ requirementId: 'requirement-1', formId: 'form-1', form: requiredForm }],
      reminderForms: [],
      clockInIntent: { employeeId: 'employee-1', workType: 'job', jobIds: ['job-1'] },
    } as const;
    mockClockIn.mockResolvedValue(pendingWorkflow);

    tree = await renderProvider();

    expect(mockStoredCommands.every((item) => item.status === 'synced')).toBe(true);
    expect(mockSwitchActivity).not.toHaveBeenCalled();
    expect(offlineClock.commands).toHaveLength(0);
    expect(offlineClock.effectiveState.activeEntry).toBeNull();
    expect(offlineClock.effectiveState.effectiveStatus).toBe('clocked_out_synced');
    expect(offlineClock.effectiveState.pendingCount).toBe(0);
    expect(offlineClock.effectiveState.needsAttentionCount).toBe(0);
    expect(offlineClock.pendingClockInWorkflow).toBe(pendingWorkflow);
    expect(mockCaptureMessage).not.toHaveBeenCalledWith('required_before_clock_in_forms', expect.anything());
    expect(mockLoadBootstrap).toHaveBeenCalledWith('token-1', { force: true });

    await act(async () => offlineClock.acknowledgePendingClockInWorkflow());
    expect(offlineClock.pendingClockInWorkflow).toBeNull();
  });

  it('supersedes a provisional shift when replay finds an existing mandatory workflow', async () => {
    const pendingWorkflow = {
      ok: true,
      blocked: true,
      status: 'clock_in_pending_required_forms',
      workflowOccurrenceId: 'occurrence-existing',
      requiredFormCount: 1,
      completedRequiredFormCount: 0,
      remainingRequiredFormCount: 1,
      requiredForms: [],
      remainingForms: [],
      reminderForms: [],
      clockInIntent: {
        employeeId: 'employee-1', workType: 'job', jobIds: ['job-1'],
        workAreaId: 'work-area-1', clockingContractVersion: 2,
      },
    } as const;
    mockStoredCommands.push(command({
      schemaVersion: 2,
      logicalPayload: {
        employeeId: 'employee-1', workType: 'job', jobIds: ['job-1'],
        workAreaId: 'work-area-1', workAreaNameSnapshot: 'North Wing', clockingContractVersion: 2,
      },
    }));
    mockClockIn.mockRejectedValue(new ApiError('Existing clock-in workflow', 409, 'pending_clock_in_exists'));
    mockLoadPendingClockIn.mockResolvedValue(pendingWorkflow);

    tree = await renderProvider();

    expect(mockLoadPendingClockIn).toHaveBeenCalledWith('token-1');
    expect(mockStoredCommands.every((item) => item.status === 'synced')).toBe(true);
    expect(offlineClock.commands).toHaveLength(0);
    expect(offlineClock.effectiveState.activeEntry).toBeNull();
    expect(offlineClock.pendingClockInWorkflow).toBe(pendingWorkflow);
    expect(mockClockIn).toHaveBeenCalledTimes(1);
  });

  it('retains a provisional shift when existing workflow ownership cannot be verified', async () => {
    mockStoredCommands.push(command());
    mockClockIn.mockRejectedValue(new ApiError('Existing clock-in workflow', 409, 'pending_clock_in_exists'));
    mockLoadPendingClockIn.mockRejectedValue(new TypeError('network unavailable'));

    tree = await renderProvider();

    expect(mockStoredCommands).toEqual([expect.objectContaining({
      id: 'key-1', status: 'pending', lastErrorCategory: 'pending_clock_in_exists',
    })]);
    expect(offlineClock.effectiveState.activeSource).toBe('offline_pending');
    expect(offlineClock.effectiveState.activeEntry?.id).toContain('local-clock:');
    expect(offlineClock.pendingClockInWorkflow).toBeNull();
  });

  it('retires obsolete required-form needs-attention shifts during restart recovery', async () => {
    mockStoredCommands.push(
      command({
        status: 'needs_attention',
        lastErrorCode: 'required_before_clock_in_forms',
        lastErrorCategory: 'server_rejected',
      }),
      command({
        id: 'dependent-switch',
        type: 'switch_activity',
        logicalPayload: { workType: 'drive_time', jobIds: [] },
        requestId: 'dependent-request',
        idempotencyKey: 'dependent-switch',
        clientOccurredAt: '2026-08-20T10:30:00.000Z',
        queuedAt: '2026-08-20T10:30:00.100Z',
      }),
    );

    tree = await renderProvider();

    expect(mockStoredCommands.every((item) => item.status === 'synced')).toBe(true);
    expect(offlineClock.commands).toHaveLength(0);
    expect(offlineClock.effectiveState.activeEntry).toBeNull();
    expect(offlineClock.effectiveState.needsAttentionCount).toBe(0);
    expect(mockClockIn).not.toHaveBeenCalled();
    expect(mockSwitchActivity).not.toHaveBeenCalled();
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

  it('updates the logical shift mapping after every switch before clock-out', async () => {
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
        { requestId: 'request-switch-1', idempotencyKey: 'key-switch-1', clientOccurredAt: '2026-08-20T10:15:00.000Z' },
      );
    });
    await act(async () => {
      await offlineClock.submitSwitchActivity(
        { workType: 'job', jobIds: ['job-2'] },
        { requestId: 'request-switch-2', idempotencyKey: 'key-switch-2', clientOccurredAt: '2026-08-20T10:30:00.000Z' },
      );
    });
    await act(async () => {
      await offlineClock.submitClockOut(
        { breakMinutes: 0, notes: '' },
        { requestId: 'request-out', idempotencyKey: 'key-out', clientOccurredAt: '2026-08-20T11:00:00.000Z' },
      );
    });

    mockClockIn.mockReset().mockResolvedValue({
      ok: true,
      timeEntry: { ...commandEntry('server-entry-a'), workType: 'job', jobIds: ['job-1'] },
    });
    mockSwitchActivity
      .mockReset()
      .mockResolvedValueOnce({
        ok: true,
        timeEntry: { ...commandEntry('server-entry-b'), workType: 'drive_time', jobIds: [] },
      })
      .mockResolvedValueOnce({
        ok: true,
        timeEntry: { ...commandEntry('server-entry-c'), workType: 'job', jobIds: ['job-2'] },
      });
    mockClockOut.mockReset().mockResolvedValue({ ok: true });

    await act(async () => offlineClock.syncNow());

    expect(mockShiftMappings.get(`business-1:user-1:employee-1:${localShiftId}`)).toBe('server-entry-c');
    expect(mockClockOut).toHaveBeenCalledWith(expect.objectContaining({ entryId: 'server-entry-c' }), 'token-1');
    expect(mockStoredCommands.every((item) => item.status === 'synced')).toBe(true);
  });

  it('retains only a conflicted clock-out after earlier full-shift commands replay', async () => {
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
        { requestId: 'request-switch', idempotencyKey: 'key-switch', clientOccurredAt: '2026-08-20T10:30:00.000Z' },
      );
    });
    await act(async () => {
      await offlineClock.submitClockOut(
        { breakMinutes: 0, notes: 'Done' },
        { requestId: 'request-out', idempotencyKey: 'key-out', clientOccurredAt: '2026-08-20T11:00:00.000Z' },
      );
    });

    const latestServerEntry = { ...commandEntry('server-entry-b'), workType: 'drive_time' as const, jobIds: [] };
    mockClockingState.timeEntries = [latestServerEntry];
    mockClockingState.currentActiveEntryId = latestServerEntry.id;
    mockClockIn.mockReset().mockResolvedValue({ ok: true, timeEntry: commandEntry('server-entry-a') });
    mockSwitchActivity.mockReset().mockResolvedValue({ ok: true, timeEntry: latestServerEntry });
    mockClockOut.mockReset().mockRejectedValue(
      new ApiError('Shift changed', 409, 'OFFLINE_SHIFT_STATE_CONFLICT'),
    );

    await act(async () => offlineClock.syncNow());

    expect(mockClockIn).toHaveBeenCalledTimes(1);
    expect(mockSwitchActivity).toHaveBeenCalledTimes(1);
    expect(mockClockOut).toHaveBeenCalledWith(expect.objectContaining({ entryId: 'server-entry-b' }), 'token-1');
    expect(mockShiftMappings.get(`business-1:user-1:employee-1:${localShiftId}`)).toBe('server-entry-b');
    expect(mockStoredCommands.filter((item) => item.status !== 'synced')).toEqual([
      expect.objectContaining({
        id: 'key-out',
        status: 'needs_attention',
        lastErrorCategory: 'offline_shift_state_conflict',
        resolvedServerEntryId: 'server-entry-b',
      }),
    ]);
    expect(offlineClock.effectiveState.activeEntry?.id).toBe('server-entry-b');
    expect(offlineClock.effectiveState.effectiveStatus).toBe('needs_attention');
  });

  it('preserves failed clock-out intent as the current shift conflict', async () => {
    const failedClockOut = command({
      id: 'key-out',
      localShiftId: 'local-shift-1',
      type: 'clock_out',
      logicalPayload: { breakMinutes: 0, notes: '' },
      requestId: 'request-out',
      idempotencyKey: 'key-out',
      clientOccurredAt: '2026-08-20T11:00:00.000Z',
      queuedAt: '2026-08-20T11:00:00.100Z',
      status: 'needs_attention',
      lastErrorCategory: 'offline_shift_state_conflict',
      resolvedServerEntryId: 'server-entry-b',
    });
    mockStoredCommands.push(failedClockOut);
    mockClockingState.timeEntries = [commandEntry('server-entry-b')];
    mockClockingState.currentActiveEntryId = 'server-entry-b';

    tree = await renderProvider();

    expect(offlineClock.effectiveState.effectiveStatus).toBe('needs_attention');
    expect(offlineClock.effectiveState.currentShiftConflict?.id).toBe('key-out');
    expect(offlineClock.effectiveState.activeEntry?.id).toBe('server-entry-b');
  });

  it('persists the correction relationship without marking the failed command synced', async () => {
    const failed = command({
      id: 'failed-out',
      type: 'clock_out',
      logicalPayload: { breakMinutes: 0, notes: '' },
      status: 'needs_attention',
      resolvedServerEntryId: 'server-entry-b',
    });
    mockStoredCommands.push(failed);
    tree = await renderProvider();

    await act(async () => {
      await offlineClock.resolveCommandWithCorrection('failed-out', 'correction-1');
    });

    expect(mockStoredCommands[0]).toEqual(expect.objectContaining({
      status: 'needs_attention',
      correctionRequestId: 'correction-1',
      correctionRequestedAt: expect.any(String),
    }));
    expect(offlineClock.effectiveState.needsAttentionCount).toBe(0);
    expect(offlineClock.effectiveState.correctionRequestedCount).toBe(1);
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

    expect(result).toEqual({ ok: false, error: 'Your clock-in is still syncing.' });
    expect(mockStoredCommands).toHaveLength(1);
  });

  it('retains the normal duplicate warning for a server-confirmed active shift', async () => {
    mockClockingState.timeEntries = [commandEntry('server-entry-1')];
    mockClockingState.currentActiveEntryId = 'server-entry-1';

    tree = await renderProvider();

    let result: unknown;
    await act(async () => {
      result = await offlineClock.submitClockIn(
        { employeeId: 'employee-1', workType: 'job', jobIds: ['job-1'] },
        { requestId: 'request-new', idempotencyKey: 'key-new', clientOccurredAt: '2026-08-20T10:01:00.000Z' },
      );
    });

    expect(result).toEqual({ ok: false, error: 'You are already clocked in.' });
    expect(mockStoredCommands).toHaveLength(0);
  });

  it('persists one command when the same logical action is submitted twice concurrently', async () => {
    mockClockIn.mockRejectedValue(new TypeError('offline'));
    tree = await renderProvider();
    const payload = { employeeId: 'employee-1', workType: 'job' as const, jobIds: ['job-1'] };
    const meta = {
      requestId: 'request-one-action',
      idempotencyKey: 'key-one-action',
      clientOccurredAt: '2026-08-20T10:00:00.000Z',
    };

    await act(async () => {
      await Promise.all([
        offlineClock.submitClockIn(payload, meta),
        offlineClock.submitClockIn(payload, meta),
      ]);
    });

    expect(mockStoredCommands.filter((item) => item.id === 'key-one-action')).toHaveLength(1);
  });

  it('keeps a newer shift mapping and replay independent from an older conflicted shift', async () => {
    const oldConflict = command({
      id: 'old-conflict',
      localShiftId: 'shift-a',
      status: 'needs_attention',
      resolvedServerEntryId: 'server-entry-a',
    });
    const oldBlocked = command({
      id: 'old-blocked',
      localShiftId: 'shift-a',
      type: 'clock_out',
      logicalPayload: { breakMinutes: 0, notes: '' },
      clientOccurredAt: '2026-08-20T11:00:00.000Z',
      queuedAt: '2026-08-20T11:00:00.100Z',
    });
    const newClockIn = command({
      id: 'new-in',
      localShiftId: 'shift-b',
      requestId: 'request-new-in',
      idempotencyKey: 'new-in',
      clientOccurredAt: '2026-08-21T10:00:00.000Z',
      queuedAt: '2026-08-21T10:00:00.100Z',
    });
    const newSwitch = command({
      id: 'new-switch',
      localShiftId: 'shift-b',
      type: 'switch_activity',
      logicalPayload: { workType: 'drive_time', jobIds: [] },
      requestId: 'request-new-switch',
      idempotencyKey: 'new-switch',
      clientOccurredAt: '2026-08-21T10:30:00.000Z',
      queuedAt: '2026-08-21T10:30:00.100Z',
    });
    const newClockOut = command({
      id: 'new-out',
      localShiftId: 'shift-b',
      type: 'clock_out',
      logicalPayload: { breakMinutes: 0, notes: '' },
      requestId: 'request-new-out',
      idempotencyKey: 'new-out',
      clientOccurredAt: '2026-08-21T11:00:00.000Z',
      queuedAt: '2026-08-21T11:00:00.100Z',
    });
    mockStoredCommands.push(oldConflict, oldBlocked, newClockIn, newSwitch, newClockOut);
    mockClockIn.mockResolvedValue({ ok: true, timeEntry: commandEntry('server-entry-b1') });
    mockSwitchActivity.mockResolvedValue({
      ok: true,
      timeEntry: { ...commandEntry('server-entry-b2'), workType: 'drive_time', jobIds: [] },
    });
    mockClockOut.mockResolvedValue({ ok: true });

    tree = await renderProvider();

    expect(mockClockIn).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'new-in' }), 'token-1');
    expect(mockClockOut).toHaveBeenCalledWith(expect.objectContaining({ entryId: 'server-entry-b2' }), 'token-1');
    expect(mockShiftMappings.get('business-1:user-1:employee-1:shift-b')).toBe('server-entry-b2');
    expect(mockShiftMappings.get('business-1:user-1:employee-1:shift-a')).toBeUndefined();
    expect(mockStoredCommands.find((item) => item.id === 'old-conflict')?.status).toBe('needs_attention');
    expect(mockStoredCommands.find((item) => item.id === 'old-blocked')?.status).toBe('pending');
    expect(mockStoredCommands.filter((item) => item.localShiftId === 'shift-b').every((item) => item.status === 'synced')).toBe(true);
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