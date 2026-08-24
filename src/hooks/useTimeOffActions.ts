import { useCallback, useRef, useState } from 'react';
import {
  cancelMyTimeOffRequest,
  createMyTimeOffRequest,
  getMyTimeOffRequest,
  listMyTimeOffRequests,
} from '@/api/timeOffApi';
import { isOnline } from '@/services/connectivity';
import { beginRequest, createRequestMeta, endRequest } from '@/services/requestGuards';
import { useAuthStore } from '@/store/authStore';
import { useTimeOffStore, type TimeOffDraft } from '@/store/timeOffStore';
import { ApiError } from '@/types/errors';
import type { TimeOffRequest } from '@/types/timeOff';
import { toUserFacingError } from '@/utils/userFacingError';

function fingerprint(draft: TimeOffDraft) {
  return JSON.stringify({
    requestType: draft.requestType,
    startDate: draft.startDate,
    endDate: draft.endDate,
    employeeNote: draft.employeeNote.trim(),
  });
}

function authoritativeRequest(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 409 || !error.data || typeof error.data !== 'object') return null;
  const request = (error.data as { request?: unknown }).request;
  return request && typeof request === 'object' ? request as TimeOffRequest : null;
}

function isUncertain(error: unknown) {
  return error instanceof TypeError || (error instanceof ApiError && error.status === 408);
}

export function useTimeOffActions() {
  const { accessToken, status, user } = useAuthStore();
  const store = useTimeOffStore();
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const authIdentity = status === 'authenticated' && user
    ? `${user.businessId}:${user.id}:${user.employeeId ?? ''}:${accessToken ?? ''}`
    : '';
  const identityRef = useRef(authIdentity);
  identityRef.current = authIdentity;

  const refresh = useCallback(async () => {
    if (!authIdentity) return { ok: false as const, error: 'Please log in to view Time Off.' };
    if (!beginRequest('time-off:list')) return { ok: false as const, error: 'Time Off is already refreshing.' };
    const requestIdentity = authIdentity;
    setLoadingList(true);
    try {
      if (!await isOnline()) {
        const error = 'You’re offline. Connect to the internet to refresh Time Off.';
        store.setListError(error);
        return { ok: false as const, error };
      }
      const response = await listMyTimeOffRequests(accessToken);
      if (identityRef.current !== requestIdentity) return { ok: false as const, stale: true as const };
      store.setRequests(response.items ?? []);
      return { ok: true as const, requests: response.items ?? [] };
    } catch (error) {
      if (identityRef.current !== requestIdentity) return { ok: false as const, stale: true as const };
      const message = toUserFacingError(error, 'Could not load time-off requests. Please try again.');
      store.setListError(message);
      return { ok: false as const, error: message };
    } finally {
      endRequest('time-off:list');
      setLoadingList(false);
    }
  }, [accessToken, authIdentity, store.setListError, store.setRequests]);

  const loadDetail = useCallback(async (requestId: string) => {
    if (!authIdentity) return { ok: false as const, error: 'Please log in to view this request.' };
    const key = `time-off:detail:${requestId}`;
    if (!beginRequest(key)) return { ok: false as const, error: 'This request is already loading.' };
    const requestIdentity = authIdentity;
    setLoadingDetail(true);
    try {
      if (!await isOnline()) return { ok: false as const, error: 'You’re offline. Connect to the internet to refresh this request.' };
      const response = await getMyTimeOffRequest(requestId, accessToken);
      if (identityRef.current !== requestIdentity) return { ok: false as const, stale: true as const };
      store.upsertRequest(response.request);
      return { ok: true as const, request: response.request };
    } catch (error) {
      if (identityRef.current !== requestIdentity) return { ok: false as const, stale: true as const };
      return { ok: false as const, error: toUserFacingError(error, 'Could not load this time-off request.') };
    } finally {
      endRequest(key);
      setLoadingDetail(false);
    }
  }, [accessToken, authIdentity, store.upsertRequest]);

  const create = useCallback(async (draft: TimeOffDraft) => {
    if (!authIdentity) return { ok: false as const, error: 'Please log in to request Time Off.' };
    if (!beginRequest('time-off:create')) return { ok: false as const, error: 'This request is already being submitted.' };
    const requestIdentity = authIdentity;
    const nextFingerprint = fingerprint(draft);
    const attempt = store.submissionAttempt?.fingerprint === nextFingerprint
      ? store.submissionAttempt
      : { fingerprint: nextFingerprint, idempotencyKey: createRequestMeta('time-off').idempotencyKey };
    store.setSubmissionAttempt(attempt);
    setSubmitting(true);
    try {
      if (!await isOnline()) {
        return { ok: false as const, error: 'You’re offline. Connect to the internet to submit this request.' };
      }
      const response = await createMyTimeOffRequest({
        requestType: draft.requestType,
        startDate: draft.startDate,
        endDate: draft.endDate,
        employeeNote: draft.employeeNote.trim(),
        idempotencyKey: attempt.idempotencyKey,
      }, accessToken);
      if (identityRef.current !== requestIdentity) return { ok: false as const, stale: true as const };
      store.upsertRequest(response.request);
      store.setDraft({ requestType: 'vacation', startDate: '', endDate: '', employeeNote: '' });
      store.setSubmissionAttempt(null);
      let warning = response.warnings?.[0];
      try {
        const refreshed = await listMyTimeOffRequests(accessToken);
        if (identityRef.current === requestIdentity) store.setRequests(refreshed.items ?? []);
      } catch {
        warning = warning ?? 'Request submitted. The list could not be refreshed.';
      }
      store.setFlashMessage(warning ?? 'Time-off request submitted.');
      return { ok: true as const, request: response.request, warning };
    } catch (error) {
      if (identityRef.current !== requestIdentity) return { ok: false as const, stale: true as const };
      if (error instanceof ApiError
        && (error.code === 'time_off_idempotency_conflict' || error.message === 'time_off_idempotency_conflict')) {
        return { ok: false as const, error: 'This submission key was already used for different time-off details. Review the form before trying again.', conflict: true as const };
      }
      if (isUncertain(error)) {
        return { ok: false as const, error: 'Submission could not be confirmed. Your request is still here; retry to check using the same submission key.', uncertain: true as const };
      }
      return { ok: false as const, error: toUserFacingError(error, 'Could not submit this time-off request.') };
    } finally {
      endRequest('time-off:create');
      setSubmitting(false);
    }
  }, [accessToken, authIdentity, store]);

  const cancel = useCallback(async (requestId: string) => {
    if (!authIdentity) return { ok: false as const, error: 'Please log in to cancel this request.' };
    const key = `time-off:cancel:${requestId}`;
    if (!beginRequest(key)) return { ok: false as const, error: 'Cancellation is already in progress.' };
    const requestIdentity = authIdentity;
    setCancellingId(requestId);
    try {
      if (!await isOnline()) return { ok: false as const, error: 'You’re offline. Connect to the internet to cancel this request.' };
      const response = await cancelMyTimeOffRequest(requestId, accessToken);
      if (identityRef.current !== requestIdentity) return { ok: false as const, stale: true as const };
      store.upsertRequest(response.request);
      store.setFlashMessage('Time-off request cancelled.');
      return { ok: true as const, request: response.request };
    } catch (error) {
      if (identityRef.current !== requestIdentity) return { ok: false as const, stale: true as const };
      const authoritative = authoritativeRequest(error);
      if (authoritative) {
        store.upsertRequest(authoritative);
        return { ok: false as const, statusChanged: true as const, request: authoritative, error: `This request changed and is now ${authoritative.status}.` };
      }
      return { ok: false as const, error: toUserFacingError(error, 'Could not cancel this time-off request.') };
    } finally {
      endRequest(key);
      setCancellingId(null);
    }
  }, [accessToken, authIdentity, store.setFlashMessage, store.upsertRequest]);

  return { refresh, loadDetail, create, cancel, loadingList, loadingDetail, submitting, cancellingId };
}
