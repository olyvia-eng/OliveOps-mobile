import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { EmptyState, ScreenHeader, StatusBadge } from '@/components/MobilePrimitives';
import {
  buildEffectiveTimeEntries,
  formatDurationForEntry,
  formatDurationMinutes,
  formatEntryTimeRange,
  getWorkTypeLabel,
  hasApprovedCorrectionForEntry,
  hasPendingCorrectionForEntry,
  isAuthoritativeActiveEntry,
  resolveEntryPrimaryLabel,
  resolveWorkAreaName,
} from '@/features/clocking/presentation';
import { useEffectiveClockState } from '@/hooks/useEffectiveClockState';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { getWeekTotalHours } from '@/api/timeEntriesApi';
import { groupTimeHistoryEntries } from '@/features/clocking/timeHistory';
import { colors, radii, spacing } from '@/theme/colors';

type HistoryListItem =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'entry'; key: string; entry: ReturnType<typeof buildEffectiveTimeEntries>[number] };

export default function TimeHistoryScreen() {
  const { user } = useAuthStore();
  const { businessTimeZone, timeCorrections, jobs } = useClockingStore();
  const effectiveClock = useEffectiveClockState();
  const effectiveTimeEntries = useMemo(
    () => buildEffectiveTimeEntries(effectiveClock.timeEntries, timeCorrections),
    [effectiveClock.timeEntries, timeCorrections],
  );
  const authoritativeActiveEntryId = effectiveClock.effectiveActiveEntryId;
  const historyItems = useMemo<HistoryListItem[]>(() => (
    groupTimeHistoryEntries(
      effectiveTimeEntries,
      businessTimeZone,
      new Date(),
      authoritativeActiveEntryId,
    ).flatMap((group) => [
      { kind: 'header' as const, key: `date-${group.dateKey}`, label: group.label },
      ...group.entries.map((entry) => ({ kind: 'entry' as const, key: entry.id, entry })),
    ])
  ), [authoritativeActiveEntryId, businessTimeZone, effectiveTimeEntries]);
  const weekTotal = useMemo(
    () => getWeekTotalHours(effectiveTimeEntries, businessTimeZone),
    [businessTimeZone, effectiveTimeEntries],
  );
  const weekTotalLabel = useMemo(() => formatDurationMinutes(weekTotal * 60), [weekTotal]);
  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <FlatList
        data={historyItems}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <View style={styles.headerBlock}>
            <ScreenHeader title="Time History" subtitle={`This week · ${weekTotalLabel}`} />
            <View style={styles.headerActionsRow}>
              <Pressable
                style={styles.headerAction}
                onPress={() => router.push({ pathname: '/request-time-correction', params: { requestType: 'forgot_clock_in' } })}
              >
                <Text style={styles.headerActionLabel}>Missing time?</Text>
              </Pressable>
              <Pressable style={styles.headerAction} onPress={() => router.push('/my-correction-requests')}>
                <Text style={styles.headerActionLabel}>My Correction Requests</Text>
              </Pressable>
            </View>
          </View>
        )}
        renderItem={({ item }) => item.kind === 'header' ? (
          <Text style={styles.dateHeader}>{item.label}</Text>
        ) : (
          <View style={styles.entryRow}>
            <View style={styles.entryTopRow}>
              <View style={styles.entryHeading}>
                <Text style={styles.entryActivity}>{getWorkTypeLabel(item.entry.workType)}</Text>
                {item.entry.workType !== 'drive_time' ? <Text style={styles.entryJob}>{resolveEntryPrimaryLabel(item.entry, jobs)}</Text> : null}
              </View>
              {item.entry.clockOut ? (
                <Text style={styles.entryDuration}>{formatDurationForEntry(item.entry)}</Text>
              ) : isAuthoritativeActiveEntry(item.entry.id, authoritativeActiveEntryId) ? (
                <StatusBadge label="Active" tone="active" />
              ) : (
                <StatusBadge label="Incomplete record" />
              )}
            </View>
            <View style={styles.badgeRow}>
              {hasPendingCorrectionForEntry(item.entry.id, timeCorrections) ? (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingLabel}>Correction pending</Text>
                </View>
              ) : null}
              {hasApprovedCorrectionForEntry(item.entry.id, timeCorrections) ? (
                <View style={styles.correctedBadge}>
                  <Text style={styles.correctedLabel}>Corrected</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.entryRange}>{formatEntryTimeRange(item.entry, isAuthoritativeActiveEntry(item.entry.id, authoritativeActiveEntryId), businessTimeZone)}</Text>
            {resolveWorkAreaName(item.entry) ? <Text style={styles.entryRange}>Work Area: {resolveWorkAreaName(item.entry)}</Text> : null}
            <Pressable
              testID={`request-correction-${item.entry.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Request correction for ${getWorkTypeLabel(item.entry.workType)}`}
              style={styles.requestAction}
              onPress={() => router.push({
                pathname: '/request-time-correction',
                params: {
                  timeEntryId: item.entry.id,
                  requestType: item.entry.clockOut ? 'wrong_time' : 'forgot_clock_out',
                },
              })}
            >
              <Text style={styles.requestActionLabel}>Request correction →</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<EmptyState title="No time history" message="Your completed and active work will appear here." />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 0,
  },
  headerBlock: { gap: 10, paddingBottom: 12 },
  dateHeader: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingTop: 16,
    paddingBottom: 8,
  },
  entryRow: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 5,
  },
  entryHeading: { flex: 1, gap: 2 },
  entryActivity: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  headerActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  headerAction: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  headerActionLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  entryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  entryJob: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  entryDuration: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  pendingBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  correctedBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.successBorder,
    backgroundColor: colors.successBackground,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  correctedLabel: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  entryRange: {
    color: colors.textPrimary,
    fontSize: 15,
  },
  requestAction: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  requestActionLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
});
