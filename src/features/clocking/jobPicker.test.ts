import { describe, expect, it } from '@jest/globals';
import type { Job } from '@/types/domain';
import { scheduledClockInJobs, searchClockInJobs } from './jobPicker';

const job = (overrides: Partial<Job>): Job => ({
  id: 'job-a',
  title: 'Flagstone Patio',
  status: 'scheduled',
  assignedEmployeeIds: ['employee-1'],
  ...overrides,
});

describe('clock-in job picker', () => {
  it('recomputes Today from the latest authoritative schedule flags', () => {
    const dayOne = [job({ id: 'job-a', scheduledToday: true })];
    const dayTwo = [
      job({ id: 'job-a', scheduledToday: false }),
      job({ id: 'job-b', title: 'Pool Deck', scheduledToday: true }),
    ];

    expect(scheduledClockInJobs(dayOne).map((item) => item.id)).toEqual(['job-a']);
    expect(scheduledClockInJobs(dayTwo).map((item) => item.id)).toEqual(['job-b']);
  });

  it('includes a multi-day job whenever the backend marks that day scheduled', () => {
    expect(scheduledClockInJobs([job({ scheduledToday: true })])).toHaveLength(1);
    expect(scheduledClockInJobs([job({ scheduledToday: true })])).toHaveLength(1);
  });

  it.each([
    ['title', 'flagstone'],
    ['customer', 'olivia brown'],
    ['address', '4 main street'],
    ['job number', 'j-1042'],
  ])('searches authorized active Jobs by %s', (_field, query) => {
    const authorizedJobs = [job({
      customerName: 'Olivia Brown',
      propertyAddress: '4 Main Street, Markham',
      jobNumber: 'J-1042',
    })];

    expect(searchClockInJobs(authorizedJobs, query).map((item) => item.id)).toEqual(['job-a']);
  });

  it('cannot return a Job absent from the server-authorized collection', () => {
    const authorizedJobs = [job({ id: 'job-a' })];
    expect(searchClockInJobs(authorizedJobs, 'Secret Job')).toEqual([]);
  });
});