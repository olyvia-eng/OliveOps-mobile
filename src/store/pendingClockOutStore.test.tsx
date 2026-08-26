import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { PendingClockOutRecord } from '@/services/pendingClockOutStorage';

const mockLoadBootstrap = jest.fn();
const mockLoadPendingClockOut = jest.fn();
const mockFinalizeClockOut = jest.fn();
const mockSubmitEmployeeForm = jest.fn();
const mockLoadRecord = jest.fn();
const mockSaveRecord = jest.fn();
const mockClearRecord = jest.fn();
const mockRefreshWorkContext = jest.fn();
let mockOnline = true;
let pendingStore: any;
let mockNetworkListener: ((state: { isConnected: boolean; isInternetReachable: boolean }) => void) | null = null;
let mockAppStateListener: ((state: string) => void) | null = null;

const requiredForm = {
  id: 'form-1', name: 'End of Shift', trigger: 'after_clock_out' as const, required: true,
  completionRequirement: 'required' as const, context: { jobId: 'job-1' }, fields: [],
  submissionState: { completed: false },
};

function workflow(completed = false) {
  return {
    ok: true,
    status: 'clock_out_pending_required_forms' as const,
    blocked: true as const,
    workflowOccurrenceId: 'occurrence-1',
    intendedClockOutAt: '2026-08-25T20:30:00.000Z',
    requiredCount: 1,
    completedCount: completed ? 1 : 0,
    requirements: [{ workflowRequirementId: 'requirement-1', completed, form: requiredForm }],
    reminderForms: [],
  };
}

jest.mock('@/api/clockingApi', () => ({
  loadBootstrap: (...args: unknown[]) => mockLoadBootstrap(...args),
  loadPendingClockOut: (...args: unknown[]) => mockLoadPendingClockOut(...args),
  finalizeClockOut: (...args: unknown[]) => mockFinalizeClockOut(...args),
}));
jest.mock('@/api/formsApi', () => ({
  submitEmployeeForm: (...args: unknown[]) => mockSubmitEmployeeForm(...args),
}));
jest.mock('@/services/connectivity', () => ({
  isOnline: jest.fn(async () => mockOnline),
}));
jest.mock('@/services/pendingClockOutStorage', () => ({
  loadPendingClockOutRecord: (...args: unknown[]) => mockLoadRecord(...args),
  savePendingClockOutRecord: (...args: unknown[]) => mockSaveRecord(...args),
  clearPendingClockOutRecord: (...args: unknown[]) => mockClearRecord(...args),
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

import { PendingClockOutProvider, usePendingClockOutStore } from './pendingClockOutStore';

function Probe() {
  pendingStore = usePendingClockOutStore();
  return React.createElement('pending-probe', {
    occurrenceId: pendingStore.workflow?.workflowOccurrenceId,
    requirementId: pendingStore.currentRequirement?.workflowRequirementId,
    completedCount: pendingStore.completedCount,
  });
}

describe('PendingClockOutProvider', () => {
  let tree: ReactTestRenderer | undefined;

  beforeEach(() => {
    mockOnline = true;
    mockNetworkListener = null;
    mockAppStateListener = null;
    mockLoadRecord.mockReset().mockResolvedValue(null);
    mockSaveRecord.mockReset().mockResolvedValue(undefined);
    mockClearRecord.mockReset().mockResolvedValue(undefined);
    mockRefreshWorkContext.mockReset().mockResolvedValue({ ok: true });
    mockLoadBootstrap.mockReset().mockResolvedValue({
      ok: true,
      capabilities: { requiredAfterClockOutForms: true },
      pendingClockOutWorkflow: workflow(),
    });
    mockLoadPendingClockOut.mockReset().mockResolvedValue(workflow());
    mockFinalizeClockOut.mockReset().mockResolvedValue({ ok: true, status: 'clock_out_completed' });
    mockSubmitEmployeeForm.mockReset().mockResolvedValue({ ok: true, submission: { id: 'submission-1' } });
  });

  afterEach(async () => {
    if (tree) await act(async () => tree?.unmount());
    tree = undefined;
  });

  async function mount() {
    await act(async () => {
      tree = create(React.createElement(PendingClockOutProvider, null, React.createElement(Probe)));
    });
  }

  it('restores a pending workflow from bootstrap and persists it for restart recovery', async () => {
    await mount();

    expect(pendingStore.workflow?.workflowOccurrenceId).toBe('occurrence-1');
    expect(pendingStore.currentRequirement?.workflowRequirementId).toBe('requirement-1');
    expect(mockSaveRecord).toHaveBeenCalledWith(
      'business-1:user-1:employee-1',
      expect.objectContaining({ workflow: expect.objectContaining({ workflowOccurrenceId: 'occurrence-1' }) }),
    );
  });

  it('restores the cached workflow while offline without clearing it', async () => {
    mockOnline = false;
    const stored: PendingClockOutRecord = { workflow: workflow(), submissionIds: {}, queuedSubmissions: [] };
    mockLoadRecord.mockResolvedValue(stored);
    await mount();

    expect(pendingStore.workflow?.workflowOccurrenceId).toBe('occurrence-1');
    expect(mockLoadBootstrap).not.toHaveBeenCalled();
    expect(mockClearRecord).not.toHaveBeenCalled();
  });

  it('persists one stable client submission ID per workflow requirement', async () => {
    await mount();

    let first = '';
    let second = '';
    await act(async () => {
      first = await pendingStore.submissionIdFor('requirement-1');
      second = await pendingStore.submissionIdFor('requirement-1');
    });

    expect(first).toBe('form-submission:stable-1');
    expect(second).toBe(first);
    expect(mockSaveRecord).toHaveBeenLastCalledWith(
      'business-1:user-1:employee-1',
      expect.objectContaining({ submissionIds: { 'requirement-1': first } }),
    );
  });

  it('queues a cached form submission offline with both workflow IDs', async () => {
    await mount();
    mockOnline = false;
    const payload = {
      clientSubmissionId: 'form-submission:stable-1', formId: 'form-1', trigger: 'after_clock_out' as const,
      workflowOccurrenceId: 'occurrence-1', workflowRequirementId: 'requirement-1', responses: [],
    };

    await act(async () => pendingStore.queueSubmission(payload));

    expect(mockSaveRecord).toHaveBeenLastCalledWith(
      'business-1:user-1:employee-1',
      expect.objectContaining({
        queuedSubmissions: [expect.objectContaining({
          workflowOccurrenceId: 'occurrence-1', workflowRequirementId: 'requirement-1', payload,
        })],
      }),
    );
  });

  it('finalizes idempotently and clears persisted pending state only after server success', async () => {
    await mount();

    let result: unknown;
    await act(async () => { result = await pendingStore.finalize(); });

    expect(mockFinalizeClockOut).toHaveBeenCalledWith({ workflowOccurrenceId: 'occurrence-1' }, 'token-1');
    expect(result).toEqual({ ok: true });
    expect(mockClearRecord).toHaveBeenCalledWith('business-1:user-1:employee-1');
    expect(pendingStore.workflow).toBeNull();
    expect(mockRefreshWorkContext).not.toHaveBeenCalled();
  });

  it('does not auto-finalize a completed bootstrap workflow without queued submissions', async () => {
    mockLoadBootstrap.mockResolvedValue({
      ok: true,
      capabilities: { requiredAfterClockOutForms: true },
      pendingClockOutWorkflow: workflow(true),
    });
    mockLoadPendingClockOut.mockResolvedValue(workflow(true));

    await mount();

    expect(mockFinalizeClockOut).not.toHaveBeenCalled();
    expect(mockRefreshWorkContext).not.toHaveBeenCalled();
  });

  it('does not auto-finalize from lifecycle events without queued submissions', async () => {
    await mount();
    mockFinalizeClockOut.mockClear();

    await act(async () => mockNetworkListener?.({ isConnected: true, isInternetReachable: true }));
    await act(async () => mockAppStateListener?.('active'));

    expect(mockFinalizeClockOut).not.toHaveBeenCalled();
  });

  it('auto-finalizes after replaying a genuinely queued clock-out form submission', async () => {
    const payload = {
      clientSubmissionId: 'form-submission:queued-1', formId: 'form-1', trigger: 'after_clock_out' as const,
      workflowOccurrenceId: 'occurrence-1', workflowRequirementId: 'requirement-1', responses: [],
    };
    mockLoadRecord.mockResolvedValue({
      workflow: workflow(), submissionIds: {},
      queuedSubmissions: [{
        workflowOccurrenceId: 'occurrence-1', workflowRequirementId: 'requirement-1', payload,
        queuedAt: '2026-08-25T20:31:00.000Z',
      }],
    });
    mockLoadPendingClockOut.mockResolvedValue(workflow(true));

    await mount();

    expect(mockSubmitEmployeeForm).toHaveBeenCalledWith(payload, 'token-1');
    expect(mockFinalizeClockOut).toHaveBeenCalledTimes(1);
    expect(mockRefreshWorkContext).toHaveBeenCalledTimes(1);
    expect(pendingStore.workflow).toBeNull();
  });

  it('shares one successful clock-out finalization across simultaneous callers', async () => {
    await mount();
    let resolveFinalize!: (result: { ok: true; status: 'clock_out_completed' }) => void;
    mockFinalizeClockOut.mockClear().mockImplementationOnce(() => new Promise((resolve) => { resolveFinalize = resolve; }));

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    await act(async () => {
      first = pendingStore.finalize();
      second = pendingStore.finalize();
      await Promise.resolve();
    });

    expect(first).toBe(second);
    expect(mockFinalizeClockOut).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveFinalize({ ok: true, status: 'clock_out_completed' });
      await Promise.all([first, second]);
    });
    await expect(first).resolves.toEqual({ ok: true });
    await expect(second).resolves.toEqual({ ok: true });
    expect(mockFinalizeClockOut).toHaveBeenCalledTimes(1);
    expect(pendingStore.error).toBeNull();
  });
});