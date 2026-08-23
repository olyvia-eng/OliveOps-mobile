import { useMemo } from 'react';
import { getCurrentShiftSegments, resolveCurrentActiveEntry } from '@/features/clocking/presentation';
import { buildEffectiveClockState } from '@/features/offlineClocking/model';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { useOptionalOfflineClockStore } from '@/store/offlineClockContext';

export function useEffectiveClockState() {
  const { user } = useAuthStore();
  const { currentActiveEntryId, timeEntries } = useClockingStore();
  const offlineClock = useOptionalOfflineClockStore();

  const serverActiveEntry = useMemo(
    () => resolveCurrentActiveEntry(timeEntries, user?.employeeId, currentActiveEntryId),
    [currentActiveEntryId, timeEntries, user?.employeeId],
  );
  const serverShiftStartedAt = useMemo(
    () => getCurrentShiftSegments(timeEntries, user?.employeeId, currentActiveEntryId)[0]?.clockIn,
    [currentActiveEntryId, timeEntries, user?.employeeId],
  );
  const serverState = useMemo(
    () => buildEffectiveClockState(serverActiveEntry, [], serverShiftStartedAt),
    [serverActiveEntry, serverShiftStartedAt],
  );

  if (offlineClock?.hydrated) {
    return {
      ...offlineClock.effectiveState,
      timeEntries: offlineClock.effectiveTimeEntries,
      hydrated: true,
    };
  }

  return {
    ...serverState,
    timeEntries,
    hydrated: false,
  };
}