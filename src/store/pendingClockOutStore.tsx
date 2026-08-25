import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as clockingApi from '@/api/clockingApi';
import { submitEmployeeForm } from '@/api/formsApi';
import { isOnline } from '@/services/connectivity';
import {
  clearPendingClockOutRecord,
  loadPendingClockOutRecord,
  savePendingClockOutRecord,
  type PendingClockOutRecord,
} from '@/services/pendingClockOutStorage';
import { createFormClientSubmissionId } from '@/services/requestGuards';
import { useAuthStore } from '@/store/authStore';
import type { PendingClockOutRequirement, PendingClockOutWorkflow } from '@/types/api';
import { ApiError } from '@/types/errors';
import type { EmployeeForm, SubmitEmployeeFormRequest } from '@/types/forms';

type FinalizeResult = { ok: true } | { ok: false; error: string };

type PendingClockOutState = {
  hydrated: boolean;
  workflow: PendingClockOutWorkflow | null;
  currentRequirement: PendingClockOutRequirement | null;
  currentForm: EmployeeForm | null;
  completedCount: number;
  totalCount: number;
  busy: boolean;
  error: string | null;
  acceptWorkflow: (workflow: PendingClockOutWorkflow) => Promise<void>;
  recover: () => Promise<PendingClockOutWorkflow | null>;
  submissionIdFor: (workflowRequirementId: string) => Promise<string>;
  queueSubmission: (payload: SubmitEmployeeFormRequest) => Promise<void>;
  refreshAfterSubmission: () => Promise<PendingClockOutWorkflow | null>;
  finalize: () => Promise<FinalizeResult>;
};

const PendingClockOutContext = createContext<PendingClockOutState | undefined>(undefined);

function identityFor(user: ReturnType<typeof useAuthStore>['user']) {
  return user?.employeeId ? `${user.businessId}:${user.id}:${user.employeeId}` : null;
}

export function workflowRequirements(workflow: PendingClockOutWorkflow | null): PendingClockOutRequirement[] {
  if (!workflow) return [];
  const explicit = workflow.requirements ?? workflow.requiredForms ?? workflow.requiredFormPackages;
  if (explicit?.length) return explicit;
  return (workflow.formPackages ?? []).flatMap((form) => {
    const workflowRequirementId = (form as EmployeeForm & { workflowRequirementId?: string }).workflowRequirementId;
    return workflowRequirementId ? [{
      workflowRequirementId,
      completed: form.submissionState.completed,
      form,
    }] : [];
  });
}

export function requirementForm(requirement: PendingClockOutRequirement | null): EmployeeForm | null {
  if (!requirement) return null;
  if (requirement.form) return {
    ...requirement.form,
    context: requirement.context ?? requirement.form.context,
  };
  if (requirement.formPackage) return {
    ...requirement.formPackage,
    context: requirement.context ?? requirement.formPackage.context,
  };
  if (!requirement.fields || !(requirement.formId || requirement.id)) return null;
  return {
    id: (requirement.formId ?? requirement.id) as string,
    name: requirement.name ?? 'Required form',
    description: requirement.description,
    category: requirement.category,
    trigger: 'after_clock_out',
    required: true,
    completionRequirement: 'required',
    context: requirement.context,
    fields: requirement.fields,
    submissionState: requirement.submissionState ?? { completed: Boolean(requirement.completed) },
  };
}

function errorCode(error: unknown) {
  return error instanceof ApiError ? error.code?.toLowerCase() : undefined;
}

export function PendingClockOutProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, status, user } = useAuthStore();
  const identityKey = identityFor(user);
  const identityRef = useRef(identityKey);
  identityRef.current = identityKey;
  const recordRef = useRef<PendingClockOutRecord | null>(null);
  const syncPromiseRef = useRef<Promise<void> | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [workflow, setWorkflow] = useState<PendingClockOutWorkflow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commit = useCallback(async (next: PendingClockOutRecord | null) => {
    if (!identityKey) return;
    recordRef.current = next;
    setWorkflow(next?.workflow ?? null);
    if (next) await savePendingClockOutRecord(identityKey, next);
    else await clearPendingClockOutRecord(identityKey);
  }, [identityKey]);

  const acceptWorkflow = useCallback(async (nextWorkflow: PendingClockOutWorkflow) => {
    const current = recordRef.current;
    await commit({
      workflow: nextWorkflow,
      submissionIds: current?.workflow.workflowOccurrenceId === nextWorkflow.workflowOccurrenceId
        ? current.submissionIds
        : {},
      queuedSubmissions: current?.workflow.workflowOccurrenceId === nextWorkflow.workflowOccurrenceId
        ? current.queuedSubmissions
        : [],
    });
    setError(null);
  }, [commit]);

  const recover = useCallback(async () => {
    if (!identityKey || status !== 'authenticated') return null;
    if (!await isOnline()) return recordRef.current?.workflow ?? null;
    try {
      const response = await clockingApi.loadPendingClockOut(accessToken);
      if (identityRef.current !== identityKey) return null;
      if (response.status === 'no_pending_clock_out') {
        await commit(null);
        return null;
      }
      await acceptWorkflow(response);
      return response;
    } catch (recoverError) {
      setError('Could not refresh the required clock-out form. Your progress is still saved.');
      return recordRef.current?.workflow ?? null;
    }
  }, [acceptWorkflow, accessToken, commit, identityKey, status]);

  const finalize = useCallback(async (): Promise<FinalizeResult> => {
    const current = recordRef.current?.workflow;
    if (!current) return { ok: false, error: 'No pending clock-out was found.' };
    if (!await isOnline()) return { ok: false, error: 'Reconnect to finish clocking out.' };
    setBusy(true);
    setError(null);
    try {
      const response = await clockingApi.finalizeClockOut({
        workflowOccurrenceId: current.workflowOccurrenceId,
      }, accessToken);
      if (response.status === 'clock_out_pending_required_forms') {
        await acceptWorkflow(response);
        return { ok: false, error: 'Complete the remaining required form.' };
      }
      await commit(null);
      return { ok: true };
    } catch (finalizeError) {
      const code = errorCode(finalizeError);
      if (code === 'required_forms_outstanding') {
        await recover();
        return { ok: false, error: 'Complete the remaining required form.' };
      }
      if (code === 'clock_out_workflow_already_finalized') {
        await commit(null);
        return { ok: true };
      }
      if (code === 'clock_out_workflow_not_found' || code === 'clock_out_workflow_forbidden') {
        await recover();
      }
      const message = code === 'employee_form_context_unavailable'
        ? 'This form context is no longer available. Reconnect and contact your supervisor if this continues.'
        : 'Clock-out could not be finalized. Your required form progress is still saved.';
      setError(message);
      return { ok: false, error: message };
    } finally {
      setBusy(false);
    }
  }, [acceptWorkflow, accessToken, commit, recover]);

  const syncQueued = useCallback(async () => {
    if (syncPromiseRef.current || !identityKey || !accessToken || !await isOnline()) return syncPromiseRef.current;
    const run = async () => {
      while (recordRef.current?.queuedSubmissions.length) {
        const queued = recordRef.current.queuedSubmissions[0];
        try {
          await submitEmployeeForm(queued.payload, accessToken);
        } catch (submitError) {
          const code = errorCode(submitError);
          if (code !== 'workflow_requirement_already_completed') return;
        }
        const current = recordRef.current;
        if (!current) return;
        await commit({ ...current, queuedSubmissions: current.queuedSubmissions.slice(1) });
      }
      const refreshed = await recover();
      if (refreshed && workflowRequirements(refreshed).every((item) => item.completed)) {
        await finalize();
      }
    };
    syncPromiseRef.current = run().finally(() => { syncPromiseRef.current = null; });
    return syncPromiseRef.current;
  }, [accessToken, commit, finalize, identityKey, recover]);

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    setWorkflow(null);
    recordRef.current = null;
    if (!identityKey || status !== 'authenticated') {
      setHydrated(true);
      return () => { cancelled = true; };
    }
    void loadPendingClockOutRecord(identityKey).then(async (stored) => {
      if (cancelled || identityRef.current !== identityKey) return;
      recordRef.current = stored;
      setWorkflow(stored?.workflow ?? null);
      setHydrated(true);
      if (!await isOnline()) return;
      try {
        const bootstrap = await clockingApi.loadBootstrap(accessToken);
        if (cancelled || identityRef.current !== identityKey) return;
        if (bootstrap.pendingClockOutWorkflow) await acceptWorkflow(bootstrap.pendingClockOutWorkflow);
        else if (bootstrap.capabilities?.requiredAfterClockOutForms || stored) await recover();
        await syncQueued();
      } catch {
        // The stored workflow remains the safe fallback until connectivity recovers.
      }
    }).catch(() => setHydrated(true));
    return () => { cancelled = true; };
  }, [acceptWorkflow, accessToken, identityKey, recover, status, syncQueued]);

  useEffect(() => {
    if (!hydrated || status !== 'authenticated') return;
    const networkSubscription = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) void syncQueued();
    });
    const appSubscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void syncQueued();
    });
    return () => {
      networkSubscription();
      appSubscription.remove();
    };
  }, [hydrated, status, syncQueued]);

  const submissionIdFor = useCallback(async (workflowRequirementId: string) => {
    const current = recordRef.current;
    if (!current) return createFormClientSubmissionId();
    const existing = current.submissionIds[workflowRequirementId];
    if (existing) return existing;
    const value = createFormClientSubmissionId();
    await commit({
      ...current,
      submissionIds: { ...current.submissionIds, [workflowRequirementId]: value },
    });
    return value;
  }, [commit]);

  const queueSubmission = useCallback(async (payload: SubmitEmployeeFormRequest) => {
    const current = recordRef.current;
    if (!current || !payload.workflowOccurrenceId || !payload.workflowRequirementId) {
      throw new Error('Required clock-out workflow metadata is missing.');
    }
    if (current.workflow.workflowOccurrenceId !== payload.workflowOccurrenceId) {
      throw new Error('This required form belongs to a different clock-out.');
    }
    if (current.queuedSubmissions.some((item) => item.payload.clientSubmissionId === payload.clientSubmissionId)) return;
    await commit({
      ...current,
      queuedSubmissions: [...current.queuedSubmissions, {
        workflowOccurrenceId: payload.workflowOccurrenceId,
        workflowRequirementId: payload.workflowRequirementId,
        payload,
        queuedAt: new Date().toISOString(),
      }],
    });
  }, [commit]);

  const refreshAfterSubmission = useCallback(async () => recover(), [recover]);
  const requirements = workflowRequirements(workflow);
  const outstanding = requirements.filter((item) => !item.completed);
  const currentRequirement = outstanding[0] ?? null;
  const completedCount = workflow?.completedFormCount
    ?? workflow?.completedCount
    ?? requirements.length - outstanding.length;
  const totalCount = workflow?.requiredFormCount ?? workflow?.requiredCount ?? requirements.length;

  const value = useMemo<PendingClockOutState>(() => ({
    hydrated,
    workflow,
    currentRequirement,
    currentForm: requirementForm(currentRequirement),
    completedCount,
    totalCount,
    busy,
    error,
    acceptWorkflow,
    recover,
    submissionIdFor,
    queueSubmission,
    refreshAfterSubmission,
    finalize,
  }), [acceptWorkflow, busy, completedCount, currentRequirement, error, finalize, hydrated, queueSubmission, recover, refreshAfterSubmission, submissionIdFor, totalCount, workflow]);

  return <PendingClockOutContext.Provider value={value}>{children}</PendingClockOutContext.Provider>;
}

export function usePendingClockOutStore() {
  const context = useContext(PendingClockOutContext);
  if (!context) throw new Error('usePendingClockOutStore must be used inside PendingClockOutProvider');
  return context;
}