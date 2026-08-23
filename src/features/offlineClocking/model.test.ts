import { describe, expect, it } from '@jest/globals';
import { analyzeCommandDependencies, buildEffectiveClockState, nextReplayableCommand } from './model';
import type { OfflineClockCommand } from './types';

function command(
  id: string,
  type: OfflineClockCommand['type'],
  clientOccurredAt: string,
  logicalPayload: OfflineClockCommand['logicalPayload'],
  status: OfflineClockCommand['status'] = 'pending',
): OfflineClockCommand {
  return {
    schemaVersion: 1,
    id,
    identityKey: 'biz-1:user-1:emp-1',
    employeeId: 'emp-1',
    businessId: 'biz-1',
    localShiftId: 'shift-1',
    type,
    logicalPayload,
    requestId: `request-${id}`,
    idempotencyKey: `key-${id}`,
    clientOccurredAt,
    queuedAt: clientOccurredAt,
    status,
    retryCount: 0,
  };
}

describe('offline clock effective state', () => {
  it('reconstructs a full pending shift in command order', () => {
    const commands = [
      command('1', 'clock_in', '2026-08-20T11:02:00.000Z', {
        employeeId: 'emp-1', workType: 'job', jobIds: ['job-a'],
      }),
      command('2', 'switch_activity', '2026-08-20T13:15:00.000Z', {
        workType: 'job', jobIds: ['job-b'],
      }),
      command('3', 'switch_activity', '2026-08-20T16:03:00.000Z', {
        workType: 'drive_time', jobIds: [],
      }),
    ];

    const state = buildEffectiveClockState(null, commands);
    expect(state.activeEntry).toEqual(expect.objectContaining({
      workType: 'drive_time',
      jobIds: [],
      clockIn: '2026-08-20T11:02:00.000Z',
      status: 'clocked_in',
    }));
    expect(state.effectiveStatus).toBe('clocked_in_pending');
    expect(state.shiftStartedAt).toBe('2026-08-20T11:02:00.000Z');
    expect(state.currentSegmentStartedAt).toBe('2026-08-20T16:03:00.000Z');
    expect(state.localShiftId).toBe('shift-1');
    expect(state.pendingCount).toBe(3);
    expect(state.syncStatus).toBe('pending');
  });

  it('overlays a pending clock-in on clocked-out server state after restart', () => {
    const state = buildEffectiveClockState(null, [
      command('1', 'clock_in', '2026-08-20T11:02:00.000Z', {
        employeeId: 'emp-1', workType: 'job', jobIds: ['job-a'],
      }),
    ]);

    expect(state.activeEntry?.employeeId).toBe('emp-1');
    expect(state.syncStatus).toBe('pending');
  });

  it('shows a pending clock-out without rewriting its event time', () => {
    const serverEntry = {
      id: 'entry-1', employeeId: 'emp-1', workType: 'job' as const, jobIds: ['job-a'],
      clockIn: '2026-08-20T11:02:00.000Z', breakMinutes: 0, notes: '', status: 'clocked_in' as const,
    };
    const clockOut = command('2', 'clock_out', '2026-08-20T20:32:00.000Z', {
      entryId: 'entry-1', breakMinutes: 0, notes: '',
    });
    clockOut.localShiftId = 'server:entry-1';

    const state = buildEffectiveClockState(serverEntry, [clockOut]);
    expect(state.activeEntry).toBeNull();
    expect(state.effectiveActiveEntryId).toBeNull();
    expect(state.effectiveStatus).toBe('clocked_out_pending');
    expect(state.shiftStartedAt).toBe('2026-08-20T11:02:00.000Z');
    expect(state.lastClockOutAt).toBe('2026-08-20T20:32:00.000Z');
    expect(state.syncStatus).toBe('pending');
  });

  it('does not resurrect a server shift when bootstrap repeats during pending clock-out', () => {
    const serverEntry = {
      id: 'entry-1', employeeId: 'emp-1', workType: 'job' as const, jobIds: ['job-a'],
      clockIn: '2026-08-20T07:00:00.000Z', breakMinutes: 0, notes: '', status: 'clocked_in' as const,
    };
    const clockOut = command('2', 'clock_out', '2026-08-20T12:00:00.000Z', {
      entryId: 'entry-1', breakMinutes: 0, notes: '',
    });
    clockOut.localShiftId = 'server:entry-1';

    const refreshedState = buildEffectiveClockState(serverEntry, [clockOut]);
    expect(refreshedState.effectiveStatus).toBe('clocked_out_pending');
    expect(refreshedState.effectiveActiveEntryId).toBeNull();
    expect(refreshedState.activeEntry).toBeNull();
  });

  it('does not remove a pending clock-in when bootstrap remains clocked out', () => {
    const clockIn = command('1', 'clock_in', '2026-08-20T07:00:00.000Z', {
      employeeId: 'emp-1', workType: 'job', jobIds: ['job-a'],
    });

    const refreshedState = buildEffectiveClockState(null, [clockIn]);
    expect(refreshedState.effectiveStatus).toBe('clocked_in_pending');
    expect(refreshedState.effectiveActiveEntryId).toContain('local-clock:shift-1');
    expect(refreshedState.activeEntry?.clockIn).toBe('2026-08-20T07:00:00.000Z');
  });

  it('keeps historical attention separate from a newer effective shift', () => {
    const failed = command('1', 'clock_in', '2026-08-20T11:02:00.000Z', {
      employeeId: 'emp-1', workType: 'job', jobIds: ['job-a'],
    }, 'needs_attention');
    const later = command('2', 'clock_in', '2026-08-21T11:02:00.000Z', {
      employeeId: 'emp-1', workType: 'job', jobIds: ['job-b'],
    });
    later.localShiftId = 'shift-2';

    const state = buildEffectiveClockState(null, [failed, later]);
    expect(state.activeEntry).toEqual(expect.objectContaining({ jobIds: ['job-b'] }));
    expect(state.localShiftId).toBe('shift-2');
    expect(state.pendingCount).toBe(1);
    expect(state.needsAttentionCount).toBe(1);
    expect(state.currentShiftPendingCount).toBe(1);
    expect(state.currentShiftConflict).toBeNull();
    expect(state.effectiveStatus).toBe('clocked_in_pending');
    expect(state.syncStatus).toBe('pending');
  });

  it('preserves shift start across multiple activity switches', () => {
    const state = buildEffectiveClockState(null, [
      command('1', 'clock_in', '2026-08-20T07:00:00.000Z', {
        employeeId: 'emp-1', workType: 'job', jobIds: ['job-a'],
      }),
      command('2', 'switch_activity', '2026-08-20T09:00:00.000Z', {
        workType: 'job', jobIds: ['job-b'],
      }),
      command('3', 'switch_activity', '2026-08-20T11:00:00.000Z', {
        workType: 'drive_time', jobIds: [],
      }),
      command('4', 'switch_activity', '2026-08-20T12:00:00.000Z', {
        workType: 'job', jobIds: ['job-c'],
      }),
    ]);

    expect(state.activeEntry).toEqual(expect.objectContaining({
      clockIn: '2026-08-20T07:00:00.000Z',
      workType: 'job',
      jobIds: ['job-c'],
    }));
    expect(state.shiftStartedAt).toBe('2026-08-20T07:00:00.000Z');
    expect(state.currentSegmentStartedAt).toBe('2026-08-20T12:00:00.000Z');
  });

  it('replays a newer shift without bypassing a conflict in the same shift', () => {
    const failed = command('1', 'clock_in', '2026-08-20T11:02:00.000Z', {
      employeeId: 'emp-1', workType: 'job', jobIds: ['job-a'],
    }, 'needs_attention');
    const blocked = command('2', 'clock_out', '2026-08-20T12:02:00.000Z', {
      breakMinutes: 0, notes: '',
    });
    const newer = command('3', 'clock_in', '2026-08-21T11:02:00.000Z', {
      employeeId: 'emp-1', workType: 'job', jobIds: ['job-b'],
    });
    newer.localShiftId = 'shift-2';

    expect(nextReplayableCommand([failed, blocked, newer])).toBe(newer);
  });

  it('counts one root conflict while deriving later same-shift commands as blocked', () => {
    const failed = command('1', 'switch_activity', '2026-08-20T11:02:00.000Z', {
      workType: 'drive_time', jobIds: [],
    }, 'needs_attention');
    const blockedSwitch = command('2', 'switch_activity', '2026-08-20T12:02:00.000Z', {
      workType: 'job', jobIds: ['job-b'],
    });
    const blockedOut = command('3', 'clock_out', '2026-08-20T13:02:00.000Z', {
      breakMinutes: 0, notes: '',
    });
    const independent = command('4', 'clock_in', '2026-08-21T08:00:00.000Z', {
      employeeId: 'emp-1', workType: 'job', jobIds: ['job-c'],
    });
    independent.localShiftId = 'shift-2';

    const dependencies = analyzeCommandDependencies([blockedOut, independent, failed, blockedSwitch]);
    const state = buildEffectiveClockState(null, [blockedOut, independent, failed, blockedSwitch]);

    expect(dependencies.actionable).toEqual([failed]);
    expect(dependencies.blocked).toEqual([blockedSwitch, blockedOut]);
    expect(dependencies.replayable).toEqual([independent]);
    expect(state.needsAttentionCount).toBe(1);
    expect(state.blockedCount).toBe(2);
    expect(state.pendingCount).toBe(1);
  });
});
