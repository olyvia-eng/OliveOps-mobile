import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockLoadEmployeeForms = jest.fn();
const mockLoadEmployeeSubmission = jest.fn();
const mockLoadRequiredForms = jest.fn();
const mockSubmitEmployeeForm = jest.fn();

let mockAuthState = {
  accessToken: 'token-1',
  status: 'authenticated' as const,
  user: {
    id: 'user-1',
    businessId: 'biz-1',
    employeeId: 'emp-1',
  },
};

jest.mock('@/api/formsApi', () => ({
  loadEmployeeForms: (...args: unknown[]) => mockLoadEmployeeForms(...args),
  loadEmployeeSubmission: (...args: unknown[]) => mockLoadEmployeeSubmission(...args),
  loadRequiredForms: (...args: unknown[]) => mockLoadRequiredForms(...args),
  submitEmployeeForm: (...args: unknown[]) => mockSubmitEmployeeForm(...args),
}));

jest.mock('@/services/connectivity', () => ({
  isOnline: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));

import { useFormsActions } from '@/hooks/useFormsActions';
import { FormsProvider, useFormsStore } from '@/store/formsStore';
import { ApiError } from '@/types/errors';

let currentActions: ReturnType<typeof useFormsActions>;
let currentStore: ReturnType<typeof useFormsStore>;

function workspace(formId = 'form-1') {
  return {
    ok: true as const,
    timezone: 'America/Toronto',
    generatedAt: '2026-08-18T12:00:00.000Z',
    toDo: [{
      id: formId,
      name: 'Daily Report',
      trigger: 'daily' as const,
      required: true,
      fields: [],
      submissionState: { completed: false },
    }],
    available: [],
    completed: [],
  };
}

function Probe() {
  currentActions = useFormsActions();
  currentStore = useFormsStore();
  return React.createElement('forms-probe', { toDoCount: currentStore.toDo.length });
}

describe('useFormsActions', () => {
  let tree: ReactTestRenderer | undefined;

  beforeEach(() => {
    mockAuthState = {
      accessToken: 'token-1',
      status: 'authenticated',
      user: { id: 'user-1', businessId: 'biz-1', employeeId: 'emp-1' },
    };
    mockLoadEmployeeForms.mockReset().mockResolvedValue(workspace());
    mockLoadEmployeeSubmission.mockReset();
    mockLoadRequiredForms.mockReset();
    mockSubmitEmployeeForm.mockReset().mockResolvedValue({
      ok: true,
      submission: { id: 'sub-1', formId: 'form-1', trigger: 'daily', submittedAt: '2026-08-18T12:01:00.000Z', status: 'submitted' },
    });
  });

  afterEach(async () => {
    if (!tree) return;
    await act(async () => tree?.unmount());
    tree = undefined;
  });

  async function mount() {
    await act(async () => {
      tree = create(React.createElement(FormsProvider, null, React.createElement(Probe)));
    });
  }

  it('does not fetch Forms when the provider mounts', async () => {
    await mount();
    expect(mockLoadEmployeeForms).not.toHaveBeenCalled();
  });

  it('loads workspace on demand and keeps action callbacks stable after state commits', async () => {
    await mount();
    const refreshIdentity = currentActions.refreshForms;

    await act(async () => {
      await currentActions.refreshForms({ force: true });
    });

    expect(mockLoadEmployeeForms).toHaveBeenCalledTimes(1);
    expect(currentStore.toDo).toHaveLength(1);
    expect(currentActions.refreshForms).toBe(refreshIdentity);
  });

  it('blocks duplicate submit taps and refreshes all lists after success', async () => {
    let resolveSubmit!: (value: unknown) => void;
    mockSubmitEmployeeForm.mockReturnValue(new Promise((resolve) => { resolveSubmit = resolve; }));
    await mount();

    const payload = { formId: 'form-1', trigger: 'daily' as const, responses: [] };
    let first!: Promise<unknown>;
    let second: unknown;
    await act(async () => {
      first = currentActions.submitForm(payload);
      second = await currentActions.submitForm(payload);
    });

    expect(second).toMatchObject({ ok: false, error: 'This form is already being submitted.' });
    expect(mockSubmitEmployeeForm).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSubmit({ ok: true, submission: { id: 'sub-1', formId: 'form-1', trigger: 'daily', submittedAt: '2026-08-18T12:01:00.000Z', status: 'submitted' } });
      await first;
    });

    expect(mockLoadEmployeeForms).toHaveBeenCalledTimes(1);
    expect(currentStore.flashMessage).toBe('Form submitted successfully.');
  });

  it('clears employee-scoped Forms state when authenticated identity changes', async () => {
    await mount();
    await act(async () => {
      await currentActions.refreshForms({ force: true });
    });
    expect(currentStore.toDo).toHaveLength(1);

    mockAuthState = {
      accessToken: 'token-2',
      status: 'authenticated',
      user: { id: 'user-2', businessId: 'biz-1', employeeId: 'emp-2' },
    };
    await act(async () => {
      tree?.update(React.createElement(FormsProvider, null, React.createElement(Probe)));
    });

    expect(currentStore.toDo).toHaveLength(0);
    expect(mockLoadEmployeeForms).toHaveBeenCalledTimes(1);
  });

  it('reconciles an already-completed recurring form before reporting failure', async () => {
    mockSubmitEmployeeForm.mockRejectedValue(new ApiError('Already submitted', 409));
    mockLoadEmployeeForms.mockResolvedValue({
      ...workspace(),
      toDo: [],
      completed: [{
        submissionId: 'sub-1', formId: 'form-1', formName: 'Daily Report',
        submittedAt: '2026-08-18T12:01:00.000Z', status: 'submitted', trigger: 'daily',
      }],
    });
    await mount();

    let result: any;
    await act(async () => {
      result = await currentActions.submitForm({ formId: 'form-1', trigger: 'daily', responses: [] });
    });

    expect(result).toMatchObject({ ok: true, reconciled: true });
    expect(currentStore.toDo).toHaveLength(0);
  });

  it('reconciles Completed after an uncertain on-demand network failure', async () => {
    mockSubmitEmployeeForm.mockRejectedValue(new TypeError('Network request failed'));
    mockLoadEmployeeForms.mockResolvedValue({
      ...workspace(),
      toDo: [],
      completed: [{
        submissionId: 'sub-demand', formId: 'form-1', formName: 'Incident Report',
        submittedAt: new Date().toISOString(), status: 'submitted', trigger: 'on_demand',
      }],
    });
    await mount();

    let result: any;
    await act(async () => {
      result = await currentActions.submitForm({ formId: 'form-1', trigger: 'on_demand', responses: [] });
    });

    expect(result).toMatchObject({ ok: true, reconciled: true });
    expect(mockSubmitEmployeeForm).toHaveBeenCalledTimes(1);
  });

  it('maps unauthorized Forms access to a safe employee message', async () => {
    mockSubmitEmployeeForm.mockRejectedValue(new ApiError('Internal assignment detail', 403));
    await mount();

    let result: any;
    await act(async () => {
      result = await currentActions.submitForm({ formId: 'form-1', trigger: 'daily', responses: [] });
    });

    expect(result).toEqual({ ok: false, error: 'This form is not available to your employee account.', uncertain: false });
  });
});