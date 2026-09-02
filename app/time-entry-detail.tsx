import { useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { EmptyState, InfoRow, ScreenHeader, SectionCard, StatusBadge } from '@/components/MobilePrimitives';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import {
  buildEffectiveTimeEntries,
  formatDurationForEntry,
  formatEntryTimeRange,
  getWorkTypeLabel,
  isAuthoritativeActiveEntry,
  resolveEntryPrimaryLabel,
  resolveWorkAreaName,
} from '@/features/clocking/presentation';
import { useEffectiveClockState } from '@/hooks/useEffectiveClockState';
import { useClockingStore } from '@/store/clockingStore';

export default function TimeEntryDetailScreen() {
  const { timeEntryId } = useLocalSearchParams<{ timeEntryId?: string }>();
  const { businessTimeZone, jobs, timeCorrections } = useClockingStore();
  const effectiveClock = useEffectiveClockState();
  const entry = useMemo(() => buildEffectiveTimeEntries(
    effectiveClock.timeEntries,
    timeCorrections,
  ).find((item) => item.id === timeEntryId) ?? null, [effectiveClock.timeEntries, timeCorrections, timeEntryId]);

  if (!entry) {
    return (
      <Screen>
        <ScreenHeader title="Time Entry Detail" />
        <EmptyState title="Time entry unavailable" message="This entry may have changed. Return to Time History and try again." />
      </Screen>
    );
  }

  const active = isAuthoritativeActiveEntry(entry.id, effectiveClock.effectiveActiveEntryId);
  return (
    <Screen>
      <ScreenHeader
        title="Time Entry Detail"
        subtitle={formatEntryTimeRange(entry, active, businessTimeZone)}
        action={active ? <StatusBadge label="Active" tone="active" /> : undefined}
      />
      <SectionCard>
        <InfoRow label="Activity" value={getWorkTypeLabel(entry.workType)} emphasis />
        {entry.workType !== 'drive_time' ? <InfoRow label={entry.workType === 'job' ? 'Job' : 'Category'} value={resolveEntryPrimaryLabel(entry, jobs)} /> : null}
        {resolveWorkAreaName(entry) ? <InfoRow label="Work Area" value={resolveWorkAreaName(entry)!} /> : null}
        <InfoRow label="Duration" value={formatDurationForEntry(entry)} />
        {entry.notes ? <InfoRow label="Notes" value={entry.notes} /> : null}
      </SectionCard>
      <PrimaryActionButton
        label="Request Correction"
        onPress={() => router.push({
          pathname: '/request-time-correction',
          params: {
            timeEntryId: entry.id,
            requestType: entry.clockOut ? 'wrong_time' : 'forgot_clock_out',
          },
        })}
      />
    </Screen>
  );
}