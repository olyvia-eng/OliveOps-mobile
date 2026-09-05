import { useCallback, useRef } from 'react';
import { loadMyTraining, loadMyTrainingHistory } from '@/api/trainingApi';
import { isOnline } from '@/services/connectivity';
import { useAuthStore } from '@/store/authStore';
import { useTrainingStore } from '@/store/trainingStore';

export function useTrainingActions() {
  const { accessToken, status, user } = useAuthStore();
  const { loadedAt, setAssignments, setCompletions, setError, setLoading } = useTrainingStore();
  const identity = status === 'authenticated' && user
    ? `${user.businessId}:${user.id}:${user.employeeId ?? ''}:${accessToken ?? ''}`
    : '';
  const identityRef = useRef(identity);
  identityRef.current = identity;

  const refreshAssignments = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    if (!identity) return { ok: false as const, error: 'Please log in to view Training.' };
    setLoading(true);
    try {
      if (!await isOnline()) {
        const message = loadedAt
          ? 'Offline. Showing previously loaded Training information.'
          : 'Offline. Training information could not be loaded.';
        setError(message);
        return { ok: false as const, offline: true as const, error: message };
      }
      const requestIdentity = identity;
      const response = await loadMyTraining(accessToken, { force });
      if (identityRef.current !== requestIdentity) return { ok: false as const, stale: true as const };
      setAssignments(response.assignments ?? []);
      return { ok: true as const, assignments: response.assignments ?? [] };
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Training could not be loaded.';
      setError(message);
      return { ok: false as const, error: message };
    } finally {
      setLoading(false);
    }
  }, [accessToken, identity, loadedAt, setAssignments, setError, setLoading]);

  const refreshHistory = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    if (!identity) return { ok: false as const, error: 'Please log in to view Training.' };
    try {
      if (!await isOnline()) return { ok: false as const, offline: true as const };
      const requestIdentity = identity;
      const response = await loadMyTrainingHistory(accessToken, { force });
      if (identityRef.current !== requestIdentity) return { ok: false as const, stale: true as const };
      setCompletions(response.completions ?? []);
      return { ok: true as const, completions: response.completions ?? [] };
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Training history could not be loaded.';
      setError(message);
      return { ok: false as const, error: message };
    }
  }, [accessToken, identity, setCompletions, setError]);

  return { refreshAssignments, refreshHistory };
}