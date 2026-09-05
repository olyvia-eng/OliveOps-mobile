import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { getBootstrapTrainingAttention } from '@/features/training/attention';
import type { BootstrapResponse } from '@/types/api';
import type { TrainingAssignment, TrainingCompletion } from '@/types/training';

type TrainingState = {
  assignments: TrainingAssignment[];
  completions: TrainingCompletion[];
  overdueCount: number;
  dueSoonCount: number;
  loadedAt: number | null;
  loading: boolean;
  error: string | null;
  setAttentionFromBootstrap: (payload: BootstrapResponse) => void;
  setAssignments: (assignments: TrainingAssignment[]) => void;
  setCompletions: (completions: TrainingCompletion[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
};

const TrainingContext = createContext<TrainingState | undefined>(undefined);

export function TrainingProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuthStore();
  const [assignments, setAssignmentsState] = useState<TrainingAssignment[]>([]);
  const [completions, setCompletions] = useState<TrainingCompletion[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [dueSoonCount, setDueSoonCount] = useState(0);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const identityRef = useRef<string | null>(null);

  const setAttentionFromBootstrap = useCallback((payload: BootstrapResponse) => {
    const counts = getBootstrapTrainingAttention(payload);
    if (!counts) return;
    setOverdueCount(counts.overdueCount);
    setDueSoonCount(counts.dueSoonCount);
  }, []);

  const setAssignments = useCallback((items: TrainingAssignment[]) => {
    setAssignmentsState(items);
    setOverdueCount(items.filter((item) => item.presentationStatus === 'overdue').length);
    setDueSoonCount(items.filter((item) => item.presentationStatus === 'due_soon').length);
    setLoadedAt(Date.now());
    setError(null);
  }, []);

  useEffect(() => {
    const identity = status === 'authenticated' && user ? `${user.businessId}:${user.id}` : null;
    if (identityRef.current === identity) return;
    identityRef.current = identity;
    setAssignmentsState([]);
    setCompletions([]);
    setOverdueCount(0);
    setDueSoonCount(0);
    setLoadedAt(null);
    setLoading(false);
    setError(null);
  }, [status, user]);

  const value = useMemo<TrainingState>(() => ({
    assignments,
    completions,
    overdueCount,
    dueSoonCount,
    loadedAt,
    loading,
    error,
    setAttentionFromBootstrap,
    setAssignments,
    setCompletions,
    setLoading,
    setError,
  }), [assignments, completions, dueSoonCount, error, loadedAt, loading, overdueCount, setAssignments, setAttentionFromBootstrap]);

  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>;
}

export function useTrainingStore() {
  const value = useContext(TrainingContext);
  if (!value) throw new Error('useTrainingStore must be used inside TrainingProvider');
  return value;
}

export function useOptionalTrainingStore() {
  return useContext(TrainingContext);
}