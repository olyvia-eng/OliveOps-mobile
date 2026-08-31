import { sanitizeSentryEvent } from './sentryPrivacy';

describe('sanitizeSentryEvent', () => {
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
});