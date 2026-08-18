import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { EmptyState, ScreenHeader, SectionHeader, StatusBadge } from '@/components/MobilePrimitives';
import {
  formatDurationForEntry,
  formatElapsedClock,
  formatEntryTimeRange,
  formatLongShiftWarning,
  getCurrentShiftSegments,
  getWorkTypeLabel,
  resolveEntryPrimaryLabel,
  resolveCurrentActiveEntry,
  resolveJobTitle,
  resolveUnbillableCategoryName,
} from '@/features/clocking/presentation';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { colors } from '@/theme/colors';

export default function ActiveShiftScreen() {
  const { user } = useAuthStore();
  const { activeShiftWarnings, currentActiveEntryId, timeEntries, jobs } = useClockingStore();
  const [now, setNow] = useState(Date.now());

  const entry = useMemo(() => {
    return resolveCurrentActiveEntry(timeEntries, user?.employeeId, currentActiveEntryId);
  }, [currentActiveEntryId, timeEntries, user?.employeeId]);

  useEffect(() => {
    if (!entry) return;
    if (process.env.NODE_ENV === 'test') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [entry]);

  const jobLabel = useMemo(() => {
    if (!entry) return 'No active job';
    return resolveJobTitle(entry, jobs);
  }, [entry, jobs]);

  const activityLabel = useMemo(() => {
    if (!entry) return 'No active activity';
    return getWorkTypeLabel(entry.workType);
  }, [entry]);

  const unbillableCategoryLabel = useMemo(() => {
    if (!entry) return null;
    return resolveUnbillableCategoryName(entry);
  }, [entry]);

  const shiftSegments = useMemo(
    () => getCurrentShiftSegments(timeEntries, user?.employeeId, currentActiveEntryId),
    [currentActiveEntryId, timeEntries, user?.employeeId],
  );

  const showLongShiftWarning = Boolean(entry && activeShiftWarnings.possibleForgottenClockOut);
  const longShiftWarning = useMemo(() => {
    if (!entry) return '';
    return formatLongShiftWarning(entry.clockIn, now);
  }, [entry, now]);

  return (
    <Screen>
      <ScreenHeader title="Active Shift" subtitle="Live shift details" />
      {!entry ? (
        <EmptyState
          title="No active shift"
          message="You're not currently clocked in."
          action={<PrimaryActionButton label="Clock In" onPress={() => router.push('/clock-in')} />}
        />
      ) : (
        <>
          <View style={styles.hero}>
            <StatusBadge label="Clocked in" tone="active" />
            <Text style={styles.heroLabel}>Current Activity</Text>
            <Text style={styles.heroActivity}>{entry.workType === 'non_billable' ? unbillableCategoryLabel : activityLabel}</Text>
            {entry.workType === 'job' ? <Text style={styles.heroJob}>{jobLabel}</Text> : null}
            <Text style={styles.elapsedClock}>{formatElapsedClock(entry.clockIn, now)}</Text>
            <Text style={styles.heroMeta}>Started {new Date(entry.clockIn).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
          </View>

          <View style={styles.timelineSection}>
            <SectionHeader title="Today's Shift" />
            <View style={styles.timeline}>
              {shiftSegments.map((segment, index) => (
                <View key={segment.id} style={styles.segmentRow}>
                  <View style={styles.timelineRail}>
                    <View style={[styles.timelineDot, segment.id === entry.id && styles.timelineDotActive]} />
                    {index < shiftSegments.length - 1 ? <View style={styles.timelineLine} /> : null}
                  </View>
                  <View style={styles.segmentContent}>
                    <View style={styles.segmentTop}>
                      <Text style={styles.segmentTitle}>{getWorkTypeLabel(segment.workType)}{segment.workType === 'job' ? ` — ${resolveEntryPrimaryLabel(segment, jobs)}` : ''}</Text>
                      <Text style={styles.segmentDuration}>{formatDurationForEntry(segment, now)}</Text>
                    </View>
                    <Text style={styles.segmentTime}>{formatEntryTimeRange(segment, segment.id === entry.id)}</Text>
                    {segment.workType === 'non_billable' ? <Text style={styles.segmentMeta}>{resolveEntryPrimaryLabel(segment, jobs)}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </>
      )}

      {showLongShiftWarning ? (
        <View style={styles.warningBlock}>
          <StatusBanner tone="info" message={longShiftWarning} />
          <PrimaryActionButton label="Clock Out Now" onPress={() => router.push('/clock-out')} />
          <Pressable style={styles.warningSecondary} onPress={() => router.push({ pathname: '/request-time-correction', params: { requestType: 'forgot_clock_out' } })}>
            <Text style={styles.warningSecondaryText}>Clock Out & Request Correction</Text>
          </Pressable>
        </View>
      ) : null}

      {entry ? (
        <View style={styles.actions}>
          <SecondaryButton label="Switch Activity" onPress={() => router.push('/switch-activity')} />
          <PrimaryActionButton label="Clock Out" onPress={() => router.push('/clock-out')} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 12,
    backgroundColor: colors.primary,
    padding: 18,
    gap: 5,
  },
  heroLabel: { color: '#D7E2D2', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 6 },
  heroActivity: { color: colors.primaryText, fontSize: 24, fontWeight: '700' },
  heroJob: { color: '#E7EFE3', fontSize: 15, fontWeight: '600' },
  heroMeta: { color: '#D7E2D2', fontSize: 14 },
  timelineSection: { gap: 8 },
  timeline: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 6 },
  segmentRow: { flexDirection: 'row', minHeight: 70 },
  timelineRail: { width: 24, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border, marginTop: 6 },
  timelineDotActive: { backgroundColor: colors.primary },
  timelineLine: { width: 1, flex: 1, backgroundColor: colors.divider, marginVertical: 3 },
  segmentContent: { flex: 1, paddingBottom: 14 },
  segmentTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  segmentTitle: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  segmentDuration: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  segmentTime: { color: colors.textSecondary, fontSize: 14, marginTop: 3 },
  segmentMeta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  actions: { gap: 8 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 10,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    color: colors.primary,
    fontSize: 12,
  },
  statusValue: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  jobTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  },
  activityText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  activityStack: {
    gap: 2,
  },
  activityCategoryText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  elapsedClock: {
    color: colors.primaryText,
    fontSize: 36,
    fontWeight: '700',
    marginTop: 10,
  },
  elapsedLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  text: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaLabel: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  warningBlock: {
    gap: 8,
  },
  warningSecondary: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  warningSecondaryText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
});
