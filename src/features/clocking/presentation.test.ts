import { describe, expect, it } from '@jest/globals';
import { formatEntryTimeRange, resolveCurrentActiveEntry } from '@/features/clocking/presentation';

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
});
