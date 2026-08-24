import { dateFromCanonicalValue } from '@/features/forms/formValidation';
import type { TimeOffRequestStatus, TimeOffRequestType } from '@/types/timeOff';

const typeLabels: Record<TimeOffRequestType, string> = {
  vacation: 'Vacation',
  sick: 'Sick',
  personal: 'Personal',
  unpaid: 'Unpaid',
  other: 'Other',
};

const statusLabels: Record<TimeOffRequestStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  denied: 'Denied',
  cancelled: 'Cancelled',
};

export function getTimeOffTypeLabel(type: TimeOffRequestType) {
  return typeLabels[type];
}

export function getTimeOffStatusLabel(status: TimeOffRequestStatus) {
  return statusLabels[status];
}

function formatCalendarDate(value: string, includeYear = false) {
  return dateFromCanonicalValue(value)?.toLocaleDateString([], {
    month: 'short', day: 'numeric', ...(includeYear ? { year: 'numeric' as const } : {}),
  }) ?? value;
}

export function formatTimeOffDateRange(startDate: string, endDate: string, includeYear = false) {
  const start = formatCalendarDate(startDate, includeYear);
  if (startDate === endDate) return start;
  return `${start} – ${formatCalendarDate(endDate, includeYear)}`;
}

export function statusBadgeTone(status: TimeOffRequestStatus): 'neutral' | 'active' | 'success' | 'error' {
  if (status === 'pending') return 'active';
  if (status === 'approved') return 'success';
  if (status === 'denied') return 'error';
  return 'neutral';
}