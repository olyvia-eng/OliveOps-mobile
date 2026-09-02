const DATE_PARTS_FORMAT_LOCALE = 'en-CA';

export const DEFAULT_BUSINESS_TIME_ZONE = 'America/Toronto';

export function normalizeBusinessTimeZone(value?: string | null) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate) return DEFAULT_BUSINESS_TIME_ZONE;

  try {
    new Intl.DateTimeFormat(DATE_PARTS_FORMAT_LOCALE, { timeZone: candidate }).format(0);
    return candidate;
  } catch {
    return DEFAULT_BUSINESS_TIME_ZONE;
  }
}

function zonedParts(date: Date, timeZone?: string | null) {
  const formatter = new Intl.DateTimeFormat(DATE_PARTS_FORMAT_LOCALE, {
    timeZone: normalizeBusinessTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

export function businessDateKey(date = new Date(), timeZone?: string | null) {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function businessTimeValue(date = new Date(), timeZone?: string | null) {
  const parts = zonedParts(date, timeZone);
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

export function formatBusinessDate(date: Date, timeZone?: string | null, options: Intl.DateTimeFormatOptions = {}) {
  return date.toLocaleDateString(undefined, {
    ...options,
    timeZone: normalizeBusinessTimeZone(timeZone),
  });
}

export function formatBusinessTime(date: Date, timeZone?: string | null, options: Intl.DateTimeFormatOptions = {}) {
  return date.toLocaleTimeString(undefined, {
    ...options,
    timeZone: normalizeBusinessTimeZone(timeZone),
  });
}

export function formatBusinessDateTime(date: Date, timeZone?: string | null, options: Intl.DateTimeFormatOptions = {}) {
  return date.toLocaleString(undefined, {
    ...options,
    timeZone: normalizeBusinessTimeZone(timeZone),
  });
}

export function businessLocalDateTimeToIso(dateValue: string, timeValue: string, timeZone?: string | null) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);
  if (!dateMatch || !timeMatch) return undefined;

  const target = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: 0,
  };
  if (target.month < 1 || target.month > 12 || target.day < 1 || target.day > 31 || target.hour > 23 || target.minute > 59) {
    return undefined;
  }

  const targetAsUtc = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute, 0);
  let instantMs = targetAsUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = zonedParts(new Date(instantMs), timeZone);
    const observedAsUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, observed.second);
    instantMs += targetAsUtc - observedAsUtc;
  }

  const result = new Date(instantMs);
  const resolved = zonedParts(result, timeZone);
  if (resolved.year !== target.year
    || resolved.month !== target.month
    || resolved.day !== target.day
    || resolved.hour !== target.hour
    || resolved.minute !== target.minute) {
    return undefined;
  }
  return result.toISOString();
}