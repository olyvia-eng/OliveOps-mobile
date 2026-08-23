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
} from '@/features/clocking/presentation';
import { useEffectiveClockState } from '@/hooks/useEffectiveClockState';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { getTodayEntries, getWeekTotalHours } from '@/api/timeEntriesApi';
import { colors, spacing } from '@/theme/colors';

export default function TimeHistoryScreen() {
  const { user } = useAuthStore();
  const { businessTimeZone, timeCorrections, jobs } = useClockingStore();
  const effectiveClock = useEffectiveClockState();
  const effectiveTimeEntries = useMemo(
    () => buildEffectiveTimeEntries(effectiveClock.timeEntries, timeCorrections),
    [effectiveClock.timeEntries, timeCorrections],
  );
  const todayEntries = useMemo(
    () => getTodayEntries(effectiveTimeEntries, businessTimeZone),
    [businessTimeZone, effectiveTimeEntries],
  );
  const orderedEntries = useMemo(
    () => [...todayEntries].sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime()),
    [todayEntries]
  );
  const weekTotal = useMemo(
    () => getWeekTotalHours(effectiveTimeEntries, businessTimeZone),
    [businessTimeZone, effectiveTimeEntries],
  );
  const weekTotalLabel = useMemo(() => formatDurationMinutes(weekTotal * 60), [weekTotal]);
  const authoritativeActiveEntryId = effectiveClock.effectiveActiveEntryId;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <FlatList
        data={orderedEntries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <View style={styles.headerBlock}>
            <ScreenHeader title="Time History" subtitle={`${todayEntries.length} entries today · This week total: ${weekTotalLabel}`} />
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
        renderItem={({ item }) => (
          <View style={styles.entryRow}>
            <View style={styles.entryTopRow}>
              <View style={styles.entryHeading}>
                <Text style={styles.entryActivity}>{getWorkTypeLabel(item.workType)}</Text>
                {item.workType !== 'drive_time' ? <Text style={styles.entryJob}>{resolveEntryPrimaryLabel(item, jobs)}</Text> : null}
              </View>
              {item.clockOut ? (
                <Text style={styles.entryDuration}>{formatDurationForEntry(item)}</Text>
              ) : isAuthoritativeActiveEntry(item.id, authoritativeActiveEntryId) ? (
                <StatusBadge label="Active" tone="active" />
              ) : (
                <StatusBadge label="Incomplete record" />
              )}
            </View>
            <View style={styles.badgeRow}>
              {hasPendingCorrectionForEntry(item.id, timeCorrections) ? (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingLabel}>Correction pending</Text>
                </View>
              ) : null}
              {hasApprovedCorrectionForEntry(item.id, timeCorrections) ? (
                <View style={styles.correctedBadge}>
                  <Text style={styles.correctedLabel}>Corrected</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.entryRange}>Today · {formatEntryTimeRange(item, isAuthoritativeActiveEntry(item.id, authoritativeActiveEntryId), businessTimeZone)}</Text>
            <Pressable
              testID={`request-correction-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Request correction for ${getWorkTypeLabel(item.workType)}`}
              style={styles.requestAction}
              onPress={() => router.push({
                pathname: '/request-time-correction',
                params: {
                  timeEntryId: item.id,
                  requestType: item.clockOut ? 'wrong_time' : 'forgot_clock_out',
                },
              })}
            >
              <Text style={styles.requestActionLabel}>Request correction →</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<EmptyState title="No time entries today" message="Your completed and active work will appear here." />}
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
  headerCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 6,
  },
  entryRow: { borderTopWidth: 1, borderTopColor: colors.divider, paddingVertical: 14, gap: 5 },
  entryHeading: { flex: 1, gap: 2 },
  entryActivity: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 15,
  },
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
  entryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 6,
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
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.successBorder,
    backgroundColor: colors.successBackground,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  activeDot: {
    color: colors.primary,
    fontSize: 10,
  },
  activeLabel: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  incompleteBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  incompleteLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
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
  entryDateLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  entryType: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  entryRange: {
    color: colors.textPrimary,
    fontSize: 15,
  },
  empty: {
    color: colors.textSecondary,
    fontSize: 15,
    marginTop: 12,
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
