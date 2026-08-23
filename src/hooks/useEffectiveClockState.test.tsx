import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildEffectiveClockState } from '@/features/offlineClocking/model';
import type { OfflineClockCommand } from '@/features/offlineClocking/types';

const serverEntry = {
  id: 'server-entry-a',
  employeeId: 'employee-1',
  workType: 'job' as const,
  jobIds: ['job-a'],
  clockIn: '2026-08-23T07:00:00.000Z',
  breakMinutes: 0,
  notes: '',
  status: 'clocked_in' as const,
};

let mockClockingState: any;
let mockOfflineClock: any;

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { employeeId: 'employee-1' } }),
}));
jest.mock('@/store/clockingStore', () => ({
  useClockingStore: () => mockClockingState,
}));
jest.mock('@/store/offlineClockContext', () => ({
  useOptionalOfflineClockStore: () => mockOfflineClock,
}));

import { useEffectiveClockState } from './useEffectiveClockState';

function Probe() {
  const state = useEffectiveClockState();
  return React.createElement('effective-clock', {
    activeEntryId: state.effectiveActiveEntryId,
    activeEntry: state.activeEntry,
    effectiveStatus: state.effectiveStatus,
  });
}

function command(overrides: Partial<OfflineClockCommand>): OfflineClockCommand {
  return {
    schemaVersion: 1,
    id: 'command-1',
    identityKey: 'business-1:user-1:employee-1',
    employeeId: 'employee-1',
    businessId: 'business-1',
    localShiftId: 'server:server-entry-a',
    type: 'clock_out',
    logicalPayload: { entryId: 'server-entry-a', breakMinutes: 0, notes: '' },
    requestId: 'request-1',
    idempotencyKey: 'key-1',
    clientOccurredAt: '2026-08-23T12:00:00.000Z',
    queuedAt: '2026-08-23T12:00:00.100Z',
    status: 'pending',
    retryCount: 0,
    ...overrides,
  };
}

describe('useEffectiveClockState', () => {
  beforeEach(() => {
    mockClockingState = {
      currentActiveEntryId: 'server-entry-a',
      timeEntries: [serverEntry],
    };
    mockOfflineClock = undefined;
  });

  it('respects hydrated null after an offline clock-out', async () => {
    const effectiveState = buildEffectiveClockState(serverEntry, [command({})]);
    mockOfflineClock = {
      hydrated: true,
      effectiveState,
      effectiveTimeEntries: [{ ...serverEntry, status: 'clocked_out', clockOut: '2026-08-23T12:00:00.000Z' }],
    };

    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<Probe />);
    });

    const state = tree.root.findByType('effective-clock').props;
    expect(state.activeEntryId).toBeNull();
    expect(state.activeEntry).toBeNull();
    expect(state.effectiveStatus).toBe('clocked_out_pending');
  });

  it('overrides a clocked-out server with a pending local clock-in', async () => {
    mockClockingState = { currentActiveEntryId: null, timeEntries: [] };
    const clockIn = command({
      localShiftId: 'local-shift-1',
      type: 'clock_in',
      logicalPayload: { employeeId: 'employee-1', workType: 'job', jobIds: ['job-a'] },
      clientOccurredAt: '2026-08-23T07:00:00.000Z',
    });
    const effectiveState = buildEffectiveClockState(null, [clockIn]);
    mockOfflineClock = {
      hydrated: true,
      effectiveState,
      effectiveTimeEntries: [effectiveState.activeEntry],
    };

    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<Probe />);
    });

    const state = tree.root.findByType('effective-clock').props;
    expect(state.activeEntryId).toContain('local-clock:local-shift-1');
    expect(state.effectiveStatus).toBe('clocked_in_pending');
  });
});