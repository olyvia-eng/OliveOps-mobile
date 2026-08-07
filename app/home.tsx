import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { OfflineNotice } from '@/components/OfflineNotice';
import { StatusBanner } from '@/components/StatusBanner';
import { formatElapsedShort, getGreetingForTime, resolveJobTitle } from '@/features/clocking/presentation';
import { useClockingActions } from '@/hooks/useClockingActions';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { colors } from '@/theme/colors';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { timeEntries, jobs } = useClockingStore();
  const { refreshWorkContext } = useClockingActions();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let mounted = true;
    void refreshWorkContext().then((result) => {
      if (!mounted) return;
      setLoadError(result.ok ? null : result.error || 'Could not load assigned jobs and shifts.');
    });

    return () => {
      mounted = false;
    };
  }, [refreshWorkContext]);

  const activeShift = useMemo(() => {
    if (!user?.employeeId) return null;
    return timeEntries.find((entry) => entry.employeeId === user.employeeId && entry.status === 'clocked_in') || null;
  }, [timeEntries, user?.employeeId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const currentJobLabel = useMemo(() => {
    if (!activeShift) return 'Not clocked in';
    return resolveJobTitle(activeShift, jobs);
  }, [activeShift, jobs]);

  const runningHours = useMemo(() => {
    if (!activeShift) return '0.00';
    const started = new Date(activeShift.clockIn).getTime();
    const hours = Math.max(0, (now - started) / (1000 * 60 * 60));
    return hours.toFixed(2);
  }, [activeShift, now]);

  const runningDuration = useMemo(() => {
    if (!activeShift) return '0h 0m';
    return formatElapsedShort(activeShift.clockIn, now);
  }, [activeShift, now]);

  const greeting = useMemo(() => getGreetingForTime(user?.name || 'Crew Member'), [user?.name]);
  const todayLabel = useMemo(
    () => new Date(now).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    [now]
  );

  const todaysWork = useMemo(
    () => jobs.filter((job) => job.status === 'scheduled' || job.status === 'in_progress'),
    [jobs]
  );

  const dominantLabel = activeShift ? 'Clock Out' : 'Clock In';

  function onDominantPress() {
    if (activeShift) {
      router.push('/clock-out');
      return;
    }
    router.push('/clock-in');
  }

  return (
    <Screen>
      <OfflineNotice />

      <View style={styles.topRow}>
        <View style={styles.brandPill}>
          <Text style={styles.brandDot}>●</Text>
          <Text style={styles.brandText}>OliveOps</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/settings')}>
          <Text style={styles.settingsLink}>Settings</Text>
        </Pressable>
      </View>

      <View style={styles.headerBlock}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.today}>{todayLabel}</Text>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.sectionLabel}>{activeShift ? 'Current Shift' : 'Current Status'}</Text>
        <View style={styles.statusRow}>
          <Text style={[styles.statusDot, activeShift ? styles.statusDotActive : styles.statusDotIdle]}>●</Text>
          <Text style={styles.statusValue}>{activeShift ? 'Clocked in' : 'Not clocked in'}</Text>
        </View>
        <Text style={styles.metaText}>Current job: {currentJobLabel}</Text>
        <Text style={styles.metaText}>Running shift hours: {runningHours}</Text>
        {activeShift ? <Text style={styles.metaText}>Elapsed: {runningDuration}</Text> : null}
      </View>

      {loadError ? <StatusBanner tone="error" message={loadError} /> : null}

      <PrimaryActionButton label={dominantLabel} onPress={onDominantPress} />

      <Pressable style={styles.secondaryCard} onPress={() => router.push('/active-shift')}>
        <Text style={styles.secondaryTitle}>Active Shift</Text>
        <Text style={styles.secondaryMeta}>View live shift details and elapsed time.</Text>
      </Pressable>

      {todaysWork.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Today's Work</Text>
          {todaysWork.slice(0, 4).map((job) => (
            <View key={job.id} style={styles.jobCard}>
              <Text style={styles.jobTitle}>{job.title || 'Untitled Job'}</Text>
              <Text style={styles.jobMeta}>{job.status.replace('_', ' ')}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Pressable style={styles.secondaryCard} onPress={() => router.push('/time-history')}>
        <Text style={styles.secondaryTitle}>Time History</Text>
        <Text style={styles.secondaryMeta}>Review your recent entries and weekly total.</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandDot: {
    color: colors.primary,
    fontSize: 12,
  },
  brandText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  settingsLink: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  headerBlock: {
    gap: 8,
  },
  greeting: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  today: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  statusCard: {
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    fontSize: 12,
  },
  statusDotActive: {
    color: colors.primary,
  },
  statusDotIdle: {
    color: colors.textMuted,
  },
  statusValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: '700',
  },
  jobCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  jobTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  jobMeta: {
    color: colors.textSecondary,
    fontSize: 14,
    textTransform: 'capitalize',
  },
  secondaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 4,
  },
  secondaryTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryMeta: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
