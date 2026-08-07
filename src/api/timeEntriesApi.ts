import type { TimeEntry } from '@/types/domain';

export function getTodayEntries(entries: TimeEntry[]): TimeEntry[] {
  const today = new Date().toISOString().slice(0, 10);
  return entries.filter((entry) => entry.clockIn.slice(0, 10) === today);
}

export function getWeekTotalHours(entries: TimeEntry[]): number {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);

  return entries.reduce((sum, entry) => {
    const inAt = new Date(entry.clockIn);
    if (inAt < start) return sum;
    const outAt = entry.clockOut ? new Date(entry.clockOut) : new Date();
    const minutes = Math.max(0, (outAt.getTime() - inAt.getTime()) / 60000 - (entry.breakMinutes || 0));
    return sum + minutes / 60;
  }, 0);
}
