import { describe, expect, it } from '@jest/globals';
import { buildEffectiveClockState } from './model';
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
      clockIn: '2026-08-20T16:03:00.000Z',
      status: 'clocked_in',
    }));
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
    expect(state.lastClockOutAt).toBe('2026-08-20T20:32:00.000Z');
    expect(state.syncStatus).toBe('pending');
  });

  it('surfaces needs-attention state without deleting later evidence', () => {
    const failed = command('1', 'clock_in', '2026-08-20T11:02:00.000Z', {
      employeeId: 'emp-1', workType: 'job', jobIds: ['job-a'],
    }, 'needs_attention');
    const later = command('2', 'clock_out', '2026-08-20T20:32:00.000Z', {
      breakMinutes: 0, notes: '',
    });

    const state = buildEffectiveClockState(null, [failed, later]);
    expect(state.pendingCount).toBe(2);
    expect(state.needsAttentionCount).toBe(1);
    expect(state.syncStatus).toBe('needs_attention');
  });
});
