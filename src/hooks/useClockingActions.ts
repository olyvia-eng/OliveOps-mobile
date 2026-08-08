import { useMemo, useState } from 'react';
import * as clockingApi from '@/api/clockingApi';
import { scopeJobsForSession, scopeTimeEntriesForSession } from '@/features/clocking/scoping';
import { beginRequest, createRequestMeta, endRequest } from '@/services/requestGuards';
import { isOnline } from '@/services/connectivity';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import type { TimeEntryWorkType } from '@/types/domain';

export function useClockingActions() {
  const { accessToken, user, syncCapabilities } = useAuthStore();
  const {
    upsertTimeEntry,
    setActiveShiftWarnings,
    setActivityConfigs,
    setCurrentActiveEntryId,
    setJobs,
    setTimeCorrections,
    setTimeEntries,
  } = useClockingStore();
  const [loading, setLoading] = useState(false);

  async function syncWorkContextFromBootstrap() {
    if (!user) return;

    const payload = await clockingApi.loadBootstrap(accessToken);
    setJobs(scopeJobsForSession(payload.jobs ?? [], user));
    setTimeEntries(scopeTimeEntriesForSession(payload.timeEntries ?? [], user));
    setTimeCorrections(payload.timeCorrections ?? []);
    setCurrentActiveEntryId(payload.currentActiveEntryId ?? null);
    setActiveShiftWarnings(payload.activeShiftWarnings);
    setActivityConfigs(payload.activityConfigs);
    if (payload.capabilities) {
      syncCapabilities(payload.capabilities);
    }
  }

  const actions = useMemo(() => ({
    async clockIn(
      employeeId: string,
      workType: TimeEntryWorkType,
      jobIds: string[],
      unbillableCategoryId?: string,
      requestMeta?: { requestId: string; idempotencyKey: string }
    ) {
      const key = `clock-in:${employeeId}`;
      if (!beginRequest(key)) {
        return { ok: false, error: 'Clock-in already in progress.' };
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
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Clock-in failed.',
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
      const key = `clock-out:${entryId}`;
      if (!beginRequest(key)) {
        return { ok: false, error: 'Clock-out already in progress.' };
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
            await syncWorkContextFromBootstrap();
          } catch {
            // Preserve successful clock-out even if refresh fails.
          }
        }

        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Clock-out failed.',
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

      const key = `switch-activity:${employeeId}`;
      if (!beginRequest(key)) {
        return { ok: false, error: 'Switch activity already in progress.' };
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
          await syncWorkContextFromBootstrap();
        } catch {
          // Preserve successful switch even if refresh fails.
        }
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Switch activity failed.',
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
          error: error instanceof Error ? error.message : 'Could not refresh work context.',
        };
      }
    },
  }), [
    accessToken,
    setActivityConfigs,
    setActiveShiftWarnings,
    setCurrentActiveEntryId,
    setJobs,
    setTimeCorrections,
    setTimeEntries,
    syncCapabilities,
    upsertTimeEntry,
    user,
  ]);

  return {
    ...actions,
    loading,
  };
}
