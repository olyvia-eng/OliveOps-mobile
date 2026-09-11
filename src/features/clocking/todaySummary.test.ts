import { describe, expect, it } from '@jest/globals';
import { getTodayTimeSummary } from '@/features/clocking/todaySummary';
import type { TimeEntry } from '@/types/domain';

function entry(id: string, workType: TimeEntry['workType'], clockIn: string, clockOut: string): TimeEntry {
  return { id, employeeId: 'employee-1', workType, clockIn, clockOut, breakMinutes: 0, notes: '', status: 'clocked_out' };
}

describe('getTodayTimeSummary', () => {
  it('uses the business-local date and excludes entries outside today', () => {
    const summary = getTodayTimeSummary([
      entry('toronto-today', 'job', '2026-09-05T04:30:00.000Z', '2026-09-05T05:30:00.000Z'),
      entry('toronto-yesterday', 'job', '2026-09-05T02:00:00.000Z', '2026-09-05T03:00:00.000Z'),
    ], 'America/Toronto', new Date('2026-09-05T16:00:00.000Z'));

    expect(summary.entries.map((item) => item.id)).toEqual(['toronto-today']);
    expect(summary.totalMinutes).toBe(60);
  });

  it('totals only relevant activity categories using existing entry durations', () => {
    const summary = getTodayTimeSummary([
      entry('job', 'job', '2026-09-05T12:00:00.000Z', '2026-09-05T14:00:00.000Z'),
      entry('drive', 'drive_time', '2026-09-05T14:00:00.000Z', '2026-09-05T14:30:00.000Z'),
      entry('unbillable', 'non_billable', '2026-09-05T14:30:00.000Z', '2026-09-05T15:15:00.000Z'),
    ], 'America/Toronto', new Date('2026-09-05T16:00:00.000Z'));

    expect(summary).toEqual(expect.objectContaining({
      totalMinutes: 195,
      jobMinutes: 120,
      driveMinutes: 30,
      unbillableMinutes: 45,
    }));
  });
});