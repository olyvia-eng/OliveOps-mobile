import { describe, expect, it } from '@jest/globals';
import {
  clockInRequirementIsCompleted,
  clockOutRequirementIsCompleted,
  isMandatoryCompletionConflict,
} from './mandatoryWorkflowRecovery';

describe('mandatory workflow recovery', () => {
  it('recognizes only deterministic completion conflicts', () => {
    expect(isMandatoryCompletionConflict('workflow_requirement_already_completed')).toBe(true);
    expect(isMandatoryCompletionConflict('clock_out_workflow_already_finalized')).toBe(true);
    expect(isMandatoryCompletionConflict('clock_in_workflow_already_finalized')).toBe(true);
    expect(isMandatoryCompletionConflict('submission_idempotency_conflict')).toBe(false);
  });

  it('requires exact clock-out occurrence and requirement completion', () => {
    const workflow = {
      status: 'clock_out_pending_required_forms' as const,
      blocked: true as const,
      workflowOccurrenceId: 'occurrence-1', intendedClockOutAt: '2026-09-10T20:00:00.000Z',
      requirements: [{ workflowRequirementId: 'requirement-1', completed: true }],
    };
    expect(clockOutRequirementIsCompleted(workflow, 'occurrence-1', 'requirement-1')).toBe(true);
    expect(clockOutRequirementIsCompleted(workflow, 'occurrence-2', 'requirement-1')).toBe(false);
    expect(clockOutRequirementIsCompleted(workflow, 'occurrence-1', 'requirement-2')).toBe(false);
  });

  it('requires exact clock-in occurrence and requirement completion', () => {
    const requirement = { requirementId: 'requirement-1', formId: 'form-1', completed: true };
    const workflow = {
      status: 'clock_in_pending_required_forms' as const, blocked: true as const,
      workflowOccurrenceId: 'occurrence-1', requiredFormCount: 1, completedRequiredFormCount: 1,
      remainingRequiredFormCount: 0, requiredForms: [requirement], remainingForms: [], reminderForms: [],
      clockInIntent: { employeeId: 'employee-1', workType: 'job' as const, jobIds: ['job-1'] },
    };
    expect(clockInRequirementIsCompleted(workflow, 'occurrence-1', 'requirement-1')).toBe(true);
    expect(clockInRequirementIsCompleted(workflow, 'occurrence-1', 'requirement-2')).toBe(false);
  });
});