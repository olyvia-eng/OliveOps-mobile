import type { TimeEntry } from '@/types/domain';
import {
  businessDateKey,
  formatBusinessDate,
  normalizeBusinessTimeZone,
} from '@/utils/businessTime';

export interface TimeHistoryGroup {
  dateKey: string;
  label: string;
  entries: TimeEntry[];
}

function previousDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return previous.toISOString().slice(0, 10);
}

function formatGroupLabel(dateKey: string, todayKey: string, timeZone: string) {
  if (dateKey === todayKey) return 'Today';
  if (dateKey === previousDateKey(todayKey)) return 'Yesterday';

  const [year, month, day] = dateKey.split('-').map(Number);
  const displayInstant = new Date(Date.UTC(year, month - 1, day, 12));
  const currentYear = Number(todayKey.slice(0, 4));
  return formatBusinessDate(displayInstant, timeZone, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...(year === currentYear ? {} : { year: 'numeric' }),
  });
}

export function groupTimeHistoryEntries(
  entries: TimeEntry[],
  timeZone?: string | null,
  now = new Date(),
  authoritativeActiveEntryId?: string | null,
): TimeHistoryGroup[] {
  const normalizedTimeZone = normalizeBusinessTimeZone(timeZone);
  const todayKey = businessDateKey(now, normalizedTimeZone);
  const byDate = new Map<string, TimeEntry[]>();

  for (const entry of entries) {
    const dateKey = businessDateKey(new Date(entry.clockIn), normalizedTimeZone);
    const group = byDate.get(dateKey) ?? [];
    group.push(entry);
    byDate.set(dateKey, group);
  }

  return [...byDate.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([dateKey, groupEntries]) => ({
      dateKey,
      label: formatGroupLabel(dateKey, todayKey, normalizedTimeZone),
      entries: groupEntries.slice().sort((left, right) => {
        if (dateKey === todayKey && authoritativeActiveEntryId) {
          if (left.id === authoritativeActiveEntryId) return -1;
          if (right.id === authoritativeActiveEntryId) return 1;
        }
        return Date.parse(right.clockIn) - Date.parse(left.clockIn);
      }),
    }));
}
