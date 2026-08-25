import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { PendingClockInRecord } from '@/services/pendingClockInStorage';

const mockLoadBootstrap = jest.fn();
const mockLoadPendingClockIn = jest.fn();
const mockFinalizeClockIn = jest.fn();
const mockLoadRequiredForms = jest.fn();
const mockSubmitEmployeeForm = jest.fn();
const mockLoadRecord = jest.fn();
const mockSaveRecord = jest.fn();
const mockClearRecord = jest.fn();
const mockRefreshWorkContext = jest.fn();
let mockOnline = true;
let pendingStore: any;

const requiredForm = {
  id: 'form-1', name: 'Morning Truck Inspection', trigger: 'before_clock_in' as const, required: true,
  completionRequirement: 'required' as const, context: { jobId: 'job-1' }, fields: [],
  submissionState: { completed: false },
};

function workflow() {
  const requirement = { requirementId: 'requirement-1', formId: 'form-1', form: requiredForm };
  return {
    ok: true,
    status: 'clock_in_pending_required_forms' as const,
    blocked: true as const,
    workflowOccurrenceId: 'occurrence-1',
    requiredFormCount: 1,
    completedRequiredFormCount: 0,
    remainingRequiredFormCount: 1,
    requiredForms: [requirement],
    remainingForms: [requirement],
    reminderForms: [],
    clockInIntent: { employeeId: 'employee-1', workType: 'job' as const, jobIds: ['job-1'] },
  };
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
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn(() => jest.fn()) },
}));
jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
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
    expect(mockSaveRecord).toHaveBeenCalledWith(
      'business-1:user-1:employee-1',
      expect.objectContaining({ workflow: expect.objectContaining({ workflowOccurrenceId: 'occurrence-1' }) }),
    );
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
    expect(mockRefreshWorkContext).toHaveBeenCalledTimes(1);
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