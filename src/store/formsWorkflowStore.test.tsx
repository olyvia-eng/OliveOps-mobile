import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { FormsWorkflowProvider, useFormsWorkflowStore } from '@/store/formsWorkflowStore';
import type { EmployeeForm } from '@/types/forms';

let mockAuthState: {
  status: 'authenticated' | 'unauthenticated';
  user: { id: string; businessId: string; employeeId: string } | null;
};

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

let currentStore: ReturnType<typeof useFormsWorkflowStore>;

function WorkflowProbe() {
  currentStore = useFormsWorkflowStore();
  return React.createElement('workflow-probe', {
    workflowId: currentStore.workflow?.id,
    completedCount: currentStore.workflow?.completedCount ?? 0,
    formCount: currentStore.workflow?.forms.length ?? 0,
  });
}

function createForm(name: string): EmployeeForm {
  return {
    id: 'same-form-id',
    name,
    trigger: 'before_clock_in',
    required: false,
    context: {},
    fields: [],
    submissionState: { completed: false },
  };
}

describe('FormsWorkflowProvider', () => {
  beforeEach(() => {
    mockAuthState = {
      status: 'authenticated',
      user: { id: 'user-1', businessId: 'business-1', employeeId: 'employee-1' },
    };
  });

  it('keeps duplicate returned Forms as ordered steps and advances one at a time', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(React.createElement(FormsWorkflowProvider, null, React.createElement(WorkflowProbe)));
    });

    let workflowId = '';
    await act(async () => {
      workflowId = currentStore.startWorkflow({
        originRoute: '/clock-in',
        destination: '/active-shift',
        phase: 'pre_action',
        intent: { kind: 'clock_in', employeeId: 'employee-1', workType: 'job', jobIds: ['job-1'] },
        forms: [createForm('First Check'), createForm('Second Check')],
      });
    });

    expect(currentStore.workflow?.forms.map((form) => form.name)).toEqual(['First Check', 'Second Check']);
    expect(tree.root.findByType('workflow-probe').props.formCount).toBe(2);

    await act(async () => currentStore.completeCurrentForm(workflowId));
    expect(currentStore.workflow?.completedCount).toBe(1);
    await act(async () => currentStore.completeCurrentForm(workflowId));
    expect(currentStore.workflow?.completedCount).toBe(2);
    await act(async () => currentStore.completeCurrentForm(workflowId));
    expect(currentStore.workflow?.completedCount).toBe(2);
  });

  it('clears pending intent when authenticated identity changes', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(React.createElement(FormsWorkflowProvider, null, React.createElement(WorkflowProbe)));
    });

    await act(async () => {
      currentStore.startWorkflow({
        originRoute: '/clock-in',
        destination: '/active-shift',
        phase: 'pre_action',
        intent: { kind: 'clock_in', employeeId: 'employee-1', workType: 'job', jobIds: ['job-1'] },
        forms: [createForm('Employee A Check')],
      });
    });
    expect(currentStore.workflow).not.toBeNull();

    mockAuthState = {
      status: 'authenticated',
      user: { id: 'user-2', businessId: 'business-1', employeeId: 'employee-2' },
    };
    await act(async () => {
      tree.update(React.createElement(FormsWorkflowProvider, null, React.createElement(WorkflowProbe)));
    });

    expect(currentStore.workflow).toBeNull();
    expect(tree.root.findByType('workflow-probe').props.formCount).toBe(0);
  });
});