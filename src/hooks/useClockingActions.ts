import { useMemo, useRef, useState } from 'react';
import * as clockingApi from '@/api/clockingApi';
import { scopeJobsForSession, scopeTimeEntriesForSession } from '@/features/clocking/scoping';
import { beginRequest, createRequestMeta, endRequest } from '@/services/requestGuards';
import { isOnline } from '@/services/connectivity';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import type { TimeEntryWorkType } from '@/types/domain';
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

    setJobs(scopeJobsForSession(payload.jobs ?? [], user));
    setBusinessTimeZone(payload.timezone);
    setTimeEntries(scopeTimeEntriesForSession(payload.timeEntries ?? [], user));
    setTimeCorrections(payload.timeCorrections ?? []);
    setCurrentActiveEntryId(payload.currentActiveEntryId ?? null);
    setActiveShiftWarnings(payload.activeShiftWarnings);
    setActivityConfigs(payload.activityConfigs);
  }

  const actions = useMemo(() => ({
    async clockIn(
      employeeId: string,
      workType: TimeEntryWorkType,
      jobIds: string[],
      unbillableCategoryId?: string,
      requestMeta?: { requestId: string; idempotencyKey: string }
    ) {
      const key = `clocking:${employeeId}`;
      if (!beginRequest(key)) {
        return { ok: false, error: 'Another clocking action is already in progress.' };
      }

      setLoading(true);
      try {
        const online = await isOnline();
        if (!online) {
          return { ok: false, error: 'Offline. Reconnect and retry clock-in.' };
        }

        const meta = requestMeta ?? createRequestMeta(employeeId);
        const result = await clockingApi.clockIn({
          employeeId,
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
          // Preserve successful clock-in even if reconciliation fails.
        }
        return { ok: true };
      } catch (error) {
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

        const meta = requestMeta ?? createRequestMeta(entryId);
        const normalizedPhotoAttachmentFileIds = Array.isArray(photoAttachmentFileIds)
          ? [...new Set(photoAttachmentFileIds.filter((value) => typeof value === 'string').map((value) => value.trim()).filter(Boolean))]
          : [];
        const result = await clockingApi.clockOut({
          entryId,
          breakMinutes: 0,
          notes,
          photoAttachmentFileIds: normalizedPhotoAttachmentFileIds.length > 0 ? normalizedPhotoAttachmentFileIds : undefined,
          photoAttachmentFileId: normalizedPhotoAttachmentFileIds[0],
          ...meta,
        }, accessToken);

        if (result.timeEntry) {
          upsertTimeEntry(result.timeEntry);
          setCurrentActiveEntryId(null);
          try {
            await syncWorkContextFromBootstrap(true);
          } catch {
            // Preserve successful clock-out even if refresh fails.
          }
        }

        return { ok: true };
      } catch (error) {
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

        const meta = requestMeta ?? createRequestMeta(employeeId);
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

        await syncWorkContextFromBootstrap();
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
    upsertTimeEntry,
    user,
  ]);

  return {
    ...actions,
    loading,
  };
}
