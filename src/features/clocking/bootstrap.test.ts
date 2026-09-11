import { mergeAuthoritativeActiveEntry } from '@/features/clocking/bootstrap';
import type { TimeEntry } from '@/types/domain';

const projectEntry: TimeEntry = {
  id: 'project-entry', employeeId: 'employee-1', workType: 'job', jobId: 'project-1', jobIds: ['project-1'],
  clockIn: '2026-09-07T12:00:00.000Z', breakMinutes: 0, notes: '', status: 'clocked_in',
};

describe('mergeAuthoritativeActiveEntry', () => {
  it('restores canonical Service Visit context even when timeEntries omits the active entry', () => {
    const activeVisitEntry: TimeEntry = {
      ...projectEntry, id: 'visit-entry', jobId: 'service-job-1', jobIds: ['service-job-1'],
      serviceId: 'service-1', serviceVisitId: 'visit-1', serviceName: 'Mowing', propertyName: 'Smith Property',
    };

    expect(mergeAuthoritativeActiveEntry([], activeVisitEntry)).toEqual([activeVisitEntry]);
  });

  it('replaces a stale copy of the active entry with canonical bootstrap data', () => {
    const canonical = { ...projectEntry, serviceId: 'service-1', serviceVisitId: 'visit-1' };
    expect(mergeAuthoritativeActiveEntry([projectEntry], canonical)).toEqual([canonical]);
  });

  it('leaves Project-only entries unchanged when activeTimeEntry is absent', () => {
    expect(mergeAuthoritativeActiveEntry([projectEntry], undefined)).toEqual([projectEntry]);
  });
});