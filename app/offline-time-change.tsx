import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { SecondaryButton } from '@/components/SecondaryButton';
import { ScreenHeader, SectionHeader } from '@/components/MobilePrimitives';
import {
  getOfflineCommandActionLabel,
  getOfflineCommandReason,
  resolveOfflineCommandActivity,
} from '@/features/offlineClocking/presentation';
import { getWorkTypeLabel } from '@/features/clocking/presentation';
import { useEffectiveClockState } from '@/hooks/useEffectiveClockState';
import { useClockingStore } from '@/store/clockingStore';
import { useOptionalOfflineClockStore } from '@/store/offlineClockContext';
import { colors } from '@/theme/colors';
import { formatBusinessDate, formatBusinessTime } from '@/utils/businessTime';

export default function OfflineTimeChangeScreen() {
  const params = useLocalSearchParams<{ commandId?: string }>();
  const offlineClock = useOptionalOfflineClockStore();
  const effectiveClock = useEffectiveClockState();
  const { businessTimeZone, jobs } = useClockingStore();
  const command = offlineClock?.commands.find((item) => (
    item.status === 'needs_attention'
    && (typeof params.commandId !== 'string' || item.id === params.commandId)
  ));
  const availableJobs = jobs.length > 0 ? jobs : (offlineClock?.cache?.jobs ?? []);
  const activity = command
    ? resolveOfflineCommandActivity(command, offlineClock?.commands ?? [], effectiveClock.currentActivity)
    : null;
  const intendedAt = command ? new Date(command.clientOccurredAt) : null;
  const jobLabel = useMemo(() => {
    const jobId = activity?.jobIds?.[0];
    if (!jobId) return null;
    return availableJobs.find((job) => job.id === jobId)?.title ?? 'Assigned job';
  }, [activity?.jobIds, availableJobs]);
  const categoryLabel = useMemo(() => {
    if (!activity?.unbillableCategoryId) return null;
    return offlineClock?.cache?.unbillableCategories.find((item) => item.id === activity.unbillableCategoryId)?.name
      ?? 'Unbillable category';
  }, [activity?.unbillableCategoryId, offlineClock?.cache?.unbillableCategories]);

  if (!command || !intendedAt) {
    return (
      <Screen>
        <ScreenHeader title="Time Change Needs Attention" subtitle="Saved offline change" />
        <Text style={styles.reason}>This saved time change is no longer available on this device.</Text>
        <SecondaryButton label="Back" onPress={() => router.back()} />
      </Screen>
    );
  }

  const actionLabel = getOfflineCommandActionLabel(command.type);
  const requestType = command.type === 'clock_in'
    ? 'forgot_clock_in'
    : command.type === 'clock_out'
      ? 'forgot_clock_out'
      : 'wrong_activity';
  const serverEntryId = command.resolvedServerEntryId
    ?? (effectiveClock.activeEntry && !effectiveClock.activeEntry.id.startsWith('local-clock:')
      ? effectiveClock.activeEntry.id
      : undefined);

  return (
    <Screen>
      <ScreenHeader title="Time Change Needs Attention" subtitle={actionLabel} />

      <View style={styles.summary}>
        <Text style={styles.action}>{actionLabel}</Text>
        <Text style={styles.time}>
          {formatBusinessDate(intendedAt, businessTimeZone, { month: 'short', day: 'numeric', year: 'numeric' })}
          {' at '}
          {formatBusinessTime(intendedAt, businessTimeZone, { hour: 'numeric', minute: '2-digit' })}
        </Text>
        <Text style={styles.reason}>{getOfflineCommandReason(command.lastErrorCategory)}</Text>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Recorded Status" />
        <Text style={styles.value}>{effectiveClock.activeEntry ? 'Clocked in' : 'Clocked out'}</Text>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Intended Change" />
        <Text style={styles.value}>{actionLabel} at {formatBusinessTime(intendedAt, businessTimeZone, { hour: 'numeric', minute: '2-digit' })}</Text>
        {activity ? <Text style={styles.detail}>{getWorkTypeLabel(activity.workType)}</Text> : null}
        {jobLabel ? <Text style={styles.detail}>{jobLabel}</Text> : null}
        {categoryLabel ? <Text style={styles.detail}>{categoryLabel}</Text> : null}
      </View>

      <PrimaryActionButton
        label="Request Time Correction"
        onPress={() => router.push({
          pathname: '/request-time-correction',
          params: {
            timeEntryId: serverEntryId,
            requestType,
            intendedAt: command.clientOccurredAt,
            offlineAction: command.type,
            requestedActivity: activity?.workType,
            requestedJobId: activity?.jobIds?.[0],
            requestedUnbillableCategoryId: activity?.unbillableCategoryId,
          },
        })}
      />
      <SecondaryButton label="Back" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 6 },
  action: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  time: { color: colors.textSecondary, fontSize: 15 },
  reason: { color: colors.textPrimary, fontSize: 15, lineHeight: 22 },
  section: { gap: 5, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12 },
  value: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  detail: { color: colors.textSecondary, fontSize: 15 },
});
