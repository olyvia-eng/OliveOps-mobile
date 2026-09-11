import type { TimeEntry } from '@/types/domain';

export function mergeAuthoritativeActiveEntry(entries: TimeEntry[], activeEntry?: TimeEntry | null) {
  if (!activeEntry) return entries;
  return [activeEntry, ...entries.filter((entry) => entry.id !== activeEntry.id)];
}