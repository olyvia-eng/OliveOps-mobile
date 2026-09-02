import { describe, expect, it } from '@jest/globals';
import { getWeekTotalHours } from '@/api/timeEntriesApi';
import type { TimeEntry } from '@/types/domain';
import { groupTimeHistoryEntries } from './timeHistory';

const now = new Date('2026-09-02T14:00:00.000Z');
const timeZone = 'America/Toronto';

function entry(id: string, clockIn: string, clockOut?: string): TimeEntry {
  return {
    id,
    employeeId: 'employee-a',
    workType: 'job',
    jobId: 'job-a',
    workAreaNameSnapshot: 'Excavation',
    clockIn,
    clockOut,
    breakMinutes: 0,
    notes: '',
    status: clockOut ? 'clocked_out' : 'clocked_in',
  };
}

describe('groupTimeHistoryEntries', () => {
  it('shows today and yesterday newest day and entry first', () => {
    const groups = groupTimeHistoryEntries([
      entry('yesterday', '2026-09-01T12:00:00.000Z', '2026-09-01T20:00:00.000Z'),
      entry('today-old', '2026-09-02T11:00:00.000Z', '2026-09-02T12:00:00.000Z'),
      entry('today-new', '2026-09-02T13:00:00.000Z', '2026-09-02T13:30:00.000Z'),
    ], timeZone, now);

    expect(groups.map((group) => group.label)).toEqual(['Today', 'Yesterday']);
    expect(groups[0].entries.map((item) => item.id)).toEqual(['today-new', 'today-old']);
    expect(groups[1].entries.map((item) => item.id)).toEqual(['yesterday']);
  });

  it('does not become empty when today has no entries', () => {
    const groups = groupTimeHistoryEntries([
      entry('yesterday', '2026-09-01T12:00:00.000Z', '2026-09-01T20:00:00.000Z'),
    ], timeZone, now);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Yesterday');
  });

  it('uses the business timezone for Today and Yesterday labels', () => {
    const boundaryEntry = entry('boundary', '2026-09-02T02:00:00.000Z', '2026-09-02T03:00:00.000Z');

    expect(groupTimeHistoryEntries([boundaryEntry], 'America/Toronto', now)[0].label).toBe('Yesterday');
    expect(groupTimeHistoryEntries([boundaryEntry], 'UTC', now)[0].label).toBe('Today');
  });

  it('prioritizes only the authoritative active entry in today', () => {
    const groups = groupTimeHistoryEntries([
      entry('newer-incomplete', '2026-09-02T13:30:00.000Z'),
      entry('authoritative', '2026-09-02T12:00:00.000Z'),
    ], timeZone, now, 'authoritative');

    expect(groups[0].entries.map((item) => item.id)).toEqual(['authoritative', 'newer-incomplete']);
  });

  it('retains entries after the business date crosses midnight', () => {
    const entries = [entry('before-midnight', '2026-09-02T23:00:00.000Z', '2026-09-03T02:00:00.000Z')];
    const before = groupTimeHistoryEntries(entries, timeZone, new Date('2026-09-03T03:30:00.000Z'));
    const after = groupTimeHistoryEntries(entries, timeZone, new Date('2026-09-03T05:00:00.000Z'));

    expect(before[0].label).toBe('Today');
    expect(after[0].label).toBe('Yesterday');
    expect(after[0].entries[0].id).toBe('before-midnight');
  });

  it('preserves the business-week total across historical groups', () => {
    const entries = [
      entry('today', '2026-09-02T12:00:00.000Z', '2026-09-02T16:00:00.000Z'),
      entry('yesterday', '2026-09-01T12:00:00.000Z', '2026-09-01T20:00:00.000Z'),
    ];

    expect(getWeekTotalHours(entries, timeZone, now)).toBe(12);
  });
});
