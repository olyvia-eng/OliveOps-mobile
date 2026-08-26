import { describe, expect, it } from '@jest/globals';
import { isJobAvailableForClocking, scopeJobsForSession, scopeTimeEntriesForSession } from '@/features/clocking/scoping';

const session = {
  id: 'u-1',
  businessId: 'biz-1',
  name: 'Crew',
  email: 'crew@x.com',
  role: 'crew_member' as const,
  businessName: 'OliveOps',
  employeeId: 'emp-1',
};

describe('clocking scoping', () => {
  it.each([
    ['scheduled', true],
    ['in_progress', true],
    ['on_hold', false],
    ['completed', false],
    ['cancelled', false],
  ] as const)('treats %s jobs as available: %s', (status, expected) => {
    expect(isJobAvailableForClocking({
      id: 'j-1', title: 'A', status, assignedEmployeeIds: ['emp-1'],
    })).toBe(expected);
  });

  it('loads assigned jobs only for employee and active statuses', () => {
    const jobs = [
      { id: 'j-1', title: 'A', status: 'scheduled' as const, assignedEmployeeIds: ['emp-1'] },
      { id: 'j-2', title: 'B', status: 'in_progress' as const, assignedEmployeeIds: ['emp-2'] },
      { id: 'j-3', title: 'C', status: 'completed' as const, assignedEmployeeIds: ['emp-1'] },
      { id: 'j-4', title: 'D', status: 'scheduled' as const, assignedEmployeeIds: [] },
    ];

    const scoped = scopeJobsForSession(jobs, session);
    expect(scoped.map((j) => j.id)).toEqual(['j-1', 'j-4']);
  });

  it.each([
    ['completed', 'in_progress'],
    ['on_hold', 'scheduled'],
  ] as const)('makes a job visible after refreshed status changes from %s to %s', (previousStatus, refreshedStatus) => {
    const previousJobs = [{ id: 'j-1', title: 'A', status: previousStatus, assignedEmployeeIds: ['emp-1'] }];
    const refreshedJobs = [{ id: 'j-1', title: 'A', status: refreshedStatus, assignedEmployeeIds: ['emp-1'] }];

    expect(scopeJobsForSession(previousJobs, session)).toEqual([]);
    expect(scopeJobsForSession(refreshedJobs, session).map((job) => job.id)).toEqual(['j-1']);
  });

  it('never returns other employee time entries (cross-tenant/identity safety guard)', () => {
    const entries = [
      {
        id: 't-1',
        employeeId: 'emp-1',
        workType: 'job' as const,
        clockIn: '2026-08-06T10:00:00.000Z',
        breakMinutes: 0,
        notes: '',
        status: 'clocked_in' as const,
      },
      {
        id: 't-2',
        employeeId: 'emp-2',
        workType: 'job' as const,
        clockIn: '2026-08-06T11:00:00.000Z',
        breakMinutes: 0,
        notes: '',
        status: 'clocked_out' as const,
      },
    ];

    const scoped = scopeTimeEntriesForSession(entries, session);
    expect(scoped).toHaveLength(1);
    expect(scoped[0]?.employeeId).toBe('emp-1');
  });
});
