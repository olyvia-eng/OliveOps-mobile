import { useMemo, useRef, useState } from 'react';
import * as clockingApi from '@/api/clockingApi';
import { scopeJobsForSession, scopeTimeEntriesForSession } from '@/features/clocking/scoping';
import { beginRequest, createRequestMeta, endRequest } from '@/services/requestGuards';
import { isOnline } from '@/services/connectivity';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { useOptionalOfflineClockStore } from '@/store/offlineClockContext';
import type { TimeEntryWorkType } from '@/types/domain';
import { ApiError } from '@/types/errors';
import { toUserFacingError } from '@/utils/userFacingError';

export function useClockingActions() {
  const { accessToken, status, user } = useAuthStore();
  const {
    upsertTimeEntry,
    setActiveShiftWarnings,
    setActivityConfigs,
    setBusinessTimeZone,
    setCurrentActiveEntryId,
    setJobs,
    setTimeCorrections,
    setTimeEntries,
  } = useClockingStore();
  const offlineClock = useOptionalOfflineClockStore();
  const submitOfflineClockIn = offlineClock?.submitClockIn;
  const submitOfflineClockOut = offlineClock?.submitClockOut;
  const submitOfflineSwitchActivity = offlineClock?.submitSwitchActivity;
  const updateEligibilityCache = offlineClock?.updateEligibilityCache;
  const requiredBeforeClockInForms = offlineClock?.cache?.requiredBeforeClockInForms;
  const [loading, setLoading] = useState(false);
  const authIdentity = status === 'authenticated' && user
    ? `${user.businessId}:${user.id}:${user.employeeId ?? ''}:${accessToken ?? ''}`
    : '';
  const currentAuthIdentityRef = useRef(authIdentity);
  const latestBootstrapGenerationRef = useRef(0);
  currentAuthIdentityRef.current = authIdentity;

  async function syncWorkContextFromBootstrap(force = false) {
    if (!user) return;

    const requestAuthIdentity = authIdentity;
    const generation = latestBootstrapGenerationRef.current + 1;
    latestBootstrapGenerationRef.current = generation;
    const payload = await clockingApi.loadBootstrap(accessToken, { force });
    if (
      currentAuthIdentityRef.current !== requestAuthIdentity
      || latestBootstrapGenerationRef.current !== generation
    ) {
      return;
    }

    const scopedJobs = scopeJobsForSession(payload.jobs ?? [], user);
    setJobs(scopedJobs);
    setBusinessTimeZone(payload.timezone);
    setTimeEntries(scopeTimeEntriesForSession(payload.timeEntries ?? [], user));
    setTimeCorrections(payload.timeCorrections ?? []);
    setCurrentActiveEntryId(payload.currentActiveEntryId ?? null);
    setActiveShiftWarnings(payload.activeShiftWarnings);
    setActivityConfigs(payload.activityConfigs);
    await updateEligibilityCache?.({
      jobs: scopedJobs,
      activityConfigs: payload.activityConfigs ?? [],
      requiredAfterClockOutForms: payload.capabilities
        ? payload.capabilities.requiredAfterClockOutForms === true
        : undefined,
      requiredBeforeClockInForms: payload.capabilities
        ? payload.capabilities.requiredBeforeClockInForms === true
        : undefined,
    });
  }

  const actions = useMemo(() => ({
    async clockIn(
      employeeId: string,
      workType: TimeEntryWorkType,
      jobIds: string[],
      unbillableCategoryId?: string,
      requestMeta?: { requestId: string; idempotencyKey: string }
    ) {
      const meta = requestMeta ?? createRequestMeta(employeeId);
      const online = await isOnline();
      if (!online && submitOfflineClockIn) {
        if (requiredBeforeClockInForms !== false) {
          return {
            ok: false as const,
            error: 'Connection required to clock in. A required pre-shift form may need to be completed. Reconnect to continue.',
          };
        }
        setLoading(true);
        try {
          return await submitOfflineClockIn({
            employeeId,
            workType,
            jobIds,
            unbillableCategoryId: typeof unbillableCategoryId === 'string' && unbillableCategoryId.trim()
              ? unbillableCategoryId.trim()
              : undefined,
          }, { ...meta, clientOccurredAt: new Date().toISOString() });
        } finally {
          setLoading(false);
        }
      }
      const key = `clocking:${employeeId}`;
      if (!beginRequest(key)) {
        return { ok: false, error: 'Another clocking action is already in progress.' };
      }

      setLoading(true);
      try {
        if (!online) {
          return { ok: false, error: 'Offline. Reconnect and retry clock-in.' };
        }

        const result = await clockingApi.clockIn({
          employeeId,
          workType,
          jobIds,
          unbillableCategoryId: typeof unbillableCategoryId === 'string' && unbillableCategoryId.trim()
            ? unbillableCategoryId.trim()
            : undefined,
          ...meta,
        }, accessToken);

        if (result.status === 'clock_in_pending_required_forms') {
          return { ok: true as const, pendingWorkflow: result };
        }

        upsertTimeEntry(result.timeEntry);
        setCurrentActiveEntryId(result.timeEntry.id);
        try {
          await syncWorkContextFromBootstrap(true);
        } catch {
          // Preserve successful clock-in even if reconciliation fails.
        }
        return { ok: true as const, reminderForms: result.reminderForms };
      } catch (error) {
        if (error instanceof ApiError && error.code?.toLowerCase() === 'pending_clock_in_exists') {
          try {
            const pendingWorkflow = await clockingApi.loadPendingClockIn(accessToken);
            if (pendingWorkflow.status === 'clock_in_pending_required_forms') {
              return { ok: true as const, pendingWorkflow };
            }
          } catch {
            // Fall through to the controlled clock-in error.
          }
        }
        if (error instanceof ApiError && [
          'pending_clock_out_exists',
          'clock_out_pending_required_forms',
          'pending_required_clock_out',
        ].includes(error.code?.toLowerCase() ?? '')) {
          try {
            const pendingClockOutWorkflow = await clockingApi.loadPendingClockOut(accessToken);
            if (pendingClockOutWorkflow.status === 'clock_out_pending_required_forms') {
              return { ok: true as const, pendingClockOutWorkflow };
            }
          } catch {
            // Fall through to the controlled clock-in error.
          }
        }
        return {
          ok: false,
          error: toUserFacingError(error, 'Clock-in failed. Please try again.'),
        };
      } finally {
        endRequest(key);
        setLoading(false);
      }
    },

    async clockOut(
      entryId: string,
      notes: string,
      photoAttachmentFileIds?: string[],
      requestMeta?: { requestId: string; idempotencyKey: string }
    ) {
      const meta = requestMeta ?? createRequestMeta(entryId);
      const normalizedPhotoAttachmentFileIds = Array.isArray(photoAttachmentFileIds)
        ? [...new Set(photoAttachmentFileIds.filter((value) => typeof value === 'string').map((value) => value.trim()).filter(Boolean))]
        : [];
      if (submitOfflineClockOut && normalizedPhotoAttachmentFileIds.length === 0) {
        const online = await isOnline();
        if (!online) {
          if (offlineClock?.cache?.requiredAfterClockOutForms !== false) {
            return {
              ok: false as const,
              error: 'Clock out requires a connection. Required forms for this clock-out are not available offline.',
            };
          }
          setLoading(true);
          try {
            return await submitOfflineClockOut({
              entryId: entryId.startsWith('local-clock:') ? undefined : entryId,
              breakMinutes: 0,
              notes,
            }, { ...meta, clientOccurredAt: new Date().toISOString() });
          } finally {
            setLoading(false);
          }
        }
      }
      const key = `clocking:${user?.employeeId ?? entryId}`;
      if (!beginRequest(key)) {
        return { ok: false, error: 'Another clocking action is already in progress.' };
      }

      setLoading(true);
      try {
        const online = await isOnline();
        if (!online) {
          return { ok: false, error: 'Offline. Reconnect and retry clock-out.' };
        }

        const result = await clockingApi.clockOut({
          entryId,
          breakMinutes: 0,
          notes,
          photoAttachmentFileIds: normalizedPhotoAttachmentFileIds.length > 0 ? normalizedPhotoAttachmentFileIds : undefined,
          photoAttachmentFileId: normalizedPhotoAttachmentFileIds[0],
          ...meta,
        }, accessToken);

        if (result.status === 'clock_out_pending_required_forms') {
          return { ok: true as const, pendingWorkflow: result };
        }

        if (result.timeEntry) {
          upsertTimeEntry(result.timeEntry);
          setCurrentActiveEntryId(null);
          try {
            await syncWorkContextFromBootstrap(true);
          } catch {
            // Preserve successful clock-out even if refresh fails.
          }
        }

        return { ok: true as const, reminderForms: result.reminderForms };
      } catch (error) {
        if (error instanceof ApiError && error.code?.toLowerCase() === 'pending_clock_out_exists') {
          try {
            const pending = await clockingApi.loadPendingClockOut(accessToken);
            if (pending.status === 'clock_out_pending_required_forms') {
              return { ok: true as const, pendingWorkflow: pending };
            }
          } catch {
            // Fall through to the normal safe clock-out error.
          }
        }
        return {
          ok: false,
          error: toUserFacingError(error, 'Clock-out failed. Please try again.'),
        };
      } finally {
        endRequest(key);
        setLoading(false);
      }
    },

    async switchActivity(
      workType: TimeEntryWorkType,
      jobIds: string[],
      unbillableCategoryId?: string,
      requestMeta?: { requestId: string; idempotencyKey: string }
    ) {
      const employeeId = user?.employeeId;
      if (!employeeId) {
        return { ok: false, error: 'Employee profile is not linked to this account.' };
      }

      const meta = requestMeta ?? createRequestMeta(employeeId);
      if (submitOfflineSwitchActivity) {
        setLoading(true);
        try {
          return await submitOfflineSwitchActivity({
            workType,
            jobIds,
            unbillableCategoryId: typeof unbillableCategoryId === 'string' && unbillableCategoryId.trim()
              ? unbillableCategoryId.trim()
              : undefined,
          }, { ...meta, clientOccurredAt: new Date().toISOString() });
        } finally {
          setLoading(false);
        }
      }
      const key = `clocking:${employeeId}`;
      if (!beginRequest(key)) {
        return { ok: false, error: 'Another clocking action is already in progress.' };
      }

      setLoading(true);
      try {
        const online = await isOnline();
        if (!online) {
          return { ok: false, error: 'Offline. Reconnect and retry switch activity.' };
        }

        const result = await clockingApi.switchActivity({
          workType,
          jobIds,
          unbillableCategoryId: typeof unbillableCategoryId === 'string' && unbillableCategoryId.trim()
            ? unbillableCategoryId.trim()
            : undefined,
          ...meta,
        }, accessToken);

        upsertTimeEntry(result.timeEntry);
        setCurrentActiveEntryId(result.timeEntry.id);
        try {
          await syncWorkContextFromBootstrap(true);
        } catch {
          // Preserve successful switch even if refresh fails.
        }
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: toUserFacingError(error, 'Switch activity failed. Please try again.'),
        };
      } finally {
        endRequest(key);
        setLoading(false);
      }
    },

    async refreshWorkContext() {
      if (!user) return { ok: false, error: 'No active user session.' };
      try {
        const online = await isOnline();
        if (!online) {
          return { ok: false, error: 'Offline. Reconnect to refresh jobs and shift status.' };
        }

        await syncWorkContextFromBootstrap(true);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: toUserFacingError(error, 'Could not refresh work context. Please try again.'),
        };
      }
    },
  }), [
    accessToken,
    authIdentity,
    setActivityConfigs,
    setActiveShiftWarnings,
    setBusinessTimeZone,
    setCurrentActiveEntryId,
    setJobs,
    setTimeCorrections,
    setTimeEntries,
    requiredBeforeClockInForms,
    submitOfflineClockIn,
    submitOfflineClockOut,
    submitOfflineSwitchActivity,
    upsertTimeEntry,
    updateEligibilityCache,
    user,
  ]);

  return {
    ...actions,
    loading,
  };
}
