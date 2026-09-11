import type { BootstrapResponse } from '@/types/api';

function safeCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
}

export function getBootstrapTrainingAttention(payload: BootstrapResponse) {
  const overdue = safeCount(payload.overdueTrainingCount);
  const dueSoon = safeCount(payload.dueSoonTrainingCount);
  const total = safeCount(payload.trainingAttentionCount);

  if (overdue === null && dueSoon === null && total === null) return null;

  const normalizedOverdue = overdue ?? 0;
  return {
    overdueCount: normalizedOverdue,
    dueSoonCount: dueSoon ?? Math.max(0, (total ?? normalizedOverdue) - normalizedOverdue),
  };
}