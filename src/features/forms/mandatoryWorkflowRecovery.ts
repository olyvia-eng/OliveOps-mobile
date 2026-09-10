import type { PendingClockInWorkflow, PendingClockOutWorkflow } from '@/types/api';

export const MANDATORY_COMPLETION_CONFLICT_CODES = new Set([
  'workflow_requirement_already_completed',
  'clock_in_workflow_already_finalized',
  'clock_out_workflow_already_finalized',
]);

export function isMandatoryCompletionConflict(code: string | undefined) {
  return Boolean(code && MANDATORY_COMPLETION_CONFLICT_CODES.has(code));
}

export function clockInRequirementIsCompleted(
  workflow: PendingClockInWorkflow,
  workflowOccurrenceId: string,
  workflowRequirementId: string,
) {
  if (workflow.workflowOccurrenceId !== workflowOccurrenceId) return false;
  return (workflow.requiredForms ?? []).some((requirement) => (
    requirement.requirementId === workflowRequirementId && requirement.completed === true
  ));
}

export function clockOutRequirementIsCompleted(
  workflow: PendingClockOutWorkflow,
  workflowOccurrenceId: string,
  workflowRequirementId: string,
) {
  if (workflow.workflowOccurrenceId !== workflowOccurrenceId) return false;
  const requirements = workflow.requirements ?? workflow.requiredForms ?? workflow.requiredFormPackages ?? [];
  return requirements.some((requirement) => (
    requirement.workflowRequirementId === workflowRequirementId && requirement.completed === true
  ));
}