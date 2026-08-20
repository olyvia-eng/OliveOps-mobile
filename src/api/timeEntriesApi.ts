import type { TimeEntry } from '@/types/domain';
import { businessDateKey, normalizeBusinessTimeZone } from '@/utils/businessTime';

export function getTodayEntries(entries: TimeEntry[], timeZone?: string | null, now = new Date()): TimeEntry[] {
  const today = businessDateKey(now, timeZone);
  return entries.filter((entry) => businessDateKey(new Date(entry.clockIn), timeZone) === today);
}

export function getWeekTotalHours(entries: TimeEntry[], timeZone?: string | null, now = new Date()): number {
  const normalizedTimeZone = normalizeBusinessTimeZone(timeZone);
  const today = businessDateKey(now, normalizedTimeZone);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: normalizedTimeZone, weekday: 'short' }).format(now);
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  const diffToMonday = weekdayIndex === 0 ? 6 : weekdayIndex - 1;
  const [year, month, day] = today.split('-').map(Number);
  const monday = new Date(Date.UTC(year, month - 1, day - diffToMonday));
  const mondayKey = monday.toISOString().slice(0, 10);

  return entries.reduce((sum, entry) => {
    const entryDateKey = businessDateKey(new Date(entry.clockIn), normalizedTimeZone);
    if (entryDateKey < mondayKey || entryDateKey > today) return sum;
    const inAt = new Date(entry.clockIn);
    const outAt = entry.clockOut ? new Date(entry.clockOut) : now;
    const minutes = Math.max(0, (outAt.getTime() - inAt.getTime()) / 60000 - (entry.breakMinutes || 0));
    return sum + minutes / 60;
  }, 0);
}
