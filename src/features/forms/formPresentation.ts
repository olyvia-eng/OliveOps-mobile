import type {
  EmployeeFormContext,
  EmployeeFormSubmissionStatus,
  EmployeeFormTrigger,
} from '@/types/forms';

export function getFormTriggerLabel(trigger: EmployeeFormTrigger) {
  if (trigger === 'before_clock_in') return 'Required before clock in';
  if (trigger === 'after_clock_out') return 'Required after clock out';
  if (trigger === 'before_starting_job') return 'Required before starting job';
  if (trigger === 'after_completing_job') return 'Required after completing job';
  if (trigger === 'daily') return 'Due this business day';
  if (trigger === 'weekly') return 'Due this business week';
  if (trigger === 'monthly') return 'Due this business month';
  return 'Available on demand';
}

export function getSubmissionStatusLabel(status: EmployeeFormSubmissionStatus) {
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Needs resubmission';
  if (status === 'draft') return 'Draft';
  return 'Submitted';
}

export function getPrimaryContextLabel(context?: EmployeeFormContext) {
  return context?.jobName ?? context?.equipmentName ?? context?.divisionName;
}

export function formatSubmittedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Submitted';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}