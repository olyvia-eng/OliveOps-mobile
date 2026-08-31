import type { Job, TimeCorrectionRequest, TimeCorrectionRequestType, TimeEntry } from '@/types/domain';
import { formatBusinessTime } from '@/utils/businessTime';

export function getWorkTypeLabel(workType: TimeEntry['workType']) {
  if (workType === 'drive_time') return 'Drive Time';
  if (workType === 'non_billable') return 'Unbillable Time';
  return 'Job Work';
}

export function getCorrectionTypeLabel(type: TimeCorrectionRequestType) {
  if (type === 'forgot_clock_in') return 'Forgot to clock in';
  if (type === 'forgot_clock_out') return 'Forgot to clock out';
  if (type === 'wrong_time') return 'Wrong time';
  if (type === 'wrong_job') return 'Wrong job';
  if (type === 'wrong_activity') return 'Wrong activity';
  if (type === 'split_activity') return 'Split activity';
  return 'Other';
}

export function resolveCurrentActiveEntry(
  entries: TimeEntry[],
  employeeId?: string,
  currentActiveEntryId?: string | null,
) {
  if (!employeeId) return null;

  const scopedEntries = entries.filter((entry) => entry.employeeId === employeeId);
  if (scopedEntries.length === 0) return null;

  if (currentActiveEntryId) {
    const authoritative = scopedEntries.find((entry) => entry.id === currentActiveEntryId);
    if (authoritative) return authoritative;
  }

  const fallback = scopedEntries
    .filter((entry) => entry.status === 'clocked_in')
    .sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime())[0];

  return fallback ?? null;
}

export function isAuthoritativeActiveEntry(entryId: string, currentActiveEntryId?: string | null) {
  return Boolean(currentActiveEntryId && entryId === currentActiveEntryId);
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

export function resolveUnbillableCategoryName(entry: Pick<TimeEntry, 'workType' | 'unbillableCategoryName'>) {
  if (entry.workType !== 'non_billable') return null;
  if (typeof entry.unbillableCategoryName === 'string' && entry.unbillableCategoryName.trim()) {
    return entry.unbillableCategoryName.trim();
  }
  return 'Unbillable category unavailable';
}

export function resolveWorkAreaName(entry: Pick<TimeEntry, 'workType' | 'workAreaNameSnapshot'>) {
  if (entry.workType !== 'job') return null;
  if (typeof entry.workAreaNameSnapshot === 'string' && entry.workAreaNameSnapshot.trim()) {
    return entry.workAreaNameSnapshot.trim();
  }
  return null;
}

export function resolveEntryPrimaryLabel(entry: TimeEntry, jobs: Job[]) {
  const unbillableCategoryName = resolveUnbillableCategoryName(entry);
  if (unbillableCategoryName) return unbillableCategoryName;
  return resolveJobTitle(entry, jobs);
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
  if (normalized < 1) return '< 1 min';
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function formatDurationForEntry(entry: TimeEntry, nowMs = Date.now()) {
  const startedAt = new Date(entry.clockIn).getTime();
  const endedAt = entry.clockOut ? new Date(entry.clockOut).getTime() : nowMs;
  const rawMinutes = (endedAt - startedAt) / (1000 * 60);
  const minutes = Math.max(0, rawMinutes - (entry.breakMinutes || 0));
  return formatDurationMinutes(minutes);
}

export function buildEffectiveTimeEntries(entries: TimeEntry[], corrections: TimeCorrectionRequest[]) {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const approvedByEntryId = new Map<string, TimeCorrectionRequest>();

  for (const correction of corrections ?? []) {
    if (correction?.status !== 'approved' || typeof correction?.timeEntryId !== 'string') continue;

    const existing = approvedByEntryId.get(correction.timeEntryId);
    const existingTs = Date.parse(existing?.reviewedAt ?? existing?.updatedAt ?? existing?.createdAt ?? '') || 0;
    const candidateTs = Date.parse(correction.reviewedAt ?? correction.updatedAt ?? correction.createdAt ?? '') || 0;
    if (!existing || candidateTs >= existingTs) {
      approvedByEntryId.set(correction.timeEntryId, correction);
    }
  }

  return entries.map((entry) => {
    const correction = approvedByEntryId.get(entry.id);
    if (!correction) return entry;
    const nextWorkType = correction.requestedActivityType ?? entry.workType;
    const nextJobIds = correction.requestedJobId
      ? [correction.requestedJobId]
      : (Array.isArray(entry.jobIds) ? entry.jobIds : (entry.jobId ? [entry.jobId] : []));

    const nextUnbillableCategoryId = nextWorkType === 'non_billable'
      ? (correction.requestedUnbillableCategoryId ?? entry.unbillableCategoryId)
      : undefined;
    const nextUnbillableCategoryName = nextWorkType === 'non_billable'
      ? (correction.requestedUnbillableCategoryName ?? entry.unbillableCategoryName)
      : undefined;
    const changesActivityOrJob = Boolean(correction.requestedActivityType || correction.requestedJobId);
    const nextWorkAreaId = nextWorkType === 'job'
      ? (changesActivityOrJob ? correction.requestedWorkAreaId ?? null : entry.workAreaId)
      : undefined;
    const nextWorkAreaNameSnapshot = nextWorkType === 'job'
      ? (changesActivityOrJob ? correction.requestedWorkAreaNameSnapshot ?? null : entry.workAreaNameSnapshot)
      : undefined;

    return {
      ...entry,
      clockIn: correction.requestedClockInAt ?? entry.clockIn,
      clockOut: correction.requestedClockOutAt ?? entry.clockOut,
      jobId: correction.requestedJobId ?? entry.jobId,
      jobIds: nextJobIds,
      workType: nextWorkType,
      workAreaId: nextWorkAreaId,
      workAreaNameSnapshot: nextWorkAreaNameSnapshot,
      unbillableCategoryId: nextUnbillableCategoryId,
      unbillableCategoryName: nextUnbillableCategoryName,
    };
  });
}

export function hasPendingCorrectionForEntry(entryId: string, corrections: TimeCorrectionRequest[]) {
  return corrections.some((item) => item.timeEntryId === entryId && item.status === 'pending');
}

export function hasApprovedCorrectionForEntry(entryId: string, corrections: TimeCorrectionRequest[]) {
  return corrections.some((item) => item.timeEntryId === entryId && item.status === 'approved');
}

export function formatLongShiftWarning(clockIn: string, nowMs = Date.now()) {
  return `You've been clocked in for ${formatElapsedShort(clockIn, nowMs)}. Did you forget to clock out?`;
}

export function formatEntryTimeRange(entry: TimeEntry, isAuthoritativeActive = false, timeZone?: string | null) {
  const start = formatBusinessTime(new Date(entry.clockIn), timeZone, { hour: 'numeric', minute: '2-digit' });
  if (!entry.clockOut) {
    return isAuthoritativeActive ? `${start} - Now` : `${start} - End time unavailable`;
  }

  const end = formatBusinessTime(new Date(entry.clockOut), timeZone, { hour: 'numeric', minute: '2-digit' });
  return `${start} - ${end}`;
}

export function getCurrentShiftSegments(
  entries: TimeEntry[],
  employeeId?: string,
  currentActiveEntryId?: string | null,
): TimeEntry[] {
  const active = resolveCurrentActiveEntry(entries, employeeId, currentActiveEntryId);
  if (!active || !employeeId) return [];

  const ordered = entries
    .filter((entry) => entry.employeeId === employeeId)
    .sort((a, b) => Date.parse(a.clockIn) - Date.parse(b.clockIn));
  const activeIndex = ordered.findIndex((entry) => entry.id === active.id);
  if (activeIndex < 0) return [active];

  let startIndex = activeIndex;
  while (startIndex > 0) {
    const previous = ordered[startIndex - 1];
    const current = ordered[startIndex];
    if (!previous.clockOut) break;
    const gapMs = Date.parse(current.clockIn) - Date.parse(previous.clockOut);
    if (gapMs < 0 || gapMs > 5 * 60 * 1000) break;
    startIndex -= 1;
  }

  return ordered.slice(startIndex, activeIndex + 1);
}

export function getGreetingForTime(name: string, now = new Date()) {
  const hour = now.getHours();
  const firstName = name.trim().split(/\s+/)[0] || 'Crew Member';

  if (hour < 12) return `Good morning, ${firstName}`;
  if (hour < 17) return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
}
