/**
 * Formats a Date object into a human-readable date or time string.
 * @param {Date} date
 * @param {'date' | 'time' | 'datetime'} format
 * @returns {string}
 */
export function formatTimestamp(date, format = 'datetime') {
  if (!date) return '';
  const d = new Date(date);

  const dateStr = d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const timeStr = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  if (format === 'date') return dateStr;
  if (format === 'time') return timeStr;
  return `${dateStr}, ${timeStr}`;
}

/**
 * Calculates the duration in milliseconds between two dates.
 * @param {Date} start
 * @param {Date} end
 * @returns {number} duration in milliseconds
 */
export function calculateDuration(start, end) {
  if (!start || !end) return 0;
  return new Date(end).getTime() - new Date(start).getTime();
}

/**
 * Formats a duration (in milliseconds) into a human-readable string.
 * @param {number} ms
 * @returns {string} e.g. "2h 35m"
 */
export function formatDuration(ms) {
  if (!ms || ms < 0) return '0m';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
