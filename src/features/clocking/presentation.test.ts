import { describe, expect, it } from '@jest/globals';
import {
  buildEffectiveTimeEntries,
  formatEntryTimeRange,
  getCorrectionTypeLabel,
  hasPendingCorrectionForEntry,
  resolveCurrentActiveEntry,
} from '@/features/clocking/presentation';

describe('clocking presentation helpers', () => {
  it('resolves authoritative active entry by currentActiveEntryId', () => {
    const entries = [
      {
        id: 'entry-2',
        employeeId: 'emp-1',
        workType: 'job',
        clockIn: '2026-08-07T11:00:00.000Z',
        breakMinutes: 0,
        notes: '',
        status: 'clocked_in',
      },
      {
        id: 'entry-1',
        employeeId: 'emp-1',
        workType: 'job',
        clockIn: '2026-08-07T10:00:00.000Z',
        breakMinutes: 0,
        notes: '',
        status: 'clocked_in',
      },
    ] as any;

    const active = resolveCurrentActiveEntry(entries, 'emp-1', 'entry-1');
    expect(active?.id).toBe('entry-1');
  });

  it('falls back to newest clocked_in entry when authoritative id is unavailable', () => {
    const entries = [
      {
        id: 'entry-1',
        employeeId: 'emp-1',
        workType: 'job',
        clockIn: '2026-08-07T10:00:00.000Z',
        breakMinutes: 0,
        notes: '',
        status: 'clocked_in',
      },
      {
        id: 'entry-2',
        employeeId: 'emp-1',
        workType: 'job',
        clockIn: '2026-08-07T11:00:00.000Z',
        breakMinutes: 0,
        notes: '',
        status: 'clocked_in',
      },
    ] as any;

    const active = resolveCurrentActiveEntry(entries, 'emp-1', null);
    expect(active?.id).toBe('entry-2');
  });

  it('formats orphaned open entry as end time unavailable when not authoritative active', () => {
    const entry = {
      id: 'entry-orphan',
      employeeId: 'emp-1',
      workType: 'job',
      clockIn: '2026-08-07T10:00:00.000Z',
      breakMinutes: 0,
      notes: '',
      status: 'clocked_in',
    } as any;

    const range = formatEntryTimeRange(entry, false);
    expect(range).toContain('End time unavailable');
    expect(range).not.toContain('Now');
  });

  it('maps correction request type to human label', () => {
    expect(getCorrectionTypeLabel('forgot_clock_in')).toBe('Forgot to clock in');
    expect(getCorrectionTypeLabel('wrong_activity')).toBe('Wrong activity');
  });

  it('applies latest approved correction to effective entry values', () => {
    const entries = [{
      id: 'entry-1',
      employeeId: 'emp-1',
      workType: 'job',
      jobId: 'job-1',
      clockIn: '2026-08-07T10:00:00.000Z',
      clockOut: '2026-08-07T11:00:00.000Z',
      breakMinutes: 0,
      notes: '',
      status: 'clocked_out',
    }] as any;

    const corrections = [
      {
        id: 'corr-1',
        timeEntryId: 'entry-1',
        status: 'approved',
        requestedActivityType: 'drive_time',
        updatedAt: '2026-08-07T12:00:00.000Z',
      },
    ] as any;

    const effective = buildEffectiveTimeEntries(entries, corrections);
    expect(effective[0].workType).toBe('drive_time');
  });

  it('detects pending correction status for an entry', () => {
    const corrections = [
      { id: 'corr-1', timeEntryId: 'entry-1', status: 'pending' },
      { id: 'corr-2', timeEntryId: 'entry-2', status: 'approved' },
    ] as any;

    expect(hasPendingCorrectionForEntry('entry-1', corrections)).toBe(true);
    expect(hasPendingCorrectionForEntry('entry-2', corrections)).toBe(false);
  });
});
