import React, { createContext, useContext, useMemo, useState } from 'react';
import type { ActivityConfig } from '@/types/api';
import type { Job, TimeEntry } from '@/types/domain';

type ClockingState = {
  jobs: Job[];
  timeEntries: TimeEntry[];
  currentActiveEntryId: string | null;
  activityConfigs?: ActivityConfig[];
  setJobs: (jobs: Job[]) => void;
  setTimeEntries: (entries: TimeEntry[]) => void;
  setCurrentActiveEntryId: (entryId: string | null) => void;
  setActivityConfigs: (configs?: ActivityConfig[]) => void;
  upsertTimeEntry: (entry: TimeEntry) => void;
};

const ClockingContext = createContext<ClockingState | undefined>(undefined);

export function ClockingProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [currentActiveEntryId, setCurrentActiveEntryId] = useState<string | null>(null);
  const [activityConfigs, setActivityConfigs] = useState<ActivityConfig[] | undefined>(undefined);

  function upsertTimeEntry(entry: TimeEntry) {
    setTimeEntries((current) => {
      const exists = current.some((item) => item.id === entry.id);
      if (exists) {
        return current.map((item) => (item.id === entry.id ? entry : item));
      }
      return [entry, ...current];
    });
  }

  const value = useMemo<ClockingState>(
    () => ({
      jobs,
      timeEntries,
      currentActiveEntryId,
      activityConfigs,
      setJobs,
      setTimeEntries,
      setCurrentActiveEntryId,
      setActivityConfigs,
      upsertTimeEntry,
    }),
    [activityConfigs, currentActiveEntryId, jobs, timeEntries]
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
