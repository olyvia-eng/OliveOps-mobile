import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { PendingClockInRecord } from '@/services/pendingClockInStorage';
import { ApiError } from '@/types/errors';

const mockLoadBootstrap = jest.fn();
const mockLoadPendingClockIn = jest.fn();
const mockFinalizeClockIn = jest.fn();
const mockLoadRequiredForms = jest.fn();
const mockSubmitEmployeeForm = jest.fn();
const mockLoadRecord = jest.fn();
const mockSaveRecord = jest.fn();
const mockClearRecord = jest.fn();
const mockRefreshWorkContext = jest.fn();
const mockAcknowledgePendingClockInWorkflow = jest.fn();
let mockOutboxWorkflow: ReturnType<typeof workflow> | null = null;
let mockOnline = true;
let pendingStore: any;
let mockNetworkListener: ((state: { isConnected: boolean; isInternetReachable: boolean }) => void) | null = null;
let mockAppStateListener: ((state: string) => void) | null = null;

const requiredForm = {
  id: 'form-1', name: 'Morning Truck Inspection', trigger: 'before_clock_in' as const, required: true,
  completionRequirement: 'required' as const, context: { jobId: 'job-1' }, fields: [],
  submissionState: { completed: false },
};

function workflow(completed = false) {
  const requirement = { requirementId: 'requirement-1', formId: 'form-1', form: requiredForm };
  return {
    ok: true,
    status: 'clock_in_pending_required_forms' as const,
    blocked: true as const,
    workflowOccurrenceId: 'occurrence-1',
    requiredFormCount: 1,
    completedRequiredFormCount: completed ? 1 : 0,
    remainingRequiredFormCount: completed ? 0 : 1,
    requiredForms: [requirement],
    remainingForms: completed ? [] : [requirement],
    reminderForms: [],
    clockInIntent: { employeeId: 'employee-1', workType: 'job' as const, jobIds: ['job-1'] },
  };
}

function idOnlyWorkflow() {
  const pending = workflow();
  const requirement = { requirementId: 'requirement-1', formId: 'form-1' };
  return { ...pending, requiredForms: [requirement], remainingForms: [requirement] };
}

jest.mock('@/api/clockingApi', () => ({
  loadBootstrap: (...args: unknown[]) => mockLoadBootstrap(...args),
  loadPendingClockIn: (...args: unknown[]) => mockLoadPendingClockIn(...args),
  finalizeClockIn: (...args: unknown[]) => mockFinalizeClockIn(...args),
}));
jest.mock('@/api/formsApi', () => ({
  loadRequiredForms: (...args: unknown[]) => mockLoadRequiredForms(...args),
  submitEmployeeForm: (...args: unknown[]) => mockSubmitEmployeeForm(...args),
}));
jest.mock('@/services/connectivity', () => ({
  isOnline: jest.fn(async () => mockOnline),
}));
jest.mock('@/services/pendingClockInStorage', () => ({
  loadPendingClockInRecord: (...args: unknown[]) => mockLoadRecord(...args),
  savePendingClockInRecord: (...args: unknown[]) => mockSaveRecord(...args),
  clearPendingClockInRecord: (...args: unknown[]) => mockClearRecord(...args),
}));
jest.mock('@/services/requestGuards', () => ({
  createFormClientSubmissionId: jest.fn(() => 'form-submission:stable-1'),
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    accessToken: 'token-1', status: 'authenticated',
    user: { businessId: 'business-1', id: 'user-1', employeeId: 'employee-1' },
  }),
}));
jest.mock('@/hooks/useClockingActions', () => ({
  useClockingActions: () => ({ refreshWorkContext: mockRefreshWorkContext }),
}));
jest.mock('@/store/offlineClockContext', () => ({
  useOptionalOfflineClockStore: () => ({
    pendingClockInWorkflow: mockOutboxWorkflow,
    acknowledgePendingClockInWorkflow: mockAcknowledgePendingClockInWorkflow,
  }),
}));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn((listener) => {
    mockNetworkListener = listener;
    return jest.fn();
  }) },
}));
jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn((_event, listener) => {
    mockAppStateListener = listener;
    return { remove: jest.fn() };
  }) },
  NativeModules: {},
  Platform: { select: (values: any) => values.ios ?? values.default },
  TurboModuleRegistry: { get: () => null },
}));

import { PendingClockInProvider, usePendingClockInStore } from './pendingClockInStore';

function Probe() {
  pendingStore = usePendingClockInStore();
  return React.createElement('pending-probe', {
    occurrenceId: pendingStore.workflow?.workflowOccurrenceId,
    requirementId: pendingStore.currentRequirement?.requirementId,
  });
}

describe('PendingClockInProvider', () => {
  let tree: ReactTestRenderer | undefined;

  beforeEach(() => {
    mockOnline = true;
    mockNetworkListener = null;
    mockAppStateListener = null;
    mockOutboxWorkflow = null;
    mockAcknowledgePendingClockInWorkflow.mockReset();
    mockLoadRecord.mockReset().mockResolvedValue(null);
    mockSaveRecord.mockReset().mockResolvedValue(undefined);
    mockClearRecord.mockReset().mockResolvedValue(undefined);
    mockLoadBootstrap.mockReset().mockResolvedValue({
      ok: true,
      capabilities: { requiredBeforeClockInForms: true },
      pendingClockInWorkflow: workflow(),
    });
    mockLoadPendingClockIn.mockReset().mockResolvedValue(workflow());
    mockFinalizeClockIn.mockReset().mockResolvedValue({ ok: true, status: 'clock_in_completed' });
    mockLoadRequiredForms.mockReset().mockResolvedValue({ ok: true, forms: [requiredForm] });
    mockSubmitEmployeeForm.mockReset().mockResolvedValue({ ok: true, submission: { id: 'submission-1' } });
    mockRefreshWorkContext.mockReset().mockResolvedValue({ ok: true });
  });

  afterEach(async () => {
    if (tree) await act(async () => tree?.unmount());
    tree = undefined;
  });

  async function mount() {
    await act(async () => {
      tree = create(React.createElement(PendingClockInProvider, null, React.createElement(Probe)));
    });
  }

  it('restores bootstrap workflow and persists it for app restart recovery', async () => {
    await mount();

    expect(pendingStore.workflow?.workflowOccurrenceId).toBe('occurrence-1');
    expect(pendingStore.currentRequirement?.requirementId).toBe('requirement-1');
    expect(pendingStore.currentForm).toBe(requiredForm);
    expect(mockLoadRequiredForms).not.toHaveBeenCalled();
    expect(mockSaveRecord).toHaveBeenCalledWith(
      'business-1:user-1:employee-1',
      expect.objectContaining({ workflow: expect.objectContaining({ workflowOccurrenceId: 'occurrence-1' }) }),
    );
  });

  it('normalizes an embedded snapshot across duplicate requirement arrays without discovery', async () => {
    await mount();
    mockLoadRequiredForms.mockClear();
    const pending = workflow();
    const embeddedOnlyInRemaining = {
      ...pending,
      requiredForms: [{ requirementId: 'requirement-1', formId: 'form-1' }],
    };

    let accepted: any;
    await act(async () => { accepted = await pendingStore.acceptWorkflow(embeddedOnlyInRemaining); });

    expect(accepted.requiredForms[0].form).toBe(requiredForm);
    expect(accepted.remainingForms[0].form).toBe(requiredForm);
    expect(pendingStore.currentForm).toBe(requiredForm);
    expect(mockLoadRequiredForms).not.toHaveBeenCalled();
  });

  it('accepts and acknowledges an outbox workflow after persisting its embedded snapshot', async () => {
    mockLoadBootstrap.mockResolvedValue({ ok: true, capabilities: { requiredBeforeClockInForms: false } });
    mockOutboxWorkflow = workflow();

    await mount();

    expect(pendingStore.workflow?.workflowOccurrenceId).toBe('occurrence-1');
    expect(pendingStore.currentForm).toBe(requiredForm);
    expect(mockLoadRequiredForms).not.toHaveBeenCalled();
    expect(mockSaveRecord).toHaveBeenCalledWith(
      'business-1:user-1:employee-1',
      expect.objectContaining({ workflow: mockOutboxWorkflow }),
    );
    expect(mockAcknowledgePendingClockInWorkflow).toHaveBeenCalledTimes(1);
  });

  it('restores the persisted workflow while offline without clearing it', async () => {
    mockOnline = false;
    const stored: PendingClockInRecord = { workflow: workflow(), submissionIds: {}, queuedSubmissions: [] };
    mockLoadRecord.mockResolvedValue(stored);

    await mount();

    expect(pendingStore.workflow?.workflowOccurrenceId).toBe('occurrence-1');
    expect(mockLoadBootstrap).not.toHaveBeenCalled();
    expect(mockClearRecord).not.toHaveBeenCalled();
  });

  it('recovers from the dedicated pending endpoint when bootstrap has no embedded workflow', async () => {
    mockLoadBootstrap.mockResolvedValue({ ok: true, capabilities: { requiredBeforeClockInForms: true } });

    await mount();

    expect(mockLoadPendingClockIn).toHaveBeenCalledWith('token-1');
    expect(pendingStore.currentRequirement?.requirementId).toBe('requirement-1');
  });

  it('returns and persists the canonically enriched workflow for an ID-only requirement', async () => {
    await mount();
    mockLoadRequiredForms.mockResolvedValue({
      ok: true,
      forms: [{ ...requiredForm, id: 'form-other', name: 'Other Form' }, requiredForm],
    });

    let accepted: any;
    await act(async () => { accepted = await pendingStore.acceptWorkflow(idOnlyWorkflow()); });

    expect(accepted.requiredForms[0].form).toEqual(requiredForm);
    expect(accepted.remainingForms[0].form).toEqual(requiredForm);
    expect(pendingStore.currentForm).toEqual(requiredForm);
    expect(mockSaveRecord).toHaveBeenLastCalledWith(
      'business-1:user-1:employee-1',
      expect.objectContaining({
        workflow: expect.objectContaining({
          requiredForms: [expect.objectContaining({ formId: 'form-1', form: requiredForm })],
          remainingForms: [expect.objectContaining({ formId: 'form-1', form: requiredForm })],
        }),
      }),
    );
  });

  it('keeps an ID-only workflow after failed enrichment and resolves it on retry', async () => {
    await mount();
    mockLoadRequiredForms.mockRejectedValueOnce(new Error('temporary failure'));
    await act(async () => { await pendingStore.acceptWorkflow(idOnlyWorkflow()); });

    expect(pendingStore.workflow?.workflowOccurrenceId).toBe('occurrence-1');
    expect(pendingStore.currentForm).toBeNull();
    mockLoadPendingClockIn.mockResolvedValue(idOnlyWorkflow());
    mockLoadRequiredForms.mockResolvedValue({ ok: true, forms: [requiredForm] });

    let resolved: any;
    await act(async () => { resolved = await pendingStore.ensureCurrentForm(); });

    expect(resolved).toEqual(requiredForm);
    expect(pendingStore.currentForm).toEqual(requiredForm);
    expect(mockClearRecord).not.toHaveBeenCalled();
  });

  it('enriches a persisted ID-only workflow after restart', async () => {
    mockLoadRecord.mockResolvedValue({ workflow: idOnlyWorkflow(), submissionIds: {}, queuedSubmissions: [] });
    mockLoadBootstrap.mockResolvedValue({
      ok: true,
      capabilities: { requiredBeforeClockInForms: true },
      pendingClockInWorkflow: idOnlyWorkflow(),
    });

    await mount();

    expect(pendingStore.currentForm).toEqual(requiredForm);
    expect(mockSaveRecord).toHaveBeenCalledWith(
      'business-1:user-1:employee-1',
      expect.objectContaining({
        workflow: expect.objectContaining({
          requiredForms: [expect.objectContaining({ form: requiredForm })],
          remainingForms: [expect.objectContaining({ form: requiredForm })],
        }),
      }),
    );
  });

  it('keeps one stable clientSubmissionId for retries of the same requirement', async () => {
    await mount();

    let first: string | undefined;
    let second: string | undefined;
    await act(async () => {
      first = await pendingStore.submissionIdFor('requirement-1');
      second = await pendingStore.submissionIdFor('requirement-1');
    });

    expect(first).toBe('form-submission:stable-1');
    expect(second).toBe(first);
  });

  it('updates a rejected queued answer without appending a second clock-in attempt', async () => {
    mockOnline = false;
    const rejectedPayload = {
      clientSubmissionId: 'form-submission:stable-1', formId: 'form-1', trigger: 'before_clock_in' as const,
      workflowOccurrenceId: 'occurrence-1', workflowRequirementId: 'requirement-1',
      responses: [{ fieldId: 'fit', value: 'no' }],
    };
    mockLoadRecord.mockResolvedValue({
      workflow: workflow(), submissionIds: { 'requirement-1': rejectedPayload.clientSubmissionId },
      queuedSubmissions: [rejectedPayload],
      submissionFailure: {
        workflowRequirementId: 'requirement-1', code: 'form_response_requirement_failed',
        error: 'Contact your supervisor.', fieldId: 'fit',
      },
    });
    await mount();
    const correctedPayload = { ...rejectedPayload, responses: [{ fieldId: 'fit', value: 'yes' }] };

    await act(async () => pendingStore.queueSubmission(correctedPayload));

    expect(pendingStore.queuedSubmissionFor('requirement-1')).toEqual(correctedPayload);
    expect(mockSaveRecord).toHaveBeenLastCalledWith(
      'business-1:user-1:employee-1',
      expect.objectContaining({ queuedSubmissions: [correctedPayload], submissionFailure: undefined }),
    );
  });

  it('treats clock_in_already_finalized as idempotent success and clears local state', async () => {
    mockFinalizeClockIn.mockResolvedValue({ ok: true, status: 'clock_in_already_finalized' });
    await mount();

    let result: any;
    await act(async () => {
      result = await pendingStore.finalize();
    });

    expect(result).toEqual({ ok: true });
    expect(mockFinalizeClockIn).toHaveBeenCalledWith({ workflowOccurrenceId: 'occurrence-1' }, 'token-1');
    expect(pendingStore.workflow).toBeNull();
    expect(mockRefreshWorkContext).not.toHaveBeenCalled();
  });

  it('does not auto-finalize a completed bootstrap workflow without queued submissions', async () => {
    mockLoadBootstrap.mockResolvedValue({
      ok: true,
      capabilities: { requiredBeforeClockInForms: true },
      pendingClockInWorkflow: workflow(true),
    });
    mockLoadPendingClockIn.mockResolvedValue(workflow(true));

    await mount();

    expect(mockFinalizeClockIn).not.toHaveBeenCalled();
    expect(mockRefreshWorkContext).not.toHaveBeenCalled();
  });

  it('does not auto-finalize from NetInfo when no queued submission was processed', async () => {
    await mount();
    mockFinalizeClockIn.mockClear();

    await act(async () => mockNetworkListener?.({ isConnected: true, isInternetReachable: true }));

    expect(mockFinalizeClockIn).not.toHaveBeenCalled();
  });

  it('does not auto-finalize from AppState when no queued submission was processed', async () => {
    await mount();
    mockFinalizeClockIn.mockClear();

    await act(async () => mockAppStateListener?.('active'));

    expect(mockFinalizeClockIn).not.toHaveBeenCalled();
  });

  it('auto-finalizes after replaying a genuinely queued clock-in form submission', async () => {
    const payload = {
      clientSubmissionId: 'form-submission:queued-1', formId: 'form-1', trigger: 'before_clock_in' as const,
      workflowOccurrenceId: 'occurrence-1', workflowRequirementId: 'requirement-1', responses: [],
    };
    mockLoadRecord.mockResolvedValue({ workflow: workflow(), submissionIds: {}, queuedSubmissions: [payload] });
    mockLoadPendingClockIn.mockResolvedValue(workflow(true));

    await mount();

    expect(mockSubmitEmployeeForm).toHaveBeenCalledWith(payload, 'token-1');
    expect(mockFinalizeClockIn).toHaveBeenCalledTimes(1);
    expect(mockRefreshWorkContext).toHaveBeenCalledTimes(1);
    expect(pendingStore.workflow).toBeNull();
  });

  it('retains a server-rejected queued clock-in response without finalizing', async () => {
    const payload = {
      clientSubmissionId: 'form-submission:queued-rejected', formId: 'form-1', trigger: 'before_clock_in' as const,
      workflowOccurrenceId: 'occurrence-1', workflowRequirementId: 'requirement-1',
      responses: [{ fieldId: 'fit', value: 'no' }],
    };
    mockLoadRecord.mockResolvedValue({ workflow: workflow(), submissionIds: {}, queuedSubmissions: [payload] });
    mockSubmitEmployeeForm.mockRejectedValue(new ApiError(
      'Contact your supervisor.', 400, 'form_response_requirement_failed', 'fit',
    ));

    await mount();

    expect(mockFinalizeClockIn).not.toHaveBeenCalled();
    expect(pendingStore.queuedSubmissionFor('requirement-1')).toEqual(payload);
    expect(pendingStore.submissionFailure).toEqual({
      workflowRequirementId: 'requirement-1', code: 'form_response_requirement_failed',
      error: 'Contact your supervisor.', fieldId: 'fit',
    });
    expect(mockSaveRecord).toHaveBeenLastCalledWith(
      'business-1:user-1:employee-1',
      expect.objectContaining({ queuedSubmissions: [payload] }),
    );
  });

  it('shares one successful clock-in finalization across simultaneous callers', async () => {
    await mount();
    let resolveFinalize!: (result: { ok: true; status: 'clock_in_completed' }) => void;
    mockFinalizeClockIn.mockClear().mockImplementationOnce(() => new Promise((resolve) => { resolveFinalize = resolve; }));

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    await act(async () => {
      first = pendingStore.finalize();
      second = pendingStore.finalize();
      await Promise.resolve();
    });

    expect(first).toBe(second);
    expect(mockFinalizeClockIn).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveFinalize({ ok: true, status: 'clock_in_completed' });
      await Promise.all([first, second]);
    });
    await expect(first).resolves.toEqual({ ok: true });
    await expect(second).resolves.toEqual({ ok: true });
    expect(mockFinalizeClockIn).toHaveBeenCalledTimes(1);
    expect(pendingStore.error).toBeNull();
  });

  it('recovers a temporarily missing local workflow and finalizes its exact occurrence', async () => {
    await mount();
    mockLoadPendingClockIn.mockResolvedValueOnce({ ok: true, status: 'no_pending_clock_in' });
    await act(async () => { await pendingStore.recover(); });
    expect(pendingStore.workflow).toBeNull();
    mockLoadBootstrap.mockResolvedValueOnce({
      ok: true,
      capabilities: { requiredBeforeClockInForms: true },
      pendingClockInWorkflow: workflow(true),
      currentActiveEntryId: null,
    });

    let result: any;
    await act(async () => { result = await pendingStore.finalize(); });

    expect(result).toEqual({ ok: true });
    expect(mockFinalizeClockIn).toHaveBeenCalledWith({ workflowOccurrenceId: 'occurrence-1' }, 'token-1');
    expect(mockFinalizeClockIn).toHaveBeenCalledTimes(1);
  });

  it('treats an authoritative active shift as successful when the local workflow is missing', async () => {
    await mount();
    mockLoadPendingClockIn.mockResolvedValueOnce({ ok: true, status: 'no_pending_clock_in' });
    await act(async () => { await pendingStore.recover(); });
    mockLoadBootstrap.mockResolvedValueOnce({
      ok: true,
      capabilities: { requiredBeforeClockInForms: true },
      pendingClockInWorkflow: null,
      currentActiveEntryId: 'entry-1',
    });

    let result: any;
    await act(async () => { result = await pendingStore.finalize(); });

    expect(result).toEqual({ ok: true });
    expect(mockFinalizeClockIn).not.toHaveBeenCalled();
    expect(pendingStore.workflow).toBeNull();
  });

  it('returns a controlled error only after authoritative recovery confirms no workflow or active shift', async () => {
    await mount();
    mockLoadPendingClockIn.mockResolvedValue({ ok: true, status: 'no_pending_clock_in' });
    await act(async () => { await pendingStore.recover(); });
    mockLoadBootstrap.mockResolvedValueOnce({
      ok: true,
      capabilities: { requiredBeforeClockInForms: true },
      pendingClockInWorkflow: null,
      currentActiveEntryId: null,
    });

    let result: any;
    await act(async () => { result = await pendingStore.finalize(); });

    expect(result).toEqual({ ok: false, error: 'No pending clock-in was found after refreshing.' });
    expect(mockLoadPendingClockIn).toHaveBeenCalledTimes(2);
    expect(mockFinalizeClockIn).not.toHaveBeenCalled();
  });

  it('shares one recovery and finalization when repeated taps start without a local workflow', async () => {
    await mount();
    mockLoadPendingClockIn.mockResolvedValueOnce({ ok: true, status: 'no_pending_clock_in' });
    await act(async () => { await pendingStore.recover(); });
    let resolveBootstrap!: (result: any) => void;
    mockLoadBootstrap.mockImplementationOnce(() => new Promise((resolve) => { resolveBootstrap = resolve; }));

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    await act(async () => {
      first = pendingStore.finalize();
      second = pendingStore.finalize();
      await Promise.resolve();
    });

    expect(first).toBe(second);
    await act(async () => {
      resolveBootstrap({
        ok: true,
        pendingClockInWorkflow: workflow(true),
        currentActiveEntryId: null,
      });
      await Promise.all([first, second]);
    });
    expect(mockFinalizeClockIn).toHaveBeenCalledTimes(1);
    await expect(first).resolves.toEqual({ ok: true });
    await expect(second).resolves.toEqual({ ok: true });
  });

  it('refreshes the authoritative workflow for required_forms_outstanding', async () => {
    mockFinalizeClockIn.mockResolvedValue({ ok: true, status: 'required_forms_outstanding' });
    await mount();

    let result: any;
    await act(async () => { result = await pendingStore.finalize(); });

    expect(result).toEqual({ ok: false, error: 'Complete the remaining required form.' });
    expect(mockLoadPendingClockIn).toHaveBeenCalled();
    expect(pendingStore.workflow?.workflowOccurrenceId).toBe('occurrence-1');
  });
});