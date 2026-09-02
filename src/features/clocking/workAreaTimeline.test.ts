import { describe, expect, it, jest } from '@jest/globals';
import type { TimeEntry } from '@/types/domain';
import {
  changeDraftWorkArea,
  changeSharedBoundary,
  createWorkAreaTimelineDraft,
  eligibleWorkAreasForSegment,
  replaceCurrentShiftTimeline,
  serializeEditableWorkAreaSegments,
  splitWorkAreaSegment,
  workAreaTimelineDraftFingerprint,
} from './workAreaTimeline';

const entry = (overrides: Partial<TimeEntry> = {}): TimeEntry => ({
  id: 'entry-1', employeeId: 'emp-1', workType: 'job', jobId: 'job-a', jobIds: ['job-a'],
  workAreaId: 'area-excavation', workAreaNameSnapshot: 'Excavation', clockIn: '2026-09-02T11:00:00.000Z',
  clockOut: '2026-09-02T13:00:00.000Z', breakMinutes: 0, notes: '', status: 'clocked_out', ...overrides,
});

describe('Work Area timeline draft', () => {
  it('splits a Job segment locally without mutating the authoritative entry', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-02T15:00:00.000Z'));
    const authoritative = [entry({ clockOut: undefined, status: 'clocked_in' })];
    const draft = createWorkAreaTimelineDraft(authoritative);
    const split = splitWorkAreaSegment(draft, 0, '2026-09-02T13:00:00.000Z', { id: 'area-base', name: 'Base Prep' });

    expect(split).toHaveLength(2);
    expect(split.map((item) => [item.startAt, item.endAt, item.workAreaId])).toEqual([
      ['2026-09-02T11:00:00.000Z', '2026-09-02T13:00:00.000Z', 'area-excavation'],
      ['2026-09-02T13:00:00.000Z', null, 'area-base'],
    ]);
    expect(authoritative[0].clockOut).toBeUndefined();
    jest.useRealTimers();
  });

  it('changes one shared boundary on both adjacent segments', () => {
    const draft = createWorkAreaTimelineDraft([
      entry(),
      entry({ id: 'entry-2', workAreaId: 'area-base', workAreaNameSnapshot: 'Base Prep', clockIn: '2026-09-02T13:00:00.000Z', clockOut: undefined, status: 'clocked_in' }),
    ]);
    const changed = changeSharedBoundary(draft, 1, '2026-09-02T13:30:00.000Z');
    expect(changed[0].endAt).toBe('2026-09-02T13:30:00.000Z');
    expect(changed[1].startAt).toBe('2026-09-02T13:30:00.000Z');
  });

  it('locks Drive Time, Unbillable, and Job-change boundaries', () => {
    const draft = createWorkAreaTimelineDraft([
      entry(),
      entry({ id: 'drive', workType: 'drive_time', jobId: undefined, jobIds: [], workAreaId: null, clockIn: '2026-09-02T13:00:00.000Z', clockOut: '2026-09-02T13:30:00.000Z' }),
      entry({ id: 'unbillable', workType: 'non_billable', jobId: undefined, jobIds: [], workAreaId: null, clockIn: '2026-09-02T13:30:00.000Z', clockOut: '2026-09-02T14:00:00.000Z' }),
      entry({ id: 'job-b', jobId: 'job-b', jobIds: ['job-b'], clockIn: '2026-09-02T14:00:00.000Z', clockOut: undefined, status: 'clocked_in' }),
    ]);
    expect(changeSharedBoundary(draft, 1, '2026-09-02T12:30:00.000Z')).toBe(draft);
    expect(changeSharedBoundary(draft, 2, '2026-09-02T13:40:00.000Z')).toBe(draft);
    expect(changeSharedBoundary(draft, 3, '2026-09-02T14:10:00.000Z')).toBe(draft);
  });

  it('changes Work Area by operational ID and scopes choices to the segment Job', () => {
    const draft = createWorkAreaTimelineDraft([entry()]);
    const jobs = [
      { id: 'job-a', title: 'A', status: 'scheduled' as const, assignedEmployeeIds: ['emp-1'], eligibleOperationalWorkAreas: [{ id: 'area-base', name: 'Base Prep', status: 'in_progress' as const }] },
      { id: 'job-b', title: 'B', status: 'scheduled' as const, assignedEmployeeIds: ['emp-1'], eligibleOperationalWorkAreas: [{ id: 'area-other', name: 'Other', status: 'in_progress' as const }] },
    ];
    expect(eligibleWorkAreasForSegment(draft[0], jobs).map((area) => area.id)).toEqual(['area-base']);
    const changed = changeDraftWorkArea(draft, 0, { id: 'area-base', name: 'Base Prep' });
    expect(changed[0]).toEqual(expect.objectContaining({ workAreaId: 'area-base', workAreaName: 'Base Prep', jobId: 'job-a' }));
  });

  it('serializes only editable Job segments and detects draft changes', () => {
    const draft = createWorkAreaTimelineDraft([
      entry(),
      entry({ id: 'drive', workType: 'drive_time', jobId: undefined, jobIds: [], clockIn: '2026-09-02T13:00:00.000Z' }),
    ]);
    const changed = changeDraftWorkArea(draft, 0, { id: 'area-base', name: 'Base Prep' });
    expect(serializeEditableWorkAreaSegments(changed)).toEqual([{
      jobId: 'job-a', workAreaId: 'area-base', startAt: '2026-09-02T11:00:00.000Z', endAt: '2026-09-02T13:00:00.000Z',
    }]);
    expect(workAreaTimelineDraftFingerprint(changed)).not.toBe(workAreaTimelineDraftFingerprint(draft));
  });

  it('replaces only the current shift with authoritative server entries', () => {
    const current = entry();
    const historical = entry({ id: 'history', clockIn: '2026-09-01T11:00:00.000Z' });
    const replacement = entry({ id: 'server-new', workAreaId: 'area-base', workAreaNameSnapshot: 'Base Prep' });
    expect(replaceCurrentShiftTimeline([current, historical], [current], [replacement])).toEqual([replacement, historical]);
  });
});