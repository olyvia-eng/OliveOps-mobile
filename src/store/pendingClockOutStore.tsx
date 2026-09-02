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
import { markFormAttachmentsSubmitted, prepareFormSubmissionAttachments } from '@/services/formAttachmentStorage';
import { useClockingActions } from '@/hooks/useClockingActions';
import { useAuthStore } from '@/store/authStore';
import type { PendingClockOutRequirement, PendingClockOutWorkflow } from '@/types/api';
import { ApiError } from '@/types/errors';
import type { EmployeeForm, QueuedFormSubmissionFailure, SubmitEmployeeFormRequest } from '@/types/forms';

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
  queuedSubmissionFor: (workflowRequirementId: string) => SubmitEmployeeFormRequest | null;
  completeQueuedSubmission: (clientSubmissionId: string) => Promise<void>;
  submissionFailure: QueuedFormSubmissionFailure | null;
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
  const { refreshWorkContext } = useClockingActions();
  const identityKey = identityFor(user);
  const identityRef = useRef(identityKey);
  identityRef.current = identityKey;
  const recordRef = useRef<PendingClockOutRecord | null>(null);
  const recoveryPromiseRef = useRef<Promise<PendingClockOutWorkflow | null> | null>(null);
  const syncPromiseRef = useRef<Promise<void> | null>(null);
  const finalizePromiseRef = useRef<Promise<FinalizeResult> | null>(null);
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
      submissionFailure: current?.workflow.workflowOccurrenceId === nextWorkflow.workflowOccurrenceId
        ? current.submissionFailure
        : undefined,
    });
    setError(null);
  }, [commit]);

  const recover = useCallback((): Promise<PendingClockOutWorkflow | null> => {
    if (recoveryPromiseRef.current) return recoveryPromiseRef.current;
    const run = async () => {
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
    };
    const promise = run().finally(() => {
      if (recoveryPromiseRef.current === promise) recoveryPromiseRef.current = null;
    });
    recoveryPromiseRef.current = promise;
    return promise;
  }, [acceptWorkflow, accessToken, commit, identityKey, status]);

  const finalize = useCallback((): Promise<FinalizeResult> => {
    if (finalizePromiseRef.current) return finalizePromiseRef.current;
    const run = async (): Promise<FinalizeResult> => {
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
    };
    const promise = run().finally(() => {
      if (finalizePromiseRef.current === promise) finalizePromiseRef.current = null;
    });
    finalizePromiseRef.current = promise;
    return promise;
  }, [acceptWorkflow, accessToken, commit, recover]);

  const syncQueued = useCallback(() => {
    if (syncPromiseRef.current || !identityKey || !accessToken) return syncPromiseRef.current;
    const run = async () => {
      if (!await isOnline()) return;
      let processedQueuedSubmission = false;
      while (recordRef.current?.queuedSubmissions.length) {
        const queued = recordRef.current.queuedSubmissions[0];
        try {
          const preparedPayload = await prepareFormSubmissionAttachments(queued.payload, identityKey, accessToken);
          if (JSON.stringify(preparedPayload) !== JSON.stringify(queued.payload)) {
            const current = recordRef.current;
            if (current) await commit({
              ...current,
              queuedSubmissions: [{ ...queued, payload: preparedPayload }, ...current.queuedSubmissions.slice(1)],
            });
          }
          await submitEmployeeForm(preparedPayload, accessToken);
        } catch (submitError) {
          const code = errorCode(submitError);
          if (code === 'form_response_requirement_failed' && submitError instanceof ApiError) {
            const current = recordRef.current;
            if (current) await commit({ ...current, submissionFailure: {
              workflowRequirementId: queued.workflowRequirementId,
              code,
              error: submitError.message,
              fieldId: submitError.fieldId,
            } });
            setError(submitError.message);
            return;
          }
          if (code !== 'workflow_requirement_already_completed') return;
        }
        await markFormAttachmentsSubmitted(identityKey, queued.payload.clientSubmissionId);
        const current = recordRef.current;
        if (!current) return;
        await commit({
          ...current,
          queuedSubmissions: current.queuedSubmissions.slice(1),
          submissionFailure: current.submissionFailure?.workflowRequirementId === queued.workflowRequirementId
            ? undefined
            : current.submissionFailure,
        });
        processedQueuedSubmission = true;
      }
      if (!processedQueuedSubmission) return;
      const refreshed = await recover();
      if (refreshed && workflowRequirements(refreshed).every((item) => item.completed)) {
        const finalized = await finalize();
        if (finalized.ok) await refreshWorkContext();
      }
    };
    const promise = run().finally(() => {
      if (syncPromiseRef.current === promise) syncPromiseRef.current = null;
    });
    syncPromiseRef.current = promise;
    return promise;
  }, [accessToken, commit, finalize, identityKey, recover, refreshWorkContext]);

  const acceptWorkflowRef = useRef(acceptWorkflow);
  const recoverRef = useRef(recover);
  const syncQueuedRef = useRef(syncQueued);
  acceptWorkflowRef.current = acceptWorkflow;
  recoverRef.current = recover;
  syncQueuedRef.current = syncQueued;

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
        if (bootstrap.pendingClockOutWorkflow) await acceptWorkflowRef.current(bootstrap.pendingClockOutWorkflow);
        else if (bootstrap.capabilities?.requiredAfterClockOutForms || stored) await recoverRef.current();
        await syncQueuedRef.current();
      } catch {
        // The stored workflow remains the safe fallback until connectivity recovers.
      }
    }).catch(() => setHydrated(true));
    return () => { cancelled = true; };
  }, [accessToken, identityKey, status]);

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
    const existingIndex = current.queuedSubmissions.findIndex((item) => item.payload.clientSubmissionId === payload.clientSubmissionId);
    if (existingIndex >= 0) {
      await commit({
        ...current,
        queuedSubmissions: current.queuedSubmissions.map((item, index) => index === existingIndex ? { ...item, payload } : item),
        submissionFailure: undefined,
      });
      return;
    }
    await commit({
      ...current,
      queuedSubmissions: [...current.queuedSubmissions, {
        workflowOccurrenceId: payload.workflowOccurrenceId,
        workflowRequirementId: payload.workflowRequirementId,
        payload,
        queuedAt: new Date().toISOString(),
      }],
      submissionFailure: undefined,
    });
  }, [commit]);

  const queuedSubmissionFor = useCallback((workflowRequirementId: string) => (
    recordRef.current?.queuedSubmissions.find((item) => item.workflowRequirementId === workflowRequirementId)?.payload ?? null
  ), []);

  const completeQueuedSubmission = useCallback(async (clientSubmissionId: string) => {
    const current = recordRef.current;
    if (!current) return;
    const completed = current.queuedSubmissions.find((item) => item.payload.clientSubmissionId === clientSubmissionId);
    await commit({
      ...current,
      queuedSubmissions: current.queuedSubmissions.filter((item) => item.payload.clientSubmissionId !== clientSubmissionId),
      submissionFailure: completed?.workflowRequirementId === current.submissionFailure?.workflowRequirementId
        ? undefined
        : current.submissionFailure,
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
    queuedSubmissionFor,
    completeQueuedSubmission,
    submissionFailure: recordRef.current?.submissionFailure ?? null,
    refreshAfterSubmission,
    finalize,
  }), [acceptWorkflow, busy, completeQueuedSubmission, completedCount, currentRequirement, error, finalize, hydrated, queueSubmission, queuedSubmissionFor, recover, refreshAfterSubmission, submissionIdFor, totalCount, workflow]);

  return <PendingClockOutContext.Provider value={value}>{children}</PendingClockOutContext.Provider>;
}

export function usePendingClockOutStore() {
  const context = useContext(PendingClockOutContext);
  if (!context) throw new Error('usePendingClockOutStore must be used inside PendingClockOutProvider');
  return context;
}