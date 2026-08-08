import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import {
  formatElapsedClock,
  formatLongShiftWarning,
  getWorkTypeLabel,
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

  const showLongShiftWarning = Boolean(entry && activeShiftWarnings.possibleForgottenClockOut);
  const longShiftWarning = useMemo(() => {
    if (!entry) return '';
    return formatLongShiftWarning(entry.clockIn, now);
  }, [entry, now]);

  return (
    <Screen>
      <View style={styles.card}>
        {!entry ? (
          <>
            <Text style={styles.emptyTitle}>No active shift</Text>
            <Text style={styles.text}>You're not currently clocked in.</Text>
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Current Shift</Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusDot}>●</Text>
              <Text style={styles.statusValue}>Clocked in</Text>
            </View>
            <Text style={styles.jobTitle}>{jobLabel}</Text>
            {entry.workType === 'non_billable' ? (
              <View style={styles.activityStack}>
                <Text style={styles.activityText}>Unbillable</Text>
                <Text style={styles.activityCategoryText}>{unbillableCategoryLabel}</Text>
              </View>
            ) : (
              <Text style={styles.activityText}>Activity: {activityLabel}</Text>
            )}
            <Text style={styles.elapsedClock}>{formatElapsedClock(entry.clockIn, now)}</Text>
            <Text style={styles.elapsedLabel}>Elapsed</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Started at {new Date(entry.clockIn).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
            </View>
          </>
        )}
      </View>

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
        <>
          <PrimaryActionButton label="Clock Out" onPress={() => router.push('/clock-out')} />
          <PrimaryActionButton label="Switch Activity" onPress={() => router.push('/switch-activity')} />
        </>
      ) : (
        <PrimaryActionButton label="Clock In" onPress={() => router.push('/clock-in')} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    color: colors.textPrimary,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -0.6,
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
