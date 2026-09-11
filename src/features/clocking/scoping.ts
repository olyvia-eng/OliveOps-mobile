import type { Job, SessionUser, TimeEntry } from '@/types/domain';

const UNAVAILABLE_CLOCKING_JOB_STATUSES = new Set<Job['status']>(['completed', 'cancelled', 'on_hold']);

export function isJobAvailableForClocking(job: Job): boolean {
  return !UNAVAILABLE_CLOCKING_JOB_STATUSES.has(job.status);
}

export function scopeJobsForSession(jobs: Job[], sessionUser: SessionUser | null): Job[] {
  if (!sessionUser) return [];
  return jobs.filter(isJobAvailableForClocking);
}

export function scopeTimeEntriesForSession(entries: TimeEntry[], sessionUser: SessionUser | null): TimeEntry[] {
  if (!sessionUser?.employeeId) return [];
  return entries.filter((entry) => entry.employeeId === sessionUser.employeeId);
}
