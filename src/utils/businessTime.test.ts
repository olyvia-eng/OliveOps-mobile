import { describe, expect, it } from '@jest/globals';
import {
  businessDateKey,
  businessLocalDateTimeToIso,
  DEFAULT_BUSINESS_TIME_ZONE,
  normalizeBusinessTimeZone,
} from '@/utils/businessTime';

describe('businessTime', () => {
  it('uses the business date on both sides of a UTC boundary', () => {
    const instant = new Date('2026-08-20T02:30:00.000Z');
    expect(businessDateKey(instant, 'America/Toronto')).toBe('2026-08-19');
    expect(businessDateKey(instant, 'Pacific/Auckland')).toBe('2026-08-20');
  });

  it('handles business midnight independently from UTC midnight', () => {
    expect(businessDateKey(new Date('2026-08-19T03:59:59.000Z'), 'America/Toronto')).toBe('2026-08-18');
    expect(businessDateKey(new Date('2026-08-19T04:00:00.000Z'), 'America/Toronto')).toBe('2026-08-19');
  });

  it('falls back safely for missing and invalid zones', () => {
    expect(normalizeBusinessTimeZone(undefined)).toBe(DEFAULT_BUSINESS_TIME_ZONE);
    expect(normalizeBusinessTimeZone('Not/AZone')).toBe(DEFAULT_BUSINESS_TIME_ZONE);
  });

  it('converts business wall time to UTC across standard and daylight time', () => {
    expect(businessLocalDateTimeToIso('2026-01-15', '08:30', 'America/Toronto')).toBe('2026-01-15T13:30:00.000Z');
    expect(businessLocalDateTimeToIso('2026-07-15', '08:30', 'America/Toronto')).toBe('2026-07-15T12:30:00.000Z');
  });

  it('rejects a wall time skipped by the DST transition', () => {
    expect(businessLocalDateTimeToIso('2026-03-08', '02:30', 'America/Toronto')).toBeUndefined();
  });
});