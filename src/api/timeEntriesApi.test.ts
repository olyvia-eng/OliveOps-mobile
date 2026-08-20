import { describe, expect, it } from '@jest/globals';
import { getTodayEntries, getWeekTotalHours } from '@/api/timeEntriesApi';
import type { TimeEntry } from '@/types/domain';

function entry(id: string, clockIn: string, clockOut = '2026-08-20T03:30:00.000Z'): TimeEntry {
  return {
    id,
    employeeId: 'employee-1',
    workType: 'job',
    clockIn,
    clockOut,
    breakMinutes: 0,
    notes: '',
    status: 'clocked_out',
  };
}

describe('timeEntriesApi business calendar', () => {
  it('groups today by the business timezone rather than UTC', () => {
    const now = new Date('2026-08-20T02:30:00.000Z');
    const entries = [
      entry('toronto-today', '2026-08-19T22:00:00.000Z'),
      entry('toronto-yesterday', '2026-08-19T02:00:00.000Z'),
    ];
    expect(getTodayEntries(entries, 'America/Toronto', now).map((item) => item.id)).toEqual(['toronto-today']);
  });

  it('starts weekly totals on business-local Monday', () => {
    const now = new Date('2026-08-20T02:30:00.000Z');
    const entries = [
      entry('monday', '2026-08-18T01:00:00.000Z', '2026-08-18T02:00:00.000Z'),
      entry('sunday', '2026-08-17T01:00:00.000Z', '2026-08-17T02:00:00.000Z'),
    ];
    expect(getWeekTotalHours(entries, 'America/Toronto', now)).toBe(1);
  });
});