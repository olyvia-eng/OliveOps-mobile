import type { Job, TimeEntry } from '@/types/domain';

export function getWorkTypeLabel(workType: TimeEntry['workType']) {
  if (workType === 'drive_time') return 'Drive Time';
  if (workType === 'non_billable') return 'Unbillable Time';
  return 'Job Work';
}

export function resolveJobTitle(entry: Pick<TimeEntry, 'jobId' | 'jobIds'>, jobs: Job[]) {
  const ids = Array.isArray(entry.jobIds) && entry.jobIds.length > 0
    ? entry.jobIds
    : (entry.jobId ? [entry.jobId] : []);

  if (ids.length === 0) return 'General work';

  const titles = ids
    .map((id) => jobs.find((job) => job.id === id)?.title)
    .filter((title): title is string => Boolean(title && title.trim()));

  if (titles.length === 0) return 'Assigned job';
  return titles.join(', ');
}

export function formatElapsedClock(clockIn: string, nowMs = Date.now()) {
  const startedAt = new Date(clockIn).getTime();
  const totalSeconds = Math.max(0, Math.floor((nowMs - startedAt) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
}

export function formatElapsedShort(clockIn: string, nowMs = Date.now()) {
  const startedAt = new Date(clockIn).getTime();
  const totalMinutes = Math.max(0, Math.floor((nowMs - startedAt) / (1000 * 60)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function formatDurationMinutes(totalMinutes: number) {
  const normalized = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours}h ${minutes}m`;
}

export function formatDurationForEntry(entry: TimeEntry, nowMs = Date.now()) {
  const startedAt = new Date(entry.clockIn).getTime();
  const endedAt = entry.clockOut ? new Date(entry.clockOut).getTime() : nowMs;
  const rawMinutes = (endedAt - startedAt) / (1000 * 60);
  const minutes = Math.max(0, rawMinutes - (entry.breakMinutes || 0));
  return formatDurationMinutes(minutes);
}

export function formatEntryTimeRange(entry: TimeEntry) {
  const start = new Date(entry.clockIn).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (!entry.clockOut) {
    return `${start} - Now`;
  }

  const end = new Date(entry.clockOut).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${start} - ${end}`;
}

export function getGreetingForTime(name: string, now = new Date()) {
  const hour = now.getHours();
  const firstName = name.trim().split(/\s+/)[0] || 'Crew Member';

  if (hour < 12) return `Good morning, ${firstName}`;
  if (hour < 17) return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
}
