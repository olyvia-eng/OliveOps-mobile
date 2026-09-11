import type { ServiceVisitStatus, ServiceVisitSummary } from '@/types/serviceVisit';
import { formatBusinessTime } from '@/utils/businessTime';

export function serviceVisitStatusLabel(status: ServiceVisitStatus) {
  if (status === 'in_progress') return 'In Progress';
  if (status === 'completed') return 'Complete';
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

export function serviceVisitStatusTone(status: ServiceVisitStatus) {
  if (status === 'in_progress') return 'active' as const;
  if (status === 'completed') return 'success' as const;
  if (status === 'cancelled' || status === 'skipped') return 'neutral' as const;
  return 'neutral' as const;
}

export function serviceVisitTimeLabel(visit: ServiceVisitSummary, timeZone: string) {
  if (visit.scheduleAllDay || !visit.scheduledStartAt) return 'All day';
  return formatBusinessTime(new Date(visit.scheduledStartAt), timeZone, { hour: 'numeric', minute: '2-digit' });
}

export function serviceVisitPlaceLabel(visit: Pick<ServiceVisitSummary, 'propertyName' | 'customerName' | 'jobName'>) {
  return visit.propertyName || visit.customerName || visit.jobName;
}