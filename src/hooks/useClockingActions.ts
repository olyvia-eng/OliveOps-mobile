import { useMemo, useState } from 'react';
import * as clockingApi from '@/api/clockingApi';
import { beginRequest, createRequestMeta, endRequest } from '@/services/requestGuards';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';

export function useClockingActions() {
  const { accessToken, user } = useAuthStore();
  const { upsertTimeEntry, setJobs, setTimeEntries } = useClockingStore();
  const [loading, setLoading] = useState(false);

  const actions = useMemo(() => ({
    async clockIn(employeeId: string, jobIds: string[]) {
      const key = `clock-in:${employeeId}`;
      if (!beginRequest(key)) {
        return { ok: false, error: 'Clock-in already in progress.' };
      }

      setLoading(true);
      try {
        const meta = createRequestMeta(employeeId);
        const result = await clockingApi.clockIn({
          employeeId,
          workType: 'job',
          jobIds,
          ...meta,
        }, accessToken);

        upsertTimeEntry(result.timeEntry);
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

    async clockOut(entryId: string, notes: string, photoAttachmentFileId?: string) {
      const key = `clock-out:${entryId}`;
      if (!beginRequest(key)) {
        return { ok: false, error: 'Clock-out already in progress.' };
      }

      setLoading(true);
      try {
        const meta = createRequestMeta(entryId);
        const result = await clockingApi.clockOut({
          entryId,
          breakMinutes: 0,
          notes,
          photoAttachmentFileId,
          ...meta,
        }, accessToken);

        if (result.timeEntry) {
          upsertTimeEntry(result.timeEntry);
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

    async refreshWorkContext() {
      if (!user) return { ok: false, error: 'No active user session.' };
      try {
        const payload = await clockingApi.loadBootstrap(accessToken);
        setJobs(payload.jobs ?? []);
        setTimeEntries(payload.timeEntries ?? []);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Could not refresh work context.',
        };
      }
    },
  }), [accessToken, setJobs, setTimeEntries, upsertTimeEntry, user]);

  return {
    ...actions,
    loading,
  };
}
