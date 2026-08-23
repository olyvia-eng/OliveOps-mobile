import { describe, expect, it } from '@jest/globals';
import { getOfflineCommandReason, resolveOfflineCommandActivity } from './presentation';
import type { OfflineClockCommand } from './types';

function command(overrides: Partial<OfflineClockCommand>): OfflineClockCommand {
  return {
    schemaVersion: 1,
    id: 'command-1',
    identityKey: 'business:user:employee',
    employeeId: 'employee',
    businessId: 'business',
    localShiftId: 'shift-1',
    type: 'clock_out',
    logicalPayload: { breakMinutes: 0, notes: '' },
    requestId: 'request-1',
    idempotencyKey: 'key-1',
    clientOccurredAt: '2026-08-23T14:04:00.000Z',
    queuedAt: '2026-08-23T14:04:00.100Z',
    status: 'needs_attention',
    retryCount: 1,
    ...overrides,
  };
}

describe('offline clock issue presentation', () => {
  it('maps server codes to employee-safe reasons', () => {
    expect(getOfflineCommandReason('offline_shift_state_conflict'))
      .toBe('Your saved shift changed before this offline action could sync.');
    expect(getOfflineCommandReason('offline_event_order_conflict'))
      .toBe('This time change conflicts with another recorded time entry.');
  });

  it('uses the latest activity context before a failed clock-out', () => {
    const clockIn = command({
      id: 'in',
      type: 'clock_in',
      clientOccurredAt: '2026-08-23T13:00:00.000Z',
      logicalPayload: { employeeId: 'employee', workType: 'job', jobIds: ['job-a'] },
      status: 'synced',
    });
    const switched = command({
      id: 'switch',
      type: 'switch_activity',
      clientOccurredAt: '2026-08-23T13:30:00.000Z',
      logicalPayload: { workType: 'drive_time', jobIds: [] },
      status: 'synced',
    });
    const clockOut = command({});

    expect(resolveOfflineCommandActivity(clockOut, [clockIn, switched, clockOut], null)).toEqual({
      workType: 'drive_time',
      jobIds: [],
      unbillableCategoryId: undefined,
    });
  });
});