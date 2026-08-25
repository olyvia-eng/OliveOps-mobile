import { useCallback, useRef, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import {
  loadEmployeeForms,
  loadEmployeeSubmission,
  loadRequiredForms,
  submitEmployeeForm,
} from '@/api/formsApi';
import { toFormsError } from '@/features/forms/formsError';
import { isOnline } from '@/services/connectivity';
import { beginRequest, endRequest } from '@/services/requestGuards';
import { useAuthStore } from '@/store/authStore';
import { useFormsStore } from '@/store/formsStore';
import type {
  EmployeeFormsContextFilter,
  EmployeeRequiredFormTrigger,
  SubmitEmployeeFormRequest,
} from '@/types/forms';
import { ApiError } from '@/types/errors';

const FORMS_STALE_MS = 5 * 60 * 1000;

function contextMatches(
  completedContext: EmployeeFormsContextFilter | undefined,
  payload: SubmitEmployeeFormRequest,
) {
  return (!payload.jobId || completedContext?.jobId === payload.jobId)
    && (!payload.equipmentId || completedContext?.equipmentId === payload.equipmentId)
    && (!payload.divisionId || completedContext?.divisionId === payload.divisionId);
}

function captureUnexpectedFormsError(error: unknown, operation: string) {
  if (error instanceof ApiError || error instanceof TypeError) return;
  Sentry.captureException(error, { tags: { feature: 'forms', operation } });
}

export function useFormsActions() {
  const { accessToken, status, user } = useAuthStore();
  const {
    loadedAt,
    setFlashMessage,
    setSubmissionDetail,
    setWorkspace,
  } = useFormsStore();
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [loadingSubmission, setLoadingSubmission] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const authIdentity = status === 'authenticated' && user
    ? `${user.businessId}:${user.id}:${user.employeeId ?? ''}:${accessToken ?? ''}`
    : '';
  const currentAuthIdentityRef = useRef(authIdentity);
  currentAuthIdentityRef.current = authIdentity;
  const loadedAtRef = useRef(loadedAt);
  loadedAtRef.current = loadedAt;

  const commitWorkspace = useCallback(async (requestIdentity: string) => {
    const workspace = await loadEmployeeForms(accessToken);
    if (currentAuthIdentityRef.current !== requestIdentity) return null;
    setWorkspace(workspace);
    return workspace;
  }, [accessToken, setWorkspace]);

  const refreshForms = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    if (!authIdentity) return { ok: false as const, error: 'Please log in to view Forms.' };
    if (!force && loadedAtRef.current && Date.now() - loadedAtRef.current < FORMS_STALE_MS) {
      return { ok: true as const, skipped: true as const };
    }
    if (!beginRequest('forms:workspace')) {
      return { ok: false as const, error: 'Forms are already refreshing.' };
    }

    const requestIdentity = authIdentity;
    setLoadingWorkspace(true);
    try {
      if (!await isOnline()) {
        return { ok: false as const, error: 'Offline. Reconnect to refresh Forms.' };
      }
      const workspace = await commitWorkspace(requestIdentity);
      if (!workspace) return { ok: false as const, stale: true as const };
      return { ok: true as const, workspace };
    } catch (error) {
      captureUnexpectedFormsError(error, 'refresh');
      return {
        ok: false as const,
        error: toFormsError(error, 'Could not load Forms. Please try again.'),
      };
    } finally {
      endRequest('forms:workspace');
      setLoadingWorkspace(false);
    }
  }, [authIdentity, commitWorkspace]);

  const getRequiredForms = useCallback(async (
    trigger: EmployeeRequiredFormTrigger,
    filters: EmployeeFormsContextFilter = {},
  ) => {
    if (!authIdentity) return { ok: false as const, error: 'Please log in to view Forms.' };
    const key = `forms:required:${trigger}:${filters.jobId ?? ''}:${filters.equipmentId ?? ''}:${filters.divisionId ?? ''}`;
    if (!beginRequest(key)) return { ok: false as const, error: 'Required Forms are already loading.' };
    const requestIdentity = authIdentity;
    try {
      if (!await isOnline()) return { ok: false as const, error: 'Offline. Reconnect to check required Forms.' };
      const response = await loadRequiredForms(trigger, accessToken, filters);
      if (currentAuthIdentityRef.current !== requestIdentity) return { ok: false as const, stale: true as const };
      return { ok: true as const, forms: response.forms };
    } catch (error) {
      captureUnexpectedFormsError(error, 'required');
      return { ok: false as const, error: toFormsError(error, 'Could not check required Forms.') };
    } finally {
      endRequest(key);
    }
  }, [accessToken, authIdentity]);

  const getSubmission = useCallback(async (submissionId: string) => {
    if (!authIdentity) return { ok: false as const, error: 'Please log in to view this submission.' };
    const key = `forms:submission:${submissionId}`;
    if (!beginRequest(key)) return { ok: false as const, error: 'This submission is already loading.' };
    const requestIdentity = authIdentity;
    setLoadingSubmission(true);
    try {
      if (!await isOnline()) {
        return { ok: false as const, error: 'Offline. Reconnect to load this submission.' };
      }
      const detail = await loadEmployeeSubmission(submissionId, accessToken);
      if (currentAuthIdentityRef.current !== requestIdentity) return { ok: false as const, stale: true as const };
      setSubmissionDetail(detail);
      return { ok: true as const, detail };
    } catch (error) {
      captureUnexpectedFormsError(error, 'submission');
      return { ok: false as const, error: toFormsError(error, 'Could not load this submission.') };
    } finally {
      endRequest(key);
      setLoadingSubmission(false);
    }
  }, [accessToken, authIdentity, setSubmissionDetail]);

  const submitForm = useCallback(async (payload: SubmitEmployeeFormRequest) => {
    if (!authIdentity) return { ok: false as const, error: 'Please log in to submit this form.' };
    const key = `forms:submit:${payload.formId}:${payload.trigger}:${payload.jobId ?? ''}:${payload.equipmentId ?? ''}:${payload.divisionId ?? ''}`;
    if (!beginRequest(key)) return { ok: false as const, error: 'This form is already being submitted.' };

    const requestIdentity = authIdentity;
    setSubmitting(true);
    try {
      if (!await isOnline()) {
        return { ok: false as const, error: 'Offline. Reconnect to submit this form.' };
      }

      const response = await submitEmployeeForm(payload, accessToken);
      if (currentAuthIdentityRef.current !== requestIdentity) return { ok: false as const, stale: true as const };

      try {
        await commitWorkspace(requestIdentity);
      } catch (refreshError) {
        captureUnexpectedFormsError(refreshError, 'post-submit-refresh');
        setFlashMessage('Form submitted. Pull to refresh if it does not appear in Completed yet.');
        return { ok: true as const, submission: response.submission, warning: true as const };
      }

      setFlashMessage('Form submitted successfully.');
      return { ok: true as const, submission: response.submission };
    } catch (error) {
      const shouldReconcile = (error instanceof ApiError && (error.status === 408 || error.status === 409))
        || error instanceof TypeError;

      if (shouldReconcile && currentAuthIdentityRef.current === requestIdentity) {
        try {
          const workspace = await commitWorkspace(requestIdentity);
          const completed = workspace?.completed.find((item) => (
            item.formId === payload.formId
            && item.trigger === payload.trigger
            && contextMatches(item.context, payload)
            && (payload.trigger !== 'on_demand' || item.clientSubmissionId === payload.clientSubmissionId)
          ));
          if (completed) {
            setFlashMessage('Form submitted successfully.');
            return { ok: true as const, reconciled: true as const, completed };
          }
        } catch (reconcileError) {
          captureUnexpectedFormsError(reconcileError, 'reconcile');
        }
      }

      captureUnexpectedFormsError(error, 'submit');
      if (error instanceof ApiError && error.fieldId) {
        return {
          ok: false as const,
          error: 'Some answers need attention before this form can be submitted.',
          fieldErrors: { [error.fieldId]: 'Check this answer and try again.' },
        };
      }
      return {
        ok: false as const,
        code: error instanceof ApiError ? error.code?.toLowerCase() : undefined,
        error: shouldReconcile
          ? 'Submission could not be confirmed. Your answers are still here. Retry when ready.'
          : toFormsError(error, 'Could not submit this form. Your answers are still here.'),
        uncertain: shouldReconcile,
      };
    } finally {
      endRequest(key);
      setSubmitting(false);
    }
  }, [accessToken, authIdentity, commitWorkspace, setFlashMessage]);

  return {
    refreshForms,
    getRequiredForms,
    getSubmission,
    submitForm,
    loadingWorkspace,
    loadingSubmission,
    submitting,
  };
}