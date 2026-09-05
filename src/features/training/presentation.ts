import type { TrainingRecurrenceType, TrainingStatus } from '@/types/training';

export function getTrainingStatusLabel(status: TrainingStatus) {
  if (status === 'due_soon') return 'Due soon';
  if (status === 'overdue') return 'Overdue';
  if (status === 'current') return 'Current';
  if (status === 'revoked') return 'Revoked';
  return 'Not started';
}

export function getTrainingStatusTone(status: TrainingStatus): 'neutral' | 'active' | 'success' | 'error' {
  if (status === 'overdue') return 'error';
  if (status === 'due_soon') return 'active';
  if (status === 'current') return 'success';
  return 'neutral';
}

export function getRecurrenceLabel(type: TrainingRecurrenceType, months: number | null) {
  if (type === 'one_time') return 'One time';
  if (type === 'annual') return 'Annual';
  return `Every ${months ?? 1} months`;
}

export function formatTrainingDate(value?: string | null, includeTime = false) {
  if (!value) return 'Not scheduled';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' });
}