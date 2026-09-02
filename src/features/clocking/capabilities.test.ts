import { describe, expect, it } from '@jest/globals';
import { normalizeClockingCapabilities } from './capabilities';

describe('normalizeClockingCapabilities', () => {
  it('defaults absent bootstrap capabilities safely to false', () => {
    expect(normalizeClockingCapabilities(undefined)).toEqual({
      adjustClockInTime: false,
      editShiftWorkAreas: false,
    });
  });

  it('keeps the two Employee permissions independent and boolean-only', () => {
    expect(normalizeClockingCapabilities({ adjustClockInTime: true, editShiftWorkAreas: false })).toEqual({
      adjustClockInTime: true,
      editShiftWorkAreas: false,
    });
    expect(normalizeClockingCapabilities({ adjustClockInTime: false, editShiftWorkAreas: true })).toEqual({
      adjustClockInTime: false,
      editShiftWorkAreas: true,
    });
    expect(normalizeClockingCapabilities({ adjustClockInTime: 'true', editShiftWorkAreas: 1 })).toEqual({
      adjustClockInTime: false,
      editShiftWorkAreas: false,
    });
  });
});
