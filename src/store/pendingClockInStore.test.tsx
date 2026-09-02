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
let mockRefreshWorkContextAction = mockRefreshWorkContext;
const mockAcknowledgePendingClockInWorkflow = jest.fn();
const mockPrepareFormSubmissionAttachments = jest.fn();
const mockMarkFormAttachmentsSubmitted = jest.fn();
const mockCaptureMessage = jest.fn();
const mockUpsertTimeEntry = jest.fn();
const mockSetCurrentActiveEntryId = jest.fn();
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

function finalizedTimeEntry(id = 'entry-real') {
  return {
    id, employeeId: 'employee-1', status: 'clocked_in' as const, workType: 'job' as const, jobIds: ['job-1'],
    clockIn: '2026-08-31T10:00:00.000Z', breakMinutes: 0, notes: '',
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
jest.mock('@sentry/react-native', () => ({
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
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
jest.mock('@/services/formAttachmentStorage', () => ({
  prepareFormSubmissionAttachments: (...args: unknown[]) => mockPrepareFormSubmissionAttachments(...args),
  markFormAttachmentsSubmitted: (...args: unknown[]) => mockMarkFormAttachmentsSubmitted(...args),
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    accessToken: 'token-1', status: 'authenticated',
    user: { businessId: 'business-1', id: 'user-1', employeeId: 'employee-1' },
  }),
}));
jest.mock('@/store/clockingStore', () => ({
  useClockingStore: () => ({
    upsertTimeEntry: mockUpsertTimeEntry,
    setCurrentActiveEntryId: mockSetCurrentActiveEntryId,
  }),
}));
jest.mock('@/hooks/useClockingActions', () => ({
  useClockingActions: () => ({ refreshWorkContext: mockRefreshWorkContextAction }),
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

import { pendingClockInPhase, PendingClockInProvider, usePendingClockInStore } from './pendingClockInStore';

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
    mockFinalizeClockIn.mockReset().mockResolvedValue({
      ok: true, status: 'clock_in_completed', timeEntry: finalizedTimeEntry(),
    });
    mockLoadRequiredForms.mockReset().mockResolvedValue({ ok: true, forms: [requiredForm] });
    mockSubmitEmployeeForm.mockReset().mockResolvedValue({ ok: true, submission: { id: 'submission-1' } });
    mockRefreshWorkContext.mockReset().mockResolvedValue({ ok: true });
    mockRefreshWorkContextAction = mockRefreshWorkContext;
    mockPrepareFormSubmissionAttachments.mockReset().mockImplementation(async (payload) => payload);
    mockMarkFormAttachmentsSubmitted.mockReset().mockResolvedValue(undefined);
    mockCaptureMessage.mockReset();
    mockUpsertTimeEntry.mockReset();
    mockSetCurrentActiveEntryId.mockReset();
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

  it('normalizes requirement progress without allowing a current value above the total', () => {
    expect(pendingClockInPhase(workflow())).toEqual({
      kind: 'requirements_outstanding', current: 1, total: 1,
    });
    expect(pendingClockInPhase({
      ...workflow(), requiredFormCount: 2, completedRequiredFormCount: 0,
      remainingRequiredFormCount: 2,
    })).toEqual({ kind: 'requirements_outstanding', current: 1, total: 2 });
    expect(pendingClockInPhase({
      ...workflow(), requiredFormCount: 2, completedRequiredFormCount: 1, remainingRequiredFormCount: 1,
    })).toEqual({ kind: 'requirements_outstanding', current: 2, total: 2 });
    expect(pendingClockInPhase({
      ...workflow(true), requiredFormCount: 2, completedRequiredFormCount: 2,
    })).toEqual({ kind: 'ready_to_finalize', total: 2 });
    expect(pendingClockInPhase(workflow(true))).toEqual({ kind: 'ready_to_finalize', total: 1 });
  });

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

  it('clears a stale completed SQLite workflow when bootstrap confirms an active shift', async () => {
    const stored: PendingClockInRecord = { workflow: workflow(true), submissionIds: {}, queuedSubmissions: [] };
    mockLoadRecord.mockResolvedValue(stored);
    mockLoadBootstrap.mockResolvedValue({
      ok: true,
      capabilities: { requiredBeforeClockInForms: true },
      pendingClockInWorkflow: null,
      currentActiveEntryId: 'entry-1',
      timeEntries: [{
        id: 'entry-1', employeeId: 'employee-1', status: 'clocked_in', workType: 'job',
        jobIds: ['job-1'], clockIn: '2026-08-07T10:00:00.000Z', breakMinutes: 0, notes: '',
      }],
    });

    await mount();

    expect(pendingStore.workflow).toBeNull();
    expect(pendingStore.error).toBeNull();
    expect(mockClearRecord).toHaveBeenCalledWith('business-1:user-1:employee-1');
    expect(mockFinalizeClockIn).not.toHaveBeenCalled();
    expect(mockCaptureMessage).toHaveBeenCalledWith('clock_in_state_conflict', expect.objectContaining({
      level: 'warning',
      contexts: { clock_in_state_conflict: expect.objectContaining({
        workflowOccurrenceId: 'occurrence-1',
        activeShiftPresent: true,
        serverPendingWorkflowPresent: false,
        localPendingWorkflowPresent: true,
      }) },
    }));
  });

  it('reconciles a matching server workflow to an authoritative active shift without finalizing again', async () => {
    const completed = workflow(true);
    mockLoadBootstrap.mockResolvedValue({
      ok: true,
      capabilities: { requiredBeforeClockInForms: true, workAreaClockingVersion: 2 },
      pendingClockInWorkflow: completed,
      currentActiveEntryId: 'entry-1',
      timeEntries: [{
        id: 'entry-1', employeeId: 'employee-1', status: 'clocked_in', workType: 'job',
        jobIds: ['job-1'], clockIn: '2026-08-07T10:00:00.000Z', breakMinutes: 0, notes: '',
      }],
    });

    await mount();

    expect(pendingStore.workflow).toBeNull();
    expect(mockFinalizeClockIn).not.toHaveBeenCalled();
    expect(mockClearRecord).toHaveBeenCalledWith('business-1:user-1:employee-1');
    expect(mockCaptureMessage).toHaveBeenCalledWith('clock_in_state_conflict', expect.objectContaining({
      contexts: { clock_in_state_conflict: expect.objectContaining({
        serverPendingWorkflowPresent: true,
        localPendingWorkflowPresent: false,
        completedRequiredFormCount: 1,
        remainingRequiredFormCount: 0,
      }) },
    }));
  });

  it('does not restore a retry path when SQLite cleanup fails after active-shift reconciliation', async () => {
    const stored: PendingClockInRecord = { workflow: workflow(true), submissionIds: {}, queuedSubmissions: [] };
    mockLoadRecord.mockResolvedValue(stored);
    mockClearRecord.mockRejectedValue(new Error('SQLite unavailable'));
    mockLoadBootstrap.mockResolvedValue({
      ok: true,
      capabilities: { requiredBeforeClockInForms: true },
      pendingClockInWorkflow: null,
      currentActiveEntryId: 'entry-1',
      timeEntries: [{
        id: 'entry-1', employeeId: 'employee-1', status: 'clocked_in', workType: 'job',
        jobIds: ['job-1'], clockIn: '2026-08-07T10:00:00.000Z', breakMinutes: 0, notes: '',
      }],
    });

    await mount();
    await act(async () => mockAppStateListener?.('active'));

    expect(pendingStore.workflow).toBeNull();
    expect(mockFinalizeClockIn).not.toHaveBeenCalled();
    expect(mockCaptureMessage).toHaveBeenCalledWith('clock_in_state_cleanup_failed', expect.anything());
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

  it('consumes the completed TimeEntry before clearing and remains active when bootstrap fails', async () => {
    const timeEntry = {
      id: 'entry-real', employeeId: 'employee-1', status: 'clocked_in', workType: 'job', jobIds: ['job-1'],
      clockIn: '2026-08-31T10:00:00.000Z', breakMinutes: 0, notes: '',
    };
    mockFinalizeClockIn.mockResolvedValue({ ok: true, status: 'clock_in_completed', timeEntry });
    mockLoadBootstrap.mockResolvedValueOnce({
      ok: true, capabilities: { requiredBeforeClockInForms: true }, pendingClockInWorkflow: workflow(),
    }).mockRejectedValueOnce(new TypeError('bootstrap unavailable'));
    await mount();

    let result: any;
    await act(async () => { result = await pendingStore.finalize(); });

    expect(result).toEqual({ ok: true });
    expect(mockUpsertTimeEntry).toHaveBeenCalledWith(timeEntry);
    expect(mockSetCurrentActiveEntryId).toHaveBeenCalledWith('entry-real');
    expect(pendingStore.workflow).toBeNull();
  });

  it('consumes an HTTP-200 already-finalized TimeEntry before clearing', async () => {
    const timeEntry = {
      id: 'entry-existing', employeeId: 'employee-1', status: 'clocked_in', workType: 'job', jobIds: ['job-1'],
      clockIn: '2026-08-31T10:00:00.000Z', breakMinutes: 0, notes: '',
    };
    mockFinalizeClockIn.mockResolvedValue({ ok: true, status: 'clock_in_already_finalized', timeEntry });
    await mount();

    let result: any;
    await act(async () => { result = await pendingStore.finalize(); });

    expect(result).toEqual({ ok: true });
    expect(mockUpsertTimeEntry).toHaveBeenCalledWith(timeEntry);
    expect(mockSetCurrentActiveEntryId).toHaveBeenCalledWith('entry-existing');
    expect(pendingStore.workflow).toBeNull();
  });

  it('proves HTTP-200 already-finalized without a TimeEntry before clearing', async () => {
    const activeEntry = {
      id: 'entry-bootstrap', employeeId: 'employee-1', status: 'clocked_in', workType: 'job', jobIds: ['job-1'],
      clockIn: '2026-08-31T10:00:00.000Z', breakMinutes: 0, notes: '',
    };
    mockFinalizeClockIn.mockResolvedValue({ ok: true, status: 'clock_in_already_finalized' });
    mockLoadBootstrap.mockResolvedValueOnce({
      ok: true, capabilities: { requiredBeforeClockInForms: true }, pendingClockInWorkflow: workflow(),
    }).mockResolvedValueOnce({
      ok: true, currentActiveEntryId: activeEntry.id, timeEntries: [activeEntry], pendingClockInWorkflow: null,
    });
    await mount();

    let result: any;
    await act(async () => { result = await pendingStore.finalize(); });

    expect(result).toEqual({ ok: true });
    expect(mockUpsertTimeEntry).toHaveBeenCalledWith(activeEntry);
    expect(mockSetCurrentActiveEntryId).toHaveBeenCalledWith(activeEntry.id);
    expect(pendingStore.workflow).toBeNull();
  });

  it('retains HTTP-200 already-finalized when bootstrap proves no active TimeEntry', async () => {
    mockFinalizeClockIn.mockResolvedValue({ ok: true, status: 'clock_in_already_finalized' });
    mockLoadBootstrap.mockResolvedValueOnce({
      ok: true, capabilities: { requiredBeforeClockInForms: true }, pendingClockInWorkflow: workflow(),
    }).mockResolvedValueOnce({
      ok: true, currentActiveEntryId: null, timeEntries: [], pendingClockInWorkflow: workflow(true),
    });
    await mount();

    let result: any;
    await act(async () => { result = await pendingStore.finalize(); });

    expect(result).toEqual({ ok: false, error: 'Clock-in completion could not be verified. Your required form progress is still saved.' });
    expect(mockUpsertTimeEntry).not.toHaveBeenCalled();
    expect(mockSetCurrentActiveEntryId).not.toHaveBeenCalled();
    expect(pendingStore.workflow?.workflowOccurrenceId).toBe('occurrence-1');
    expect(mockClearRecord).not.toHaveBeenCalled();
    expect(mockCaptureMessage).toHaveBeenCalledWith('clock_in_finalize_result', expect.anything());
  });

  it('treats thrown clock_in_already_finalized only after authoritative recovery', async () => {
    mockFinalizeClockIn.mockRejectedValue(new ApiError('Already finalized', 409, 'clock_in_already_finalized'));
    mockLoadBootstrap.mockResolvedValueOnce({
      ok: true, capabilities: { requiredBeforeClockInForms: true }, pendingClockInWorkflow: workflow(true),
    }).mockResolvedValueOnce({
      ok: true, currentActiveEntryId: null, timeEntries: [], pendingClockInWorkflow: workflow(true),
    });
    await mount();

    let result: any;
    await act(async () => { result = await pendingStore.finalize(); });

    expect(result.ok).toBe(false);
    expect(mockFinalizeClockIn).toHaveBeenCalledWith({ workflowOccurrenceId: 'occurrence-1' }, 'token-1');
    expect(pendingStore.workflow?.workflowOccurrenceId).toBe('occurrence-1');
  });

  it('auto-finalizes a completed bootstrap workflow without requiring a queued submission', async () => {
    mockLoadBootstrap.mockResolvedValue({
      ok: true,
      capabilities: { requiredBeforeClockInForms: true },
      pendingClockInWorkflow: workflow(true),
    });
    mockLoadPendingClockIn.mockResolvedValue(workflow(true));

    await mount();

    expect(mockFinalizeClockIn).toHaveBeenCalledWith({ workflowOccurrenceId: 'occurrence-1' }, 'token-1');
    expect(mockRefreshWorkContext).toHaveBeenCalledTimes(1);
    expect(pendingStore.workflow).toBeNull();
  });

  it('auto-finalizes the exact completed workflow restored from storage', async () => {
    mockLoadRecord.mockResolvedValue({ workflow: workflow(true), submissionIds: {}, queuedSubmissions: [] });
    mockLoadBootstrap.mockResolvedValue({
      ok: true,
      capabilities: { requiredBeforeClockInForms: true },
      pendingClockInWorkflow: workflow(true),
    });

    await mount();

    expect(mockFinalizeClockIn).toHaveBeenCalledWith({ workflowOccurrenceId: 'occurrence-1' }, 'token-1');
    expect(mockRefreshWorkContext).toHaveBeenCalledTimes(1);
    expect(pendingStore.workflow).toBeNull();
  });

  it('retains a completed workflow after finalization failure and succeeds on retry', async () => {
    const completedWorkAreaWorkflow = {
      ...workflow(true),
      clockInIntent: {
        ...workflow(true).clockInIntent,
        workAreaId: 'work-area-x',
        workAreaNameSnapshot: 'Work Area X',
        clockingContractVersion: 2,
      },
    };
    mockLoadBootstrap.mockResolvedValue({
      ok: true,
      capabilities: { requiredBeforeClockInForms: true },
      pendingClockInWorkflow: completedWorkAreaWorkflow,
    });
    mockFinalizeClockIn.mockRejectedValueOnce(new TypeError('network failure'));

    await mount();

    expect(pendingStore.workflow?.clockInIntent).toEqual(completedWorkAreaWorkflow.clockInIntent);
    expect(pendingStore.phase).toEqual({ kind: 'ready_to_finalize', total: 1 });
    expect(pendingStore.error).toBe('Clock-in could not be finalized. Your required form progress is still saved.');
    mockFinalizeClockIn.mockResolvedValueOnce({
      ok: true, status: 'clock_in_completed', timeEntry: finalizedTimeEntry(),
    });

    let result: any;
    await act(async () => { result = await pendingStore.finalize(); });

    expect(result).toEqual({ ok: true });
    expect(mockFinalizeClockIn).toHaveBeenCalledTimes(2);
    expect(pendingStore.workflow).toBeNull();
  });

  it('surfaces Work Area revalidation errors without clearing the saved clock-in intent', async () => {
    const completedWorkAreaWorkflow = {
      ...workflow(true),
      clockInIntent: {
        ...workflow(true).clockInIntent,
        workAreaId: 'work-area-x',
        workAreaNameSnapshot: 'Work Area X',
        clockingContractVersion: 2,
      },
    };
    mockLoadBootstrap.mockResolvedValue({
      ok: true,
      capabilities: { requiredBeforeClockInForms: true },
      pendingClockInWorkflow: completedWorkAreaWorkflow,
    });
    mockFinalizeClockIn.mockRejectedValue(new ApiError(
      'The selected Work Area is not available for this Job.', 400, 'job_work_area_invalid',
    ));

    await mount();

    expect(pendingStore.error).toBe('The selected Work Area is not available for this Job.');
    expect(pendingStore.workflow?.clockInIntent).toEqual(completedWorkAreaWorkflow.clockInIntent);
    expect(mockClearRecord).not.toHaveBeenCalled();
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
    const preparedPayload = {
      ...payload,
      responses: [{ fieldId: 'photo-1', value: '', fileIds: ['file-1'] }],
    };
    mockPrepareFormSubmissionAttachments.mockResolvedValue(preparedPayload);
    mockLoadRecord.mockResolvedValue({ workflow: workflow(), submissionIds: {}, queuedSubmissions: [payload] });
    mockLoadPendingClockIn.mockResolvedValue(workflow(true));

    await mount();

    expect(mockPrepareFormSubmissionAttachments).toHaveBeenCalledWith(
      payload, 'business-1:user-1:employee-1', 'token-1',
    );
    expect(mockSaveRecord).toHaveBeenCalledWith(
      'business-1:user-1:employee-1',
      expect.objectContaining({ queuedSubmissions: [preparedPayload] }),
    );
    expect(mockSubmitEmployeeForm).toHaveBeenCalledWith(preparedPayload, 'token-1');
    expect(mockMarkFormAttachmentsSubmitted).toHaveBeenCalledWith(
      'business-1:user-1:employee-1', 'form-submission:queued-1',
    );
    expect(mockSubmitEmployeeForm.mock.invocationCallOrder[0]).toBeLessThan(
      mockMarkFormAttachmentsSubmitted.mock.invocationCallOrder[0],
    );
    expect(mockFinalizeClockIn).toHaveBeenCalledTimes(1);
    expect(mockRefreshWorkContext).toHaveBeenCalledTimes(1);
    expect(pendingStore.workflow).toBeNull();
  });

  it('cleans up attachments when replay confirms the requirement was already completed', async () => {
    const payload = {
      clientSubmissionId: 'form-submission:already-completed', formId: 'form-1', trigger: 'before_clock_in' as const,
      workflowOccurrenceId: 'occurrence-1', workflowRequirementId: 'requirement-1', responses: [],
    };
    mockLoadRecord.mockResolvedValue({ workflow: workflow(), submissionIds: {}, queuedSubmissions: [payload] });
    mockLoadPendingClockIn.mockResolvedValue(workflow(true));
    mockSubmitEmployeeForm.mockRejectedValue(new ApiError(
      'Requirement already completed.', 409, 'workflow_requirement_already_completed',
    ));

    await mount();

    expect(mockMarkFormAttachmentsSubmitted).toHaveBeenCalledWith(
      'business-1:user-1:employee-1', 'form-submission:already-completed',
    );
    expect(mockFinalizeClockIn).toHaveBeenCalledTimes(1);
    expect(pendingStore.workflow).toBeNull();
  });

  it('retains a server-rejected queued clock-in response without finalizing', async () => {
    const payload = {
      clientSubmissionId: 'form-submission:queued-rejected', formId: 'form-1', trigger: 'before_clock_in' as const,
      workflowOccurrenceId: 'occurrence-1', workflowRequirementId: 'requirement-1',
      responses: [{ fieldId: 'fit', value: 'no' }],
    };
    const preparedPayload = {
      ...payload,
      responses: [...payload.responses, { fieldId: 'photo-1', value: '', fileIds: ['file-1'] }],
    };
    mockPrepareFormSubmissionAttachments.mockResolvedValue(preparedPayload);
    mockLoadRecord.mockResolvedValue({ workflow: workflow(), submissionIds: {}, queuedSubmissions: [payload] });
    mockSubmitEmployeeForm.mockRejectedValue(new ApiError(
      'Contact your supervisor.', 400, 'form_response_requirement_failed', 'fit',
    ));

    await mount();

    expect(mockFinalizeClockIn).not.toHaveBeenCalled();
    expect(mockMarkFormAttachmentsSubmitted).not.toHaveBeenCalled();
    expect(pendingStore.queuedSubmissionFor('requirement-1')).toEqual(preparedPayload);
    expect(pendingStore.submissionFailure).toEqual({
      workflowRequirementId: 'requirement-1', code: 'form_response_requirement_failed',
      error: 'Contact your supervisor.', fieldId: 'fit',
    });
    expect(mockSaveRecord).toHaveBeenLastCalledWith(
      'business-1:user-1:employee-1',
      expect.objectContaining({ queuedSubmissions: [preparedPayload] }),
    );
  });

  it('shares one successful clock-in finalization across simultaneous callers', async () => {
    await mount();
    let resolveFinalize!: (result: { ok: true; status: 'clock_in_completed'; timeEntry: ReturnType<typeof finalizedTimeEntry> }) => void;
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
      resolveFinalize({ ok: true, status: 'clock_in_completed', timeEntry: finalizedTimeEntry() });
      await Promise.all([first, second]);
    });
    await expect(first).resolves.toEqual({ ok: true });
    await expect(second).resolves.toEqual({ ok: true });
    expect(mockFinalizeClockIn).toHaveBeenCalledTimes(1);
    expect(pendingStore.error).toBeNull();
  });

  it('shares one pending clock-in recovery across simultaneous callers', async () => {
    await mount();
    let resolveRecovery!: (value: ReturnType<typeof workflow>) => void;
    mockLoadPendingClockIn.mockClear().mockImplementationOnce(() => new Promise((resolve) => {
      resolveRecovery = resolve;
    }));

    const first = pendingStore.recover();
    const second = pendingStore.recover();
    expect(first).toBe(second);
    await act(async () => { await Promise.resolve(); });
    expect(mockLoadPendingClockIn).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRecovery(workflow());
      await Promise.all([first, second]);
    });
    expect(mockLoadPendingClockIn).toHaveBeenCalledTimes(1);
  });

  it('shares form refresh recovery with NetInfo synchronization', async () => {
    await mount();
    let resolveRecovery!: (value: ReturnType<typeof workflow>) => void;
    mockLoadPendingClockIn.mockClear().mockImplementationOnce(() => new Promise((resolve) => {
      resolveRecovery = resolve;
    }));

    const foregroundRefresh = pendingStore.refreshAfterSubmission();
    await act(async () => { await Promise.resolve(); });
    await act(async () => mockNetworkListener?.({ isConnected: true, isInternetReachable: true }));
    expect(mockLoadPendingClockIn).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRecovery(workflow());
      await foregroundRefresh;
    });
    expect(mockLoadPendingClockIn).toHaveBeenCalledTimes(1);
  });

  it('shares form refresh recovery with AppState synchronization', async () => {
    await mount();
    let resolveRecovery!: (value: ReturnType<typeof workflow>) => void;
    mockLoadPendingClockIn.mockClear().mockImplementationOnce(() => new Promise((resolve) => {
      resolveRecovery = resolve;
    }));

    const foregroundRefresh = pendingStore.refreshAfterSubmission();
    await act(async () => { await Promise.resolve(); });
    await act(async () => mockAppStateListener?.('active'));
    expect(mockLoadPendingClockIn).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRecovery(workflow());
      await foregroundRefresh;
    });
    expect(mockLoadPendingClockIn).toHaveBeenCalledTimes(1);
  });

  it('does not restart initialization or recovery during ordinary provider renders', async () => {
    mockLoadBootstrap.mockResolvedValue({ ok: true, capabilities: { requiredBeforeClockInForms: true } });
    await mount();
    expect(mockLoadBootstrap).toHaveBeenCalledTimes(1);
    expect(mockLoadPendingClockIn).toHaveBeenCalledTimes(1);

    mockRefreshWorkContextAction = jest.fn().mockResolvedValue({ ok: true });
    await act(async () => {
      tree?.update(React.createElement(PendingClockInProvider, null, React.createElement(Probe)));
    });

    expect(mockLoadBootstrap).toHaveBeenCalledTimes(1);
    expect(mockLoadPendingClockIn).toHaveBeenCalledTimes(1);
  });

  it('ignores a late pending response after successful finalization', async () => {
    await mount();
    let resolveRecovery!: (value: ReturnType<typeof workflow>) => void;
    mockLoadPendingClockIn.mockClear().mockImplementationOnce(() => new Promise((resolve) => {
      resolveRecovery = resolve;
    }));
    const recovery = pendingStore.recover();
    await act(async () => { await Promise.resolve(); });

    let finalizeResult: unknown;
    await act(async () => { finalizeResult = await pendingStore.finalize(); });
    expect(finalizeResult).toEqual({ ok: true });
    expect(pendingStore.workflow).toBeNull();

    await act(async () => {
      resolveRecovery(workflow(true));
      await recovery;
    });
    expect(mockLoadPendingClockIn).toHaveBeenCalledTimes(1);
    expect(pendingStore.workflow).toBeNull();
  });

  it('shares one finalization between foreground completion and background sync', async () => {
    await mount();
    let resolveRecovery!: (value: ReturnType<typeof workflow>) => void;
    let resolveFinalize!: (value: { ok: true; status: 'clock_in_completed'; timeEntry: ReturnType<typeof finalizedTimeEntry> }) => void;
    mockLoadPendingClockIn.mockClear().mockImplementationOnce(() => new Promise((resolve) => {
      resolveRecovery = resolve;
    }));
    mockFinalizeClockIn.mockClear().mockImplementationOnce(() => new Promise((resolve) => {
      resolveFinalize = resolve;
    }));

    const foregroundRefresh = pendingStore.refreshAfterSubmission();
    const foregroundFinalize = foregroundRefresh.then(() => pendingStore.finalize());
    await act(async () => mockNetworkListener?.({ isConnected: true, isInternetReachable: true }));
    await act(async () => {
      resolveRecovery(workflow(true));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockLoadPendingClockIn).toHaveBeenCalledTimes(1);
    expect(mockFinalizeClockIn).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFinalize({ ok: true, status: 'clock_in_completed', timeEntry: finalizedTimeEntry() });
      await foregroundFinalize;
    });
    expect(mockFinalizeClockIn).toHaveBeenCalledTimes(1);
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

  it('returns to the remaining Form when authoritative recovery reports forms outstanding', async () => {
    mockLoadBootstrap.mockResolvedValue({
      ok: true,
      capabilities: { requiredBeforeClockInForms: true },
      pendingClockInWorkflow: workflow(true),
    });
    mockFinalizeClockIn.mockRejectedValue(new ApiError(
      'Required forms remain.', 409, 'required_forms_outstanding',
    ));
    mockLoadPendingClockIn.mockResolvedValue(workflow());

    await mount();

    expect(pendingStore.phase).toEqual({ kind: 'requirements_outstanding', current: 1, total: 1 });
    expect(pendingStore.currentForm).toBe(requiredForm);
    expect(pendingStore.error).toBeNull();
    expect(mockCaptureMessage).not.toHaveBeenCalledWith('clock_in_finalize_failed', expect.anything());
  });

  it('shows an explicit error when forms-outstanding recovery still reports ready to finalize', async () => {
    mockLoadBootstrap.mockResolvedValue({
      ok: true,
      capabilities: { requiredBeforeClockInForms: true },
      pendingClockInWorkflow: workflow(true),
    });
    mockFinalizeClockIn.mockRejectedValue(new ApiError(
      'Required forms remain.', 409, 'required_forms_outstanding',
    ));
    mockLoadPendingClockIn.mockResolvedValue(workflow(true));

    await mount();

    expect(pendingStore.phase).toEqual({ kind: 'ready_to_finalize', total: 1 });
    expect(pendingStore.busy).toBe(false);
    expect(pendingStore.error).toBe('Clock-in could not be finalized yet. Your required form progress is saved.');
  });

  it('surfaces a pending clock-out conflict and retains the ready workflow', async () => {
    mockLoadBootstrap.mockResolvedValue({
      ok: true,
      capabilities: { requiredBeforeClockInForms: true },
      pendingClockInWorkflow: workflow(true),
    });
    mockFinalizeClockIn.mockRejectedValue(new ApiError(
      'Complete the pending clock-out workflow before clocking in.',
      409,
      'pending_clock_out_requires_finalization',
    ));

    await mount();

    expect(pendingStore.workflow?.workflowOccurrenceId).toBe('occurrence-1');
    expect(pendingStore.error).toBe('Complete the pending clock-out workflow before clocking in.');
  });

  it('reconciles an active shift conflict as successful finalization', async () => {
    mockLoadBootstrap
      .mockResolvedValueOnce({
        ok: true,
        capabilities: { requiredBeforeClockInForms: true },
        pendingClockInWorkflow: workflow(true),
      })
      .mockResolvedValueOnce({
        ok: true,
        capabilities: { requiredBeforeClockInForms: true },
        pendingClockInWorkflow: null,
        currentActiveEntryId: 'entry-1',
      });
    mockFinalizeClockIn.mockRejectedValue(new ApiError(
      'Employee is already clocked in.', 409, 'offline_shift_state_conflict',
    ));

    await mount();

    expect(pendingStore.workflow).toBeNull();
    expect(pendingStore.error).toBeNull();
    expect(mockRefreshWorkContext).toHaveBeenCalledTimes(1);
    expect(mockCaptureMessage).not.toHaveBeenCalledWith('clock_in_finalize_failed', expect.anything());
  });

  it.each([
    ['request timeout', new ApiError('Request timed out.', 408, 'REQUEST_TIMEOUT'), 'Request timed out.', 'request_timeout', 408],
    ['unknown server error', new ApiError('Internal details', 500), 'Clock-in could not be finalized. Your required form progress is still saved.', 'unknown', 500],
  ])('retains a retryable ready state after %s', async (_name, failure, expectedMessage, expectedCode, expectedStatus) => {
    const completed = {
      ...workflow(true),
      clockInIntent: {
        ...workflow(true).clockInIntent,
        workAreaId: 'work-area-x',
        clockingContractVersion: 2,
      },
    };
    mockLoadBootstrap.mockResolvedValue({
      ok: true,
      capabilities: { requiredBeforeClockInForms: true },
      pendingClockInWorkflow: completed,
    });
    mockFinalizeClockIn.mockRejectedValue(failure);

    await mount();

    expect(pendingStore.phase).toEqual({ kind: 'ready_to_finalize', total: 1 });
    expect(pendingStore.busy).toBe(false);
    expect(pendingStore.error).toBe(expectedMessage);
    expect(mockCaptureMessage).toHaveBeenCalledWith('clock_in_finalize_failed', expect.objectContaining({
      level: 'warning',
      contexts: {
        clock_in_finalize: {
          workflowOccurrenceId: 'occurrence-1',
          resultCode: expectedCode,
          httpStatus: expectedStatus,
          pendingPhase: 'ready_to_finalize',
          requiredFormCount: 1,
          completedRequiredFormCount: 1,
          remainingRequiredFormCount: 0,
          clockingContractVersion: 2,
          isJobWork: true,
          jobCount: 1,
          hasWorkAreaId: true,
        },
      },
    }));
  });

  it('makes only one automatic attempt after failure despite lifecycle recovery signals', async () => {
    mockLoadBootstrap.mockResolvedValue({
      ok: true,
      capabilities: { requiredBeforeClockInForms: true },
      pendingClockInWorkflow: workflow(true),
    });
    mockLoadPendingClockIn.mockResolvedValue(workflow(true));
    mockFinalizeClockIn.mockRejectedValue(new ApiError('Request timed out.', 408, 'REQUEST_TIMEOUT'));

    await mount();
    await act(async () => mockNetworkListener?.({ isConnected: true, isInternetReachable: true }));
    await act(async () => mockAppStateListener?.('active'));

    expect(mockFinalizeClockIn).toHaveBeenCalledTimes(1);
    expect(pendingStore.error).toBe('Request timed out.');
  });
});