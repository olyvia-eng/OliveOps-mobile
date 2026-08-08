import { useMemo, useState } from 'react';
import { createTimeCorrection, listEffectiveTimeEntries, listMyTimeCorrections } from '@/api/timeCorrectionsApi';
import { beginRequest, endRequest } from '@/services/requestGuards';
import { isOnline } from '@/services/connectivity';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import type { CreateTimeCorrectionRequest } from '@/types/api';
import { toUserFacingError } from '@/utils/userFacingError';

export function useTimeCorrectionActions() {
  const { accessToken } = useAuthStore();
  const { setTimeCorrections, setTimeEntries } = useClockingStore();
  const [loading, setLoading] = useState(false);

  const actions = useMemo(() => ({
    async submitCorrection(payload: CreateTimeCorrectionRequest) {
      const key = `time-correction:${payload.timeEntryId ?? payload.requestType}:${payload.requestedClockInAt ?? ''}:${payload.requestedClockOutAt ?? ''}`;
      if (!beginRequest(key)) {
        return { ok: false, error: 'Correction request already in progress.' };
      }

      setLoading(true);
      try {
        const online = await isOnline();
        if (!online) {
          return { ok: false, error: 'Offline. Reconnect and retry submitting correction request.' };
        }

        const result = await createTimeCorrection(payload, accessToken);
        const corrections = await listMyTimeCorrections(accessToken);
        setTimeCorrections(corrections.items ?? []);

        const effectiveEntries = await listEffectiveTimeEntries(accessToken);
        setTimeEntries(effectiveEntries.items ?? []);

        return { ok: true, correction: result.correction };
      } catch (error) {
        return {
          ok: false,
          error: toUserFacingError(error, 'Could not submit correction request. Please try again.'),
        };
      } finally {
        endRequest(key);
        setLoading(false);
      }
    },

    async refreshMyCorrections() {
      setLoading(true);
      try {
        const online = await isOnline();
        if (!online) {
          return { ok: false, error: 'Offline. Reconnect to refresh correction requests.' };
        }

        const corrections = await listMyTimeCorrections(accessToken);
        setTimeCorrections(corrections.items ?? []);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: toUserFacingError(error, 'Could not load correction requests. Please try again.'),
        };
      } finally {
        setLoading(false);
      }
    },
  }), [accessToken, setTimeCorrections, setTimeEntries]);

  return {
    ...actions,
    loading,
  };
}
