import type { TimeEntry } from '@/types/domain';
import { groupTimeHistoryEntries } from '@/features/clocking/timeHistory';

export type TodayTimeSummary = {
  entries: TimeEntry[];
  totalMinutes: number;
  jobMinutes: number;
  driveMinutes: number;
  unbillableMinutes: number;
};

function durationMinutes(entry: TimeEntry, nowMs: number) {
  const startedAt = Date.parse(entry.clockIn);
  const endedAt = entry.clockOut ? Date.parse(entry.clockOut) : nowMs;
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) return 0;
  return Math.max(0, (endedAt - startedAt) / 60_000 - (entry.breakMinutes || 0));
}

export function getTodayTimeSummary(
  entries: TimeEntry[],
  timeZone?: string | null,
  now = new Date(),
  authoritativeActiveEntryId?: string | null,
): TodayTimeSummary {
  const today = groupTimeHistoryEntries(entries, timeZone, now, authoritativeActiveEntryId)
    .find((group) => group.label === 'Today')?.entries ?? [];
  const totals = { job: 0, drive_time: 0, non_billable: 0 };

  for (const entry of today) totals[entry.workType] += durationMinutes(entry, now.getTime());

  return {
    entries: today,
    totalMinutes: totals.job + totals.drive_time + totals.non_billable,
    jobMinutes: totals.job,
    driveMinutes: totals.drive_time,
    unbillableMinutes: totals.non_billable,
  };
}