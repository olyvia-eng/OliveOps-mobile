import React, { createContext, useContext, useMemo, useState } from 'react';
import type { ActivityConfig } from '@/types/api';
import type { Job, TimeCorrectionRequest, TimeEntry, UnbillableCategory } from '@/types/domain';

export type ActiveShiftWarnings = {
  possibleForgottenClockOut: boolean;
  thresholdHours: number;
};

type ClockingState = {
  jobs: Job[];
  timeEntries: TimeEntry[];
  timeCorrections: TimeCorrectionRequest[];
  unbillableCategories: UnbillableCategory[];
  unbillableCategoriesLoading: boolean;
  unbillableCategoriesError: string | null;
  unbillableCategoriesLoadedAt: number | null;
  unbillableCategoriesBusinessId: string | null;
  currentActiveEntryId: string | null;
  activeShiftWarnings: ActiveShiftWarnings;
  activityConfigs?: ActivityConfig[];
  setJobs: (jobs: Job[]) => void;
  setTimeEntries: (entries: TimeEntry[]) => void;
  setTimeCorrections: (items: TimeCorrectionRequest[]) => void;
  setUnbillableCategories: (items: UnbillableCategory[], businessId: string) => void;
  setUnbillableCategoriesLoading: (loading: boolean) => void;
  setUnbillableCategoriesError: (error: string | null) => void;
  resetUnbillableCategories: () => void;
  setCurrentActiveEntryId: (entryId: string | null) => void;
  setActiveShiftWarnings: (warnings?: Partial<ActiveShiftWarnings>) => void;
  setActivityConfigs: (configs?: ActivityConfig[]) => void;
  upsertTimeEntry: (entry: TimeEntry) => void;
};

const ClockingContext = createContext<ClockingState | undefined>(undefined);

export function ClockingProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [timeCorrections, setTimeCorrections] = useState<TimeCorrectionRequest[]>([]);
  const [unbillableCategories, setUnbillableCategoriesState] = useState<UnbillableCategory[]>([]);
  const [unbillableCategoriesLoading, setUnbillableCategoriesLoading] = useState(false);
  const [unbillableCategoriesError, setUnbillableCategoriesError] = useState<string | null>(null);
  const [unbillableCategoriesLoadedAt, setUnbillableCategoriesLoadedAt] = useState<number | null>(null);
  const [unbillableCategoriesBusinessId, setUnbillableCategoriesBusinessId] = useState<string | null>(null);
  const [currentActiveEntryId, setCurrentActiveEntryId] = useState<string | null>(null);
  const [activeShiftWarnings, setActiveShiftWarningsState] = useState<ActiveShiftWarnings>({
    possibleForgottenClockOut: false,
    thresholdHours: 12,
  });
  const [activityConfigs, setActivityConfigs] = useState<ActivityConfig[] | undefined>(undefined);

  function setActiveShiftWarnings(next?: Partial<ActiveShiftWarnings>) {
    setActiveShiftWarningsState({
      possibleForgottenClockOut: next?.possibleForgottenClockOut === true,
      thresholdHours: Number.isFinite(next?.thresholdHours) ? Math.max(1, Number(next?.thresholdHours)) : 12,
    });
  }

  function upsertTimeEntry(entry: TimeEntry) {
    setTimeEntries((current) => {
      const exists = current.some((item) => item.id === entry.id);
      if (exists) {
        return current.map((item) => (item.id === entry.id ? entry : item));
      }
      return [entry, ...current];
    });
  }

  function setUnbillableCategories(items: UnbillableCategory[], businessId: string) {
    setUnbillableCategoriesState(items);
    setUnbillableCategoriesBusinessId(businessId);
    setUnbillableCategoriesLoadedAt(Date.now());
    setUnbillableCategoriesError(null);
  }

  function resetUnbillableCategories() {
    setUnbillableCategoriesState([]);
    setUnbillableCategoriesLoading(false);
    setUnbillableCategoriesError(null);
    setUnbillableCategoriesLoadedAt(null);
    setUnbillableCategoriesBusinessId(null);
  }

  const value = useMemo<ClockingState>(
    () => ({
      jobs,
      timeEntries,
      timeCorrections,
      unbillableCategories,
      unbillableCategoriesLoading,
      unbillableCategoriesError,
      unbillableCategoriesLoadedAt,
      unbillableCategoriesBusinessId,
      currentActiveEntryId,
      activeShiftWarnings,
      activityConfigs,
      setJobs,
      setTimeEntries,
      setTimeCorrections,
      setUnbillableCategories,
      setUnbillableCategoriesLoading,
      setUnbillableCategoriesError,
      resetUnbillableCategories,
      setCurrentActiveEntryId,
      setActiveShiftWarnings,
      setActivityConfigs,
      upsertTimeEntry,
    }),
    [
      activeShiftWarnings,
      activityConfigs,
      currentActiveEntryId,
      jobs,
      timeCorrections,
      timeEntries,
      unbillableCategories,
      unbillableCategoriesBusinessId,
      unbillableCategoriesError,
      unbillableCategoriesLoadedAt,
      unbillableCategoriesLoading,
    ]
  );

  return <ClockingContext.Provider value={value}>{children}</ClockingContext.Provider>;
}

export function useClockingStore() {
  const ctx = useContext(ClockingContext);
  if (!ctx) {
    throw new Error('useClockingStore must be used inside ClockingProvider');
  }
  return ctx;
}
