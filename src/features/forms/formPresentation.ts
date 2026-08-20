import type {
  EmployeeFormContext,
  EmployeeFormSubmissionStatus,
  EmployeeFormTrigger,
} from '@/types/forms';
import { formatBusinessDateTime } from '@/utils/businessTime';

export function getFormTriggerLabel(trigger: EmployeeFormTrigger) {
  if (trigger === 'before_clock_in') return 'Before starting your shift';
  if (trigger === 'after_clock_out') return 'End-of-shift form';
  if (trigger === 'before_starting_job') return 'Before starting this job';
  if (trigger === 'after_leaving_job') return 'After leaving this job';
  if (trigger === 'job_completed') return 'After the job is completed';
  if (trigger === 'after_completing_job') return 'Legacy job follow-up';
  if (trigger === 'daily') return 'Due today';
  if (trigger === 'weekly') return 'Due this week';
  if (trigger === 'monthly') return 'Due this month';
  return 'Available anytime';
}

export function getSubmissionStatusLabel(status: EmployeeFormSubmissionStatus) {
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  if (status === 'draft') return 'Draft';
  return 'Pending review';
}

export function getPrimaryContextLabel(context?: EmployeeFormContext) {
  return context?.jobName ?? context?.equipmentName ?? context?.divisionName;
}

export function formatSubmittedAt(value: string, timeZone?: string | null) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Submitted';
  return formatBusinessDateTime(date, timeZone, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}