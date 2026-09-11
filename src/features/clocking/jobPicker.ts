import type { Job } from '@/types/domain';

export function scheduledClockInJobs(jobs: Job[]): Job[] {
  return jobs.filter((job) => job.scheduledToday === true);
}

export function searchClockInJobs(jobs: Job[], query: string): Job[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [];
  return jobs.filter((job) => [
    job.title,
    job.customerName,
    job.propertyAddress,
    job.jobNumber,
  ].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery)));
}