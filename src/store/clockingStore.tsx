import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import type { ActivityConfig } from '@/types/api';
import type { Job, TimeCorrectionRequest, TimeEntry, UnbillableCategory } from '@/types/domain';
import { DEFAULT_BUSINESS_TIME_ZONE, normalizeBusinessTimeZone } from '@/utils/businessTime';
import {
  DEFAULT_CLOCKING_CAPABILITIES,
  type ClockingCapabilities,
  normalizeClockingCapabilities,
} from '@/features/clocking/capabilities';

export type ActiveShiftWarnings = {
  possibleForgottenClockOut: boolean;
  thresholdHours: number;
};

type ClockingState = {
  businessTimeZone: string;
  clockingCapabilities: ClockingCapabilities;
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
  setBusinessTimeZone: (timeZone?: string | null) => void;
  setClockingCapabilities: (capabilities?: Partial<ClockingCapabilities> | null) => void;
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
  resetClockingState: () => void;
};

const ClockingContext = createContext<ClockingState | undefined>(undefined);

export function ClockingProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuthStore();
  const [businessTimeZone, setBusinessTimeZoneState] = useState(DEFAULT_BUSINESS_TIME_ZONE);
  const [clockingCapabilities, setClockingCapabilitiesState] = useState(DEFAULT_CLOCKING_CAPABILITIES);
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
  const previousIdentityRef = useRef<string | null>(null);

  const setActiveShiftWarnings = useCallback((next?: Partial<ActiveShiftWarnings>) => {
    setActiveShiftWarningsState({
      possibleForgottenClockOut: next?.possibleForgottenClockOut === true,
      thresholdHours: Number.isFinite(next?.thresholdHours) ? Math.max(1, Number(next?.thresholdHours)) : 12,
    });
  }, []);

  const setBusinessTimeZone = useCallback((timeZone?: string | null) => {
    setBusinessTimeZoneState(normalizeBusinessTimeZone(timeZone));
  }, []);

  const setClockingCapabilities = useCallback((capabilities?: Partial<ClockingCapabilities> | null) => {
    setClockingCapabilitiesState(normalizeClockingCapabilities(capabilities));
  }, []);

  const upsertTimeEntry = useCallback((entry: TimeEntry) => {
    setTimeEntries((current) => {
      const exists = current.some((item) => item.id === entry.id);
      if (exists) {
        return current.map((item) => (item.id === entry.id ? entry : item));
      }
      return [entry, ...current];
    });
  }, []);

  const setUnbillableCategories = useCallback((items: UnbillableCategory[], businessId: string) => {
    setUnbillableCategoriesState(items);
    setUnbillableCategoriesBusinessId(businessId);
    setUnbillableCategoriesLoadedAt(Date.now());
    setUnbillableCategoriesError(null);
  }, []);

  const resetUnbillableCategories = useCallback(() => {
    setUnbillableCategoriesState([]);
    setUnbillableCategoriesLoading(false);
    setUnbillableCategoriesError(null);
    setUnbillableCategoriesLoadedAt(null);
    setUnbillableCategoriesBusinessId(null);
  }, []);

  const resetClockingState = useCallback(() => {
    setBusinessTimeZoneState(DEFAULT_BUSINESS_TIME_ZONE);
    setClockingCapabilitiesState(DEFAULT_CLOCKING_CAPABILITIES);
    setJobs([]);
    setTimeEntries([]);
    setTimeCorrections([]);
    setUnbillableCategoriesState([]);
    setUnbillableCategoriesLoading(false);
    setUnbillableCategoriesError(null);
    setUnbillableCategoriesLoadedAt(null);
    setUnbillableCategoriesBusinessId(null);
    setCurrentActiveEntryId(null);
    setActiveShiftWarningsState({
      possibleForgottenClockOut: false,
      thresholdHours: 12,
    });
    setActivityConfigs(undefined);
  }, []);

  useEffect(() => {
    const nextIdentity = status === 'authenticated' && user
      ? `${user.businessId}:${user.id}:${user.employeeId ?? ''}`
      : null;

    if (previousIdentityRef.current !== nextIdentity) {
      resetClockingState();
      previousIdentityRef.current = nextIdentity;
    }
  }, [resetClockingState, status, user]);

  const value = useMemo<ClockingState>(
    () => ({
      businessTimeZone,
      clockingCapabilities,
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
      setBusinessTimeZone,
      setClockingCapabilities,
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
      resetClockingState,
    }),
    [
      activeShiftWarnings,
      activityConfigs,
      businessTimeZone,
      clockingCapabilities,
      currentActiveEntryId,
      jobs,
      resetClockingState,
      resetUnbillableCategories,
      setActiveShiftWarnings,
      setBusinessTimeZone,
      setClockingCapabilities,
      setUnbillableCategories,
      timeCorrections,
      timeEntries,
      unbillableCategories,
      unbillableCategoriesBusinessId,
      unbillableCategoriesError,
      unbillableCategoriesLoadedAt,
      unbillableCategoriesLoading,
      upsertTimeEntry,
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
