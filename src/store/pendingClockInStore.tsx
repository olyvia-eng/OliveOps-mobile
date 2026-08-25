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
import { useClockingActions } from '@/hooks/useClockingActions';
import { useAuthStore } from '@/store/authStore';
import { useOptionalOfflineClockStore } from '@/store/offlineClockContext';
import type { PendingClockInRequirement, PendingClockInWorkflow } from '@/types/api';
import { ApiError } from '@/types/errors';
import type { EmployeeForm, SubmitEmployeeFormRequest } from '@/types/forms';

type FinalizeResult = { ok: true } | { ok: false; error: string };

type PendingClockInState = {
  hydrated: boolean;
  workflow: PendingClockInWorkflow | null;
  currentRequirement: PendingClockInRequirement | null;
  currentForm: EmployeeForm | null;
  completedCount: number;
  totalCount: number;
  busy: boolean;
  error: string | null;
  acceptWorkflow: (workflow: PendingClockInWorkflow) => Promise<PendingClockInWorkflow>;
  ensureCurrentForm: () => Promise<EmployeeForm | null>;
  recover: () => Promise<PendingClockInWorkflow | null>;
  submissionIdFor: (requirementId: string) => Promise<string>;
  queueSubmission: (payload: SubmitEmployeeFormRequest) => Promise<void>;
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
      setError('Could not refresh the required pre-shift form. Your progress is still saved.');
      return recordRef.current?.workflow ?? null;
    }
  }, [acceptWorkflow, accessToken, commit, identityKey, status]);

  const ensureCurrentForm = useCallback(async () => {
    const cachedWorkflow = recordRef.current?.workflow;
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

  const finalize = useCallback(async (): Promise<FinalizeResult> => {
    const current = recordRef.current?.workflow;
    if (!current) return { ok: false, error: 'No pending clock-in was found.' };
    if (!await isOnline()) return { ok: false, error: 'Reconnect to finish clocking in.' };
    setBusy(true);
    setError(null);
    try {
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
      await refreshWorkContext();
      return { ok: true };
    } catch (finalizeError) {
      const code = errorCode(finalizeError);
      if (code === 'required_forms_outstanding') {
        await recover();
        return { ok: false, error: 'Complete the remaining required form.' };
      }
      if (code === 'clock_in_already_finalized') {
        await commit(null);
        await refreshWorkContext();
        return { ok: true };
      }
      if (code === 'clock_in_workflow_not_found' || code === 'clock_in_workflow_forbidden') await recoverStaleWorkflow();
      const message = code === 'clock_in_workflow_forbidden'
        ? 'This pending clock-in is no longer available for this account.'
        : 'Clock-in could not be finalized. Your required form progress is still saved.';
      setError(message);
      return { ok: false, error: message };
    } finally {
      setBusy(false);
    }
  }, [acceptWorkflow, accessToken, commit, recover, recoverStaleWorkflow, refreshWorkContext]);

  const syncQueued = useCallback(async () => {
    if (syncPromiseRef.current || !identityKey || !accessToken || !await isOnline()) return syncPromiseRef.current;
    const run = async () => {
      while (recordRef.current?.queuedSubmissions.length) {
        const payload = recordRef.current.queuedSubmissions[0];
        try {
          await submitEmployeeForm(payload, accessToken);
        } catch (submitError) {
          if (errorCode(submitError) !== 'workflow_requirement_already_completed') return;
        }
        const current = recordRef.current;
        if (!current) return;
        await commit({ ...current, queuedSubmissions: current.queuedSubmissions.slice(1) });
      }
      const refreshed = await recover();
      if (refreshed && refreshed.remainingRequiredFormCount === 0) await finalize();
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
    void loadPendingClockInRecord(identityKey).then(async (stored) => {
      if (cancelled || identityRef.current !== identityKey) return;
      recordRef.current = stored;
      setWorkflow(stored?.workflow ?? null);
      setHydrated(true);
      if (!await isOnline()) return;
      try {
        const bootstrap = await clockingApi.loadBootstrap(accessToken);
        if (cancelled || identityRef.current !== identityKey) return;
        if (bootstrap.pendingClockInWorkflow) await acceptWorkflow(bootstrap.pendingClockInWorkflow);
        else if (bootstrap.capabilities?.requiredBeforeClockInForms || stored) await recover();
        await syncQueued();
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
    if (current.queuedSubmissions.some((item) => item.clientSubmissionId === payload.clientSubmissionId)) return;
    await commit({ ...current, queuedSubmissions: [...current.queuedSubmissions, payload] });
  }, [commit]);

  const currentRequirement = workflow?.remainingForms[0] ?? null;
  const value = useMemo<PendingClockInState>(() => ({
    hydrated,
    workflow,
    currentRequirement,
    currentForm: pendingClockInRequirementForm(currentRequirement),
    completedCount: workflow?.completedRequiredFormCount ?? 0,
    totalCount: workflow?.requiredFormCount ?? 0,
    busy,
    error,
    acceptWorkflow,
    ensureCurrentForm,
    recover,
    submissionIdFor,
    queueSubmission,
    refreshAfterSubmission: recover,
    finalize,
  }), [acceptWorkflow, busy, currentRequirement, ensureCurrentForm, error, finalize, hydrated, queueSubmission, recover, submissionIdFor, workflow]);

  return <PendingClockInContext.Provider value={value}>{children}</PendingClockInContext.Provider>;
}

export function usePendingClockInStore() {
  const context = useContext(PendingClockInContext);
  if (!context) throw new Error('usePendingClockInStore must be used inside PendingClockInProvider');
  return context;
}