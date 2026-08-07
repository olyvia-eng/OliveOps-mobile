import {
  formatTimestamp,
  calculateDuration,
  formatDuration,
} from '../src/utils/timeUtils';

describe('timeUtils', () => {
  const fixedDate = new Date('2024-03-15T09:00:00');
  const laterDate = new Date('2024-03-15T17:30:00');

  describe('calculateDuration', () => {
    it('returns correct duration in milliseconds', () => {
      const ms = calculateDuration(fixedDate, laterDate);
      expect(ms).toBe(8.5 * 60 * 60 * 1000);
    });

    it('returns 0 for null inputs', () => {
      expect(calculateDuration(null, laterDate)).toBe(0);
      expect(calculateDuration(fixedDate, null)).toBe(0);
    });
  });

  describe('formatDuration', () => {
    it('formats hours and minutes correctly', () => {
      expect(formatDuration(8.5 * 60 * 60 * 1000)).toBe('8h 30m');
    });

    it('formats minutes only when under an hour', () => {
      expect(formatDuration(45 * 60 * 1000)).toBe('45m');
    });

    it('formats hours only when no remaining minutes', () => {
      expect(formatDuration(3 * 60 * 60 * 1000)).toBe('3h');
    });

    it('returns 0m for null or zero', () => {
      expect(formatDuration(0)).toBe('0m');
      expect(formatDuration(null)).toBe('0m');
    });
  });

  describe('formatTimestamp', () => {
    it('returns a non-empty string for date format', () => {
      const result = formatTimestamp(fixedDate, 'date');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns a non-empty string for time format', () => {
      const result = formatTimestamp(fixedDate, 'time');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns empty string for null input', () => {
      expect(formatTimestamp(null, 'date')).toBe('');
    });
  });
});
