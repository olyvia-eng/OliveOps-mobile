import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import type { TimeEntryWorkType } from '@/types/domain';
import type { EmployeeForm } from '@/types/forms';

export type FormsWorkflowIntent =
  | {
    kind: 'clock_in';
    employeeId: string;
    workType: TimeEntryWorkType;
    jobIds: string[];
    workAreaId?: string;
    unbillableCategoryId?: string;
    requestedClockInAt?: string;
  }
  | {
    kind: 'switch_activity';
    employeeId: string;
    activeEntryId: string;
    workType: TimeEntryWorkType;
    jobIds: string[];
    workAreaId?: string;
    unbillableCategoryId?: string;
  }
  | {
    kind: 'clock_out_follow_up';
    recordedDurationLabel: string;
  }
  | {
    kind: 'switch_activity_follow_up';
  };

export type FormsWorkflow = {
  id: string;
  originRoute: '/clock-in' | '/clock-out' | '/switch-activity';
  destination: '/active-shift' | '/home';
  phase: 'pre_action' | 'post_action';
  intent: FormsWorkflowIntent;
  forms: EmployeeForm[];
  completedCount: number;
};

type StartFormsWorkflow = Omit<FormsWorkflow, 'id' | 'completedCount'>;

type FormsWorkflowState = {
  workflow: FormsWorkflow | null;
  startWorkflow: (workflow: StartFormsWorkflow) => string;
  completeCurrentForm: (workflowId: string) => void;
  clearWorkflow: () => void;
};

const FormsWorkflowContext = createContext<FormsWorkflowState | undefined>(undefined);

function createWorkflowId() {
  return `forms-workflow:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
}

export function FormsWorkflowProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuthStore();
  const [workflow, setWorkflow] = useState<FormsWorkflow | null>(null);
  const previousIdentityRef = useRef<string | null>(null);

  const clearWorkflow = useCallback(() => setWorkflow(null), []);

  const startWorkflow = useCallback((nextWorkflow: StartFormsWorkflow) => {
    const id = createWorkflowId();
    setWorkflow({ ...nextWorkflow, id, completedCount: 0 });
    return id;
  }, []);

  const completeCurrentForm = useCallback((workflowId: string) => {
    setWorkflow((current) => {
      if (!current || current.id !== workflowId) return current;
      return {
        ...current,
        completedCount: Math.min(current.completedCount + 1, current.forms.length),
      };
    });
  }, []);

  useEffect(() => {
    const nextIdentity = status === 'authenticated' && user
      ? `${user.businessId}:${user.id}:${user.employeeId ?? ''}`
      : null;

    if (previousIdentityRef.current !== nextIdentity) {
      clearWorkflow();
      previousIdentityRef.current = nextIdentity;
    }
  }, [clearWorkflow, status, user]);

  const value = useMemo<FormsWorkflowState>(() => ({
    workflow,
    startWorkflow,
    completeCurrentForm,
    clearWorkflow,
  }), [clearWorkflow, completeCurrentForm, startWorkflow, workflow]);

  return <FormsWorkflowContext.Provider value={value}>{children}</FormsWorkflowContext.Provider>;
}

export function useFormsWorkflowStore() {
  const context = useContext(FormsWorkflowContext);
  if (!context) throw new Error('useFormsWorkflowStore must be used inside FormsWorkflowProvider');
  return context;
}