import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as clockingApi from '@/api/clockingApi';
import { loadRequiredForms, submitEmployeeForm } from '@/api/formsApi';
import { isOnline } from '@/services/connectivity';
import {
  clearPendingClockInRecord,
  loadPendingClockInRecord,
  savePendingClockInRecord,
  type PendingClockInRecord,
} from '@/services/pendingClockInStorage';
import { createFormClientSubmissionId } from '@/services/requestGuards';
import { markFormAttachmentsSubmitted, prepareFormSubmissionAttachments } from '@/services/formAttachmentStorage';
import { useClockingActions } from '@/hooks/useClockingActions';
import { useAuthStore } from '@/store/authStore';
import { useOptionalOfflineClockStore } from '@/store/offlineClockContext';
import type { PendingClockInRequirement, PendingClockInWorkflow } from '@/types/api';
import { ApiError } from '@/types/errors';
import type { EmployeeForm, QueuedFormSubmissionFailure, SubmitEmployeeFormRequest } from '@/types/forms';

type FinalizeResult = { ok: true } | { ok: false; error: string };
type FinalizationRecovery =
  | { status: 'recovered'; workflow: PendingClockInWorkflow }
  | { status: 'completed' }
  | { status: 'missing' }
  | { status: 'unavailable' };

export type PendingClockInPhase =
  | { kind: 'no_pending_workflow' }
  | { kind: 'requirements_outstanding'; current: number; total: number }
  | { kind: 'ready_to_finalize'; total: number };

export function pendingClockInPhase(workflow: PendingClockInWorkflow | null): PendingClockInPhase {
  if (!workflow) return { kind: 'no_pending_workflow' };
  const total = Math.max(
    0,
    workflow.requiredFormCount,
    workflow.completedRequiredFormCount + workflow.remainingRequiredFormCount,
  );
  if (workflow.remainingRequiredFormCount === 0) return { kind: 'ready_to_finalize', total };
  return {
    kind: 'requirements_outstanding',
    current: Math.min(total, Math.max(1, workflow.completedRequiredFormCount + 1)),
    total,
  };
}

type PendingClockInState = {
  hydrated: boolean;
  workflow: PendingClockInWorkflow | null;
  currentRequirement: PendingClockInRequirement | null;
  currentForm: EmployeeForm | null;
  completedCount: number;
  totalCount: number;
  phase: PendingClockInPhase;
  busy: boolean;
  error: string | null;
  acceptWorkflow: (workflow: PendingClockInWorkflow) => Promise<PendingClockInWorkflow>;
  ensureCurrentForm: () => Promise<EmployeeForm | null>;
  recover: () => Promise<PendingClockInWorkflow | null>;
  submissionIdFor: (requirementId: string) => Promise<string>;
  queueSubmission: (payload: SubmitEmployeeFormRequest) => Promise<void>;
  queuedSubmissionFor: (requirementId: string) => SubmitEmployeeFormRequest | null;
  completeQueuedSubmission: (clientSubmissionId: string) => Promise<void>;
  submissionFailure: QueuedFormSubmissionFailure | null;
  refreshAfterSubmission: () => Promise<PendingClockInWorkflow | null>;
  finalize: () => Promise<FinalizeResult>;
};

const PendingClockInContext = createContext<PendingClockInState | undefined>(undefined);

export function pendingClockInRequirementForm(requirement: PendingClockInRequirement | null): EmployeeForm | null {
  if (!requirement) return null;
  if (requirement.form) return requirement.form;
  if (requirement.formPackage) return { ...requirement.formPackage, context: requirement.context ?? requirement.formPackage.context };
  if (!requirement.fields) return null;
  return {
    id: requirement.formId,
    name: requirement.name ?? 'Required pre-shift form',
    description: requirement.description,
    category: requirement.category,
    trigger: 'before_clock_in',
    required: true,
    completionRequirement: 'required',
    context: requirement.context,
    fields: requirement.fields,
    submissionState: requirement.submissionState ?? { completed: Boolean(requirement.completed) },
  };
}

function identityFor(user: ReturnType<typeof useAuthStore>['user']) {
  return user?.employeeId ? `${user.businessId}:${user.id}:${user.employeeId}` : null;
}

function errorCode(error: unknown) {
  return error instanceof ApiError ? error.code?.toLowerCase() : undefined;
}

const CLOCK_IN_INTENT_ERROR_CODES = new Set([
  'clock_in_intent_invalid',
  'job_selection_invalid',
  'job_work_area_invalid',
  'job_work_area_required',
  'job_work_area_unavailable',
]);

export function PendingClockInProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, status, user } = useAuthStore();
  const { refreshWorkContext } = useClockingActions();
  const offlineClock = useOptionalOfflineClockStore();
  const outboxWorkflow = offlineClock?.pendingClockInWorkflow;
  const acknowledgeOutboxWorkflow = offlineClock?.acknowledgePendingClockInWorkflow;
  const identityKey = identityFor(user);
  const identityRef = useRef(identityKey);
  identityRef.current = identityKey;
  const recordRef = useRef<PendingClockInRecord | null>(null);
  const syncPromiseRef = useRef<Promise<void> | null>(null);
  const finalizePromiseRef = useRef<Promise<FinalizeResult> | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [workflow, setWorkflow] = useState<PendingClockInWorkflow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commit = useCallback(async (next: PendingClockInRecord | null) => {
    if (!identityKey) return;
    recordRef.current = next;
    setWorkflow(next?.workflow ?? null);
    if (next) await savePendingClockInRecord(identityKey, next);
    else await clearPendingClockInRecord(identityKey);
  }, [identityKey]);

  const acceptWorkflow = useCallback(async (nextWorkflow: PendingClockInWorkflow) => {
    const current = recordRef.current;
    const sameOccurrence = current?.workflow.workflowOccurrenceId === nextWorkflow.workflowOccurrenceId;
    const embeddedForms = new Map(
      [...nextWorkflow.requiredForms, ...nextWorkflow.remainingForms]
        .filter((requirement) => requirement.form)
        .map((requirement) => [requirement.requirementId, requirement.form!]),
    );
    const normalize = (requirement: PendingClockInRequirement) => ({
      ...requirement,
      form: requirement.form ?? embeddedForms.get(requirement.requirementId),
    });
    let enrichedWorkflow = {
      ...nextWorkflow,
      requiredForms: nextWorkflow.requiredForms.map(normalize),
      remainingForms: nextWorkflow.remainingForms.map(normalize),
    };
    const currentRequirement = enrichedWorkflow.remainingForms[0] ?? null;
    if (currentRequirement && !pendingClockInRequirementForm(currentRequirement)) {
      try {
        const response = await loadRequiredForms('before_clock_in', accessToken);
        const formsById = new Map(response.forms.map((form) => [form.id, form]));
        const enrich = (requirement: PendingClockInRequirement) => ({
          ...requirement,
          form: requirement.form ?? requirement.formPackage ?? formsById.get(requirement.formId),
        });
        enrichedWorkflow = {
          ...enrichedWorkflow,
          requiredForms: enrichedWorkflow.requiredForms.map(enrich),
          remainingForms: enrichedWorkflow.remainingForms.map(enrich),
        };
      } catch {
        // Persist the authoritative workflow even when its render package cannot be refreshed yet.
      }
    }
    await commit({
      workflow: enrichedWorkflow,
      submissionIds: sameOccurrence ? current.submissionIds : {},
      queuedSubmissions: sameOccurrence ? current.queuedSubmissions : [],
      submissionFailure: sameOccurrence ? current.submissionFailure : undefined,
    });
    setError(null);
    return enrichedWorkflow;
  }, [accessToken, commit]);

  useEffect(() => {
    if (!hydrated || !outboxWorkflow || !acknowledgeOutboxWorkflow || status !== 'authenticated' || outboxWorkflow.clockInIntent.employeeId !== user?.employeeId) return;
    let cancelled = false;
    void acceptWorkflow(outboxWorkflow).then(() => {
      if (!cancelled && identityRef.current === identityKey) acknowledgeOutboxWorkflow();
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [acceptWorkflow, acknowledgeOutboxWorkflow, hydrated, identityKey, outboxWorkflow, status, user?.employeeId]);

  const recover = useCallback(async () => {
    if (!identityKey || status !== 'authenticated') return null;
    if (!await isOnline()) return recordRef.current?.workflow ?? null;
    try {
      const response = await clockingApi.loadPendingClockIn(accessToken);
      if (identityRef.current !== identityKey) return null;
      if (response.status === 'no_pending_clock_in') {
        await commit(null);
        return null;
      }
      return await acceptWorkflow(response);
    } catch {
      setError('Could not refresh pending clock-in. Your progress is still saved.');
      return recordRef.current?.workflow ?? null;
    }
  }, [acceptWorkflow, accessToken, commit, identityKey, status]);

  const ensureCurrentForm = useCallback(async () => {
    const cachedWorkflow = recordRef.current?.workflow;
    if (pendingClockInPhase(cachedWorkflow ?? null).kind === 'ready_to_finalize') return null;
    const cachedRequirement = cachedWorkflow?.remainingForms[0] ?? null;
    const cachedForm = pendingClockInRequirementForm(cachedRequirement);
    if (cachedForm) return cachedForm;
    if (!cachedWorkflow) return null;
    if (!await isOnline()) {
      setError('Required form could not be loaded. Check your connection and try again.');
      return null;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await clockingApi.loadPendingClockIn(accessToken);
      if (response.status === 'no_pending_clock_in') {
        setError('Required form could not be loaded. Check your connection and try again.');
        return null;
      }
      const accepted = await acceptWorkflow(response);
      const form = pendingClockInRequirementForm(accepted.remainingForms[0] ?? null);
      if (!form) setError('Required form could not be loaded. Check your connection and try again.');
      return form;
    } catch {
      setError('Required form could not be loaded. Check your connection and try again.');
      return null;
    } finally {
      setBusy(false);
    }
  }, [acceptWorkflow, accessToken]);

  const recoverStaleWorkflow = useCallback(async () => {
    try {
      const bootstrap = await clockingApi.loadBootstrap(accessToken, { force: true });
      if (bootstrap.pendingClockInWorkflow) {
        return await acceptWorkflow(bootstrap.pendingClockInWorkflow);
      }
    } catch {
      // Continue to the dedicated workflow endpoint.
    }
    return recover();
  }, [acceptWorkflow, accessToken, recover]);

  const recoverForFinalization = useCallback(async (): Promise<FinalizationRecovery> => {
    let bootstrapConfirmedNotActive = false;
    try {
      const bootstrap = await clockingApi.loadBootstrap(accessToken, { force: true });
      if (bootstrap.pendingClockInWorkflow) {
        return { status: 'recovered', workflow: await acceptWorkflow(bootstrap.pendingClockInWorkflow) };
      }
      if (bootstrap.currentActiveEntryId) {
        await commit(null);
        return { status: 'completed' };
      }
      bootstrapConfirmedNotActive = true;
    } catch {
      // The dedicated pending endpoint can still recover the exact workflow.
    }

    try {
      const response = await clockingApi.loadPendingClockIn(accessToken);
      if (response.status !== 'no_pending_clock_in') {
        return { status: 'recovered', workflow: await acceptWorkflow(response) };
      }
      if (bootstrapConfirmedNotActive) {
        await commit(null);
        return { status: 'missing' };
      }
      return { status: 'unavailable' };
    } catch {
      return { status: 'unavailable' };
    }
  }, [acceptWorkflow, accessToken, commit]);

  const finalize = useCallback((): Promise<FinalizeResult> => {
    if (finalizePromiseRef.current) return finalizePromiseRef.current;
    const run = async (): Promise<FinalizeResult> => {
      if (!await isOnline()) {
        const message = 'Reconnect to finish clocking in.';
        setError(message);
        return { ok: false, error: message };
      }
      setBusy(true);
      setError(null);
      try {
        let current = recordRef.current?.workflow;
        if (!current) {
          const recovered = await recoverForFinalization();
          if (recovered.status === 'completed') return { ok: true };
          if (recovered.status === 'missing') {
            const message = 'No pending clock-in was found after refreshing.';
            setError(message);
            return { ok: false, error: message };
          }
          if (recovered.status === 'unavailable') {
            const message = 'Clock-in status could not be verified. Check your connection and try again.';
            setError(message);
            return { ok: false, error: message };
          }
          current = recovered.workflow;
        }
        const response = await clockingApi.finalizeClockIn({ workflowOccurrenceId: current.workflowOccurrenceId }, accessToken);
        if (response.status === 'clock_in_pending_required_forms') {
          await acceptWorkflow(response);
          return { ok: false, error: 'Complete the remaining required form.' };
        }
        if (response.status === 'required_forms_outstanding') {
          await recover();
          return { ok: false, error: 'Complete the remaining required form.' };
        }
        if (response.status === 'clock_in_workflow_not_found') {
          await recoverStaleWorkflow();
          return { ok: false, error: 'This pending clock-in changed. Refresh and continue the restored workflow.' };
        }
        if (response.status === 'clock_in_workflow_forbidden') {
          await recoverStaleWorkflow();
          return { ok: false, error: 'This pending clock-in is no longer available for this account.' };
        }
        await commit(null);
        return { ok: true };
      } catch (finalizeError) {
        const code = errorCode(finalizeError);
        if (code === 'required_forms_outstanding') {
          await recover();
          return { ok: false, error: 'Complete the remaining required form.' };
        }
        if (code === 'clock_in_already_finalized') {
          await commit(null);
          return { ok: true };
        }
        if (code === 'clock_in_workflow_not_found' || code === 'clock_in_workflow_forbidden') await recoverStaleWorkflow();
        const message = code === 'clock_in_workflow_forbidden'
          ? 'This pending clock-in is no longer available for this account.'
          : code && CLOCK_IN_INTENT_ERROR_CODES.has(code) && finalizeError instanceof ApiError
            ? finalizeError.message
            : 'Clock-in could not be finalized. Your required form progress is still saved.';
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
  }, [acceptWorkflow, accessToken, commit, recover, recoverForFinalization, recoverStaleWorkflow]);

  const syncQueued = useCallback((authoritativeWorkflow?: PendingClockInWorkflow | null) => {
    if (syncPromiseRef.current || !identityKey || !accessToken) return syncPromiseRef.current;
    const run = async () => {
      if (!await isOnline()) return;
      let processedQueuedSubmission = false;
      while (recordRef.current?.queuedSubmissions.length) {
        const payload = recordRef.current.queuedSubmissions[0];
        try {
          const preparedPayload = await prepareFormSubmissionAttachments(payload, identityKey, accessToken);
          if (JSON.stringify(preparedPayload) !== JSON.stringify(payload)) {
            const current = recordRef.current;
            if (current) await commit({ ...current, queuedSubmissions: [preparedPayload, ...current.queuedSubmissions.slice(1)] });
          }
          await submitEmployeeForm(preparedPayload, accessToken);
        } catch (submitError) {
          const code = errorCode(submitError);
          if (code === 'form_response_requirement_failed' && submitError instanceof ApiError && payload.workflowRequirementId) {
            const current = recordRef.current;
            if (current) await commit({ ...current, submissionFailure: {
              workflowRequirementId: payload.workflowRequirementId,
              code,
              error: submitError.message,
              fieldId: submitError.fieldId,
            } });
            setError(submitError.message);
            return;
          }
          if (code !== 'workflow_requirement_already_completed') return;
        }
        await markFormAttachmentsSubmitted(identityKey, payload.clientSubmissionId);
        const current = recordRef.current;
        if (!current) return;
        await commit({
          ...current,
          queuedSubmissions: current.queuedSubmissions.slice(1),
          submissionFailure: current.submissionFailure?.workflowRequirementId === payload.workflowRequirementId
            ? undefined
            : current.submissionFailure,
        });
        processedQueuedSubmission = true;
      }
      const refreshed = processedQueuedSubmission || authoritativeWorkflow === undefined
        ? await recover()
        : authoritativeWorkflow;
      if (refreshed && pendingClockInPhase(refreshed).kind === 'ready_to_finalize') {
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

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    setWorkflow(null);
    recordRef.current = null;
    if (!identityKey || status !== 'authenticated') {
      setHydrated(true);
      return () => { cancelled = true; };
    }
    void loadPendingClockInRecord(identityKey).then(async (stored) => {
      if (cancelled || identityRef.current !== identityKey) return;
      recordRef.current = stored;
      setWorkflow(stored?.workflow ?? null);
      setHydrated(true);
      if (!await isOnline()) return;
      try {
        const bootstrap = await clockingApi.loadBootstrap(accessToken);
        if (cancelled || identityRef.current !== identityKey) return;
        const authoritativeWorkflow = bootstrap.pendingClockInWorkflow
          ? await acceptWorkflow(bootstrap.pendingClockInWorkflow)
          : bootstrap.capabilities?.requiredBeforeClockInForms || stored
            ? await recover()
            : null;
        await syncQueued(authoritativeWorkflow);
      } catch {
        // Keep the persisted workflow until authoritative recovery succeeds.
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
    return () => { networkSubscription(); appSubscription.remove(); };
  }, [hydrated, status, syncQueued]);

  const submissionIdFor = useCallback(async (requirementId: string) => {
    const current = recordRef.current;
    if (!current) return createFormClientSubmissionId();
    if (current.submissionIds[requirementId]) return current.submissionIds[requirementId];
    const value = createFormClientSubmissionId();
    await commit({ ...current, submissionIds: { ...current.submissionIds, [requirementId]: value } });
    return value;
  }, [commit]);

  const queueSubmission = useCallback(async (payload: SubmitEmployeeFormRequest) => {
    const current = recordRef.current;
    if (!current || !payload.workflowOccurrenceId || !payload.workflowRequirementId) throw new Error('Required clock-in workflow metadata is missing.');
    if (current.workflow.workflowOccurrenceId !== payload.workflowOccurrenceId) throw new Error('This required form belongs to a different clock-in.');
    const existingIndex = current.queuedSubmissions.findIndex((item) => item.clientSubmissionId === payload.clientSubmissionId);
    const queuedSubmissions = existingIndex >= 0
      ? current.queuedSubmissions.map((item, index) => index === existingIndex ? payload : item)
      : [...current.queuedSubmissions, payload];
    await commit({ ...current, queuedSubmissions, submissionFailure: undefined });
  }, [commit]);

  const queuedSubmissionFor = useCallback((requirementId: string) => (
    recordRef.current?.queuedSubmissions.find((item) => item.workflowRequirementId === requirementId) ?? null
  ), []);

  const completeQueuedSubmission = useCallback(async (clientSubmissionId: string) => {
    const current = recordRef.current;
    if (!current) return;
    const completed = current.queuedSubmissions.find((item) => item.clientSubmissionId === clientSubmissionId);
    await commit({
      ...current,
      queuedSubmissions: current.queuedSubmissions.filter((item) => item.clientSubmissionId !== clientSubmissionId),
      submissionFailure: completed?.workflowRequirementId === current.submissionFailure?.workflowRequirementId
        ? undefined
        : current.submissionFailure,
    });
  }, [commit]);

  const currentRequirement = workflow?.remainingForms[0] ?? null;
  const phase = pendingClockInPhase(workflow);
  const value = useMemo<PendingClockInState>(() => ({
    hydrated,
    workflow,
    currentRequirement,
    currentForm: pendingClockInRequirementForm(currentRequirement),
    completedCount: workflow?.completedRequiredFormCount ?? 0,
    totalCount: workflow?.requiredFormCount ?? 0,
    phase,
    busy,
    error,
    acceptWorkflow,
    ensureCurrentForm,
    recover,
    submissionIdFor,
    queueSubmission,
    queuedSubmissionFor,
    completeQueuedSubmission,
    submissionFailure: recordRef.current?.submissionFailure ?? null,
    refreshAfterSubmission: recover,
    finalize,
  }), [acceptWorkflow, busy, completeQueuedSubmission, currentRequirement, ensureCurrentForm, error, finalize, hydrated, phase, queueSubmission, queuedSubmissionFor, recover, submissionIdFor, workflow]);

  return <PendingClockInContext.Provider value={value}>{children}</PendingClockInContext.Provider>;
}

export function usePendingClockInStore() {
  const context = useContext(PendingClockInContext);
  if (!context) throw new Error('usePendingClockInStore must be used inside PendingClockInProvider');
  return context;
}