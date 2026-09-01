import { sanitizeSentryEvent } from './sentryPrivacy';

describe('sanitizeSentryEvent', () => {
  it('retains safe finalization-result facts and drops form answers', () => {
    const sanitized = sanitizeSentryEvent({
      message: 'clock_in_finalize_result',
      contexts: {
        clock_in_finalize_result: {
          status: 'clock_in_completed',
          httpSuccess: true,
          workflowOccurrenceId: 'occurrence-1',
          responseTimeEntryPresent: true,
          responseTimeEntryIdPresent: true,
          responseTimeEntryStatus: 'clocked_in',
          bootstrapActiveEntryPresent: true,
          bootstrapCurrentActiveEntryIdPresent: true,
          matchingResponseEntryInBootstrap: true,
          pendingWorkflowStillPresent: false,
          effectiveActiveSource: 'server',
        },
        form_answers: { response: 'confidential' },
      },
    });

    expect(sanitized.contexts).toEqual({
      clock_in_finalize_result: {
        status: 'clock_in_completed',
        httpSuccess: true,
        workflowOccurrenceId: 'occurrence-1',
        responseTimeEntryPresent: true,
        responseTimeEntryIdPresent: true,
        responseTimeEntryStatus: 'clocked_in',
        bootstrapActiveEntryPresent: true,
        bootstrapCurrentActiveEntryIdPresent: true,
        matchingResponseEntryInBootstrap: true,
        pendingWorkflowStillPresent: false,
        effectiveActiveSource: 'server',
      },
    });
  });

  it('retains safe clock-in finalization diagnostics and drops unrelated custom context', () => {
    const sanitized = sanitizeSentryEvent({
      message: 'clock_in_finalize_failed',
      contexts: {
        clock_in_finalize: {
          workflowOccurrenceId: 'occurrence-1',
          resultCode: 'request_timeout',
          httpStatus: 408,
          pendingPhase: 'ready_to_finalize',
          requiredFormCount: 1,
          completedRequiredFormCount: 1,
          remainingRequiredFormCount: 0,
          clockingContractVersion: 2,
          isJobWork: true,
          jobCount: 1,
          hasWorkAreaId: true,
        },
        form_answers: { response: 'confidential' },
      },
    });

    expect(sanitized.contexts).toEqual({
      clock_in_finalize: {
        workflowOccurrenceId: 'occurrence-1',
        resultCode: 'request_timeout',
        httpStatus: 408,
        pendingPhase: 'ready_to_finalize',
        requiredFormCount: 1,
        completedRequiredFormCount: 1,
        remainingRequiredFormCount: 0,
        clockingContractVersion: 2,
        isJobWork: true,
        jobCount: 1,
        hasWorkAreaId: true,
      },
    });
  });

  it('retains safe active-shift conflict diagnostics', () => {
    const sanitized = sanitizeSentryEvent({
      message: 'clock_in_state_conflict',
      contexts: {
        clock_in_state_conflict: {
          workflowOccurrenceId: 'occurrence-1',
          activeShiftPresent: true,
          pendingWorkflowPresent: true,
          remainingRequiredFormCount: 0,
          completedRequiredFormCount: 1,
          serverPendingWorkflowPresent: false,
          localPendingWorkflowPresent: true,
          clockingContractVersion: 2,
          lastFinalizeResultCode: 'offline_shift_state_conflict',
        },
        form_answers: { response: 'confidential' },
      },
    });

    expect(sanitized.contexts).toEqual({
      clock_in_state_conflict: {
        workflowOccurrenceId: 'occurrence-1',
        activeShiftPresent: true,
        pendingWorkflowPresent: true,
        remainingRequiredFormCount: 0,
        completedRequiredFormCount: 1,
        serverPendingWorkflowPresent: false,
        localPendingWorkflowPresent: true,
        clockingContractVersion: 2,
        lastFinalizeResultCode: 'offline_shift_state_conflict',
      },
    });
  });

  it('retains safe offline ownership diagnostics', () => {
    const sanitized = sanitizeSentryEvent({
      message: 'offline_clock_mandatory_handoff',
      contexts: {
        offline_clock_reconcile: {
          serverActiveEntryPresent: false,
          currentActiveEntryIdPresent: false,
          offlineSyntheticActivePresent: true,
          pendingOfflineClockInCount: 1,
          pendingMandatoryWorkflowPresent: true,
          effectiveActiveSource: 'offline_pending',
        },
        form_answers: { response: 'confidential' },
      },
    });

    expect(sanitized.contexts).toEqual({
      offline_clock_reconcile: {
        serverActiveEntryPresent: false,
        currentActiveEntryIdPresent: false,
        offlineSyntheticActivePresent: true,
        pendingOfflineClockInCount: 1,
        pendingMandatoryWorkflowPresent: true,
        effectiveActiveSource: 'offline_pending',
      },
    });
  });
});