import type { Job, SessionUser, TimeEntry } from '@/types/domain';

const UNAVAILABLE_CLOCKING_JOB_STATUSES = new Set<Job['status']>(['completed', 'cancelled', 'on_hold']);

export function isJobAvailableForClocking(job: Job): boolean {
  return !UNAVAILABLE_CLOCKING_JOB_STATUSES.has(job.status);
}

export function scopeJobsForSession(jobs: Job[], sessionUser: SessionUser | null): Job[] {
  if (!sessionUser) return [];

  return jobs.filter((job) => {
    if (!isJobAvailableForClocking(job)) return false;

    const assigned = Array.isArray(job.assignedEmployeeIds) ? job.assignedEmployeeIds : [];
    if (assigned.length === 0) {
      return true;
    }

    if (!sessionUser.employeeId) {
      return false;
    }

    return assigned.includes(sessionUser.employeeId);
  });
}

export function scopeTimeEntriesForSession(entries: TimeEntry[], sessionUser: SessionUser | null): TimeEntry[] {
  if (!sessionUser?.employeeId) return [];
  return entries.filter((entry) => entry.employeeId === sessionUser.employeeId);
}
