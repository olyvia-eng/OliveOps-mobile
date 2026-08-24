import { describe, expect, it } from '@jest/globals';
import { validateTimeOffDraft } from './model';

describe('validateTimeOffDraft', () => {
  it('accepts a valid inclusive range and a single-day request', () => {
    expect(validateTimeOffDraft({
      requestType: 'vacation', startDate: '2026-08-28', endDate: '2026-08-30', employeeNote: '',
    })).toEqual({});
    expect(validateTimeOffDraft({
      requestType: 'sick', startDate: '2026-08-28', endDate: '2026-08-28', employeeNote: '',
    })).toEqual({});
  });

  it('rejects missing, invalid, and reversed calendar dates', () => {
    expect(validateTimeOffDraft({
      requestType: 'other', startDate: '', endDate: '2026-02-30', employeeNote: '',
    })).toEqual({
      startDate: 'Choose a valid start date.',
      endDate: 'Choose a valid end date.',
    });
    expect(validateTimeOffDraft({
      requestType: 'personal', startDate: '2026-08-30', endDate: '2026-08-28', employeeNote: '',
    }).endDate).toBe('End date cannot be before start date.');
  });
});