import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { Screen } from '@/components/Screen';
import { OfflineNotice } from '@/components/OfflineNotice';
import { OfflineClockStatus } from '@/components/OfflineClockStatus';
import { StatusBanner } from '@/components/StatusBanner';
import { ActionCard, ListRow, ScreenHeader, SectionHeader, StatusBadge } from '@/components/MobilePrimitives';
import {
  formatLongShiftWarning,
  formatElapsedShort,
  getGreetingForTime,
  getWorkTypeLabel,
  resolveJobTitle,
} from '@/features/clocking/presentation';
import { useClockingActions } from '@/hooks/useClockingActions';
import { useEffectiveClockState } from '@/hooks/useEffectiveClockState';
import { useFormsActions } from '@/hooks/useFormsActions';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { useOptionalOfflineClockStore } from '@/store/offlineClockContext';
import { useFormsStore } from '@/store/formsStore';
import { usePendingClockInStore } from '@/store/pendingClockInStore';
import { usePendingClockOutStore } from '@/store/pendingClockOutStore';
import { colors } from '@/theme/colors';
import { formatBusinessDate, formatBusinessTime } from '@/utils/businessTime';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { activeShiftWarnings, businessTimeZone, jobs } = useClockingStore();
  const offlineClock = useOptionalOfflineClockStore();
  const effectiveClock = useEffectiveClockState();
  const { refreshWorkContext } = useClockingActions();
  const { refreshForms } = useFormsActions();
  const { toDo } = useFormsStore();
  const pendingClockIn = usePendingClockInStore();
  const pendingClockOut = usePendingClockOutStore();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingFormError, setPendingFormError] = useState<string | null>(null);
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

  useEffect(() => {
    void refreshForms();
  }, [refreshForms]);

  const activeShift = effectiveClock.activeEntry;
  const effectiveJobs = useMemo(() => jobs.length > 0
    ? jobs
    : (offlineClock?.cache?.jobs ?? []).map((job) => ({ ...job, assignedEmployeeIds: [] })),
  [jobs, offlineClock?.cache?.jobs]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const currentJobLabel = useMemo(() => {
    if (!activeShift) return 'Not clocked in';
    return resolveJobTitle(activeShift, effectiveJobs);
  }, [activeShift, effectiveJobs]);

  const currentActivityLabel = useMemo(() => {
    if (!activeShift) return 'None';
    return getWorkTypeLabel(activeShift.workType);
  }, [activeShift]);

  const runningDuration = useMemo(() => {
    if (!activeShift) return '0h 0m';
    return formatElapsedShort(effectiveClock.shiftStartedAt ?? activeShift.clockIn, now);
  }, [activeShift, effectiveClock.shiftStartedAt, now]);

  const showLongShiftWarning = Boolean(activeShift && activeShiftWarnings.possibleForgottenClockOut);
  const longShiftWarning = useMemo(() => {
    if (!activeShift) return '';
    return formatLongShiftWarning(effectiveClock.shiftStartedAt ?? activeShift.clockIn, now);
  }, [activeShift, effectiveClock.shiftStartedAt, now]);

  const greeting = useMemo(() => getGreetingForTime(user?.name || 'Crew Member'), [user?.name]);
  const todayLabel = useMemo(
    () => formatBusinessDate(new Date(now), businessTimeZone, { weekday: 'long', month: 'long', day: 'numeric' }),
    [businessTimeZone, now]
  );

  return (
    <Screen testID="home-scroll">
      <OfflineNotice />
      <OfflineClockStatus showHistoricalAttention />

      <View style={styles.topRow}>
        <Text style={styles.brandText}>OliveOps</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/settings')}>
          <Text style={styles.settingsLink}>Settings</Text>
        </Pressable>
      </View>

      <ScreenHeader title={greeting} subtitle={todayLabel} />

      {loadError && !loadError.startsWith('Offline.') ? <StatusBanner tone="error" message={loadError} /> : null}
      {pendingFormError ? <StatusBanner tone="error" message={pendingFormError} /> : null}

      {pendingClockOut.workflow ? (
        <ActionCard>
          <StatusBadge label="Clock out pending" tone="active" />
          <Text style={styles.idleTitle}>Complete required form</Text>
          <Text style={styles.idleText}>
            {`Required form ${pendingClockOut.completedCount + 1} of ${pendingClockOut.totalCount}`}
          </Text>
        </ActionCard>
      ) : pendingClockIn.workflow ? (
        <ActionCard>
          <StatusBadge label="Clock in pending" tone="active" />
          <Text style={styles.idleTitle}>Complete required pre-shift form</Text>
          <Text style={styles.idleText}>
            {`Required form ${pendingClockIn.completedCount + 1} of ${pendingClockIn.totalCount}`}
          </Text>
        </ActionCard>
      ) : activeShift ? (
        <View style={styles.activeCard}>
          <StatusBadge
            label={effectiveClock.effectiveStatus === 'clocked_in_pending' ? 'Clocked in — Pending sync' : 'Active Shift'}
            tone="active"
          />
          <Text style={styles.activeTitle}>You're clocked in</Text>
          <Text style={styles.activeJob}>{currentJobLabel}</Text>
          <Text style={styles.activeActivity}>{currentActivityLabel}</Text>
          <View style={styles.shiftMetrics}>
            <View>
              <Text style={styles.metricLabel}>Total shift</Text>
              <Text style={styles.metricValue}>{runningDuration}</Text>
            </View>
            <View>
              <Text style={styles.metricLabel}>Started</Text>
              <Text style={styles.metricValue}>{formatBusinessTime(new Date(effectiveClock.shiftStartedAt ?? activeShift.clockIn), businessTimeZone, { hour: 'numeric', minute: '2-digit' })}</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/active-shift')}>
            <Text style={styles.detailsLink}>View Details ›</Text>
          </Pressable>
        </View>
      ) : (
        <ActionCard>
          <StatusBadge label={effectiveClock.effectiveStatus === 'clocked_out_pending'
            ? 'Clocked out — Pending sync'
            : 'Not clocked in'} />
          <Text style={styles.idleTitle}>Ready to start your shift?</Text>
          <Text style={styles.idleText}>Choose what you're working on and clock in.</Text>
        </ActionCard>
      )}

      {showLongShiftWarning ? (
        <View style={styles.warningBlock}>
          <StatusBanner tone="info" message={longShiftWarning} />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/request-time-correction', params: { requestType: 'forgot_clock_out' } })}
          >
            <Text style={styles.warningLink}>Clock Out & Request Correction</Text>
          </Pressable>
        </View>
      ) : null}

      {pendingClockOut.workflow && pendingClockOut.currentForm && pendingClockOut.currentRequirement ? (
        <PrimaryActionButton
          label="Resume Required Form"
          onPress={() => router.push({
            pathname: '/form',
            params: {
              formId: pendingClockOut.currentForm?.id,
              trigger: 'after_clock_out',
              workflowOccurrenceId: pendingClockOut.workflow?.workflowOccurrenceId,
              workflowRequirementId: pendingClockOut.currentRequirement?.workflowRequirementId,
            },
          })}
        />
      ) : pendingClockIn.workflow && pendingClockIn.currentRequirement ? (
        <PrimaryActionButton
          label={pendingClockIn.busy ? 'Loading Required Form...' : 'Resume Required Form'}
          disabled={pendingClockIn.busy}
          onPress={() => {
            const workflowOccurrenceId = pendingClockIn.workflow?.workflowOccurrenceId;
            const workflowRequirementId = pendingClockIn.currentRequirement?.requirementId;
            setPendingFormError(null);
            if (pendingClockIn.currentForm && workflowOccurrenceId && workflowRequirementId) {
              router.push({
                pathname: '/form',
                params: {
                  formId: pendingClockIn.currentForm.id,
                  trigger: 'before_clock_in',
                  workflowOccurrenceId,
                  workflowRequirementId,
                },
              });
              return;
            }
            void pendingClockIn.ensureCurrentForm().then((form) => {
              if (!form || !workflowOccurrenceId || !workflowRequirementId) {
                setPendingFormError('Required form could not be loaded. Check your connection and try again.');
                return;
              }
              router.push({
                pathname: '/form',
                params: {
                  formId: form.id,
                  trigger: 'before_clock_in',
                  workflowOccurrenceId,
                  workflowRequirementId,
                },
              });
            });
          }}
        />
      ) : pendingClockIn.workflow ? (
        <PrimaryActionButton
          label={pendingClockIn.busy ? 'Loading Required Form...' : 'Resume Required Form'}
          disabled={pendingClockIn.busy}
          onPress={() => {
            setPendingFormError(null);
            void pendingClockIn.ensureCurrentForm().then((form) => {
              if (!form) setPendingFormError('Required form could not be loaded. Check your connection and try again.');
            });
          }}
        />
      ) : activeShift ? (
        <View style={styles.actionStack}>
          <SecondaryButton label="Switch Activity" onPress={() => router.push('/switch-activity')} />
          <PrimaryActionButton label={showLongShiftWarning ? 'Clock Out Now' : 'Clock Out'} onPress={() => router.push('/clock-out')} />
        </View>
      ) : (
        <PrimaryActionButton label="Clock In" onPress={() => router.push('/clock-in')} />
      )}

      <View style={styles.quickSection}>
        <SectionHeader title="Quick Actions" />
        <View style={styles.quickList}>
          <ListRow
            title="Forms"
            subtitle="Complete required and available forms"
            detail={toDo.length > 0 ? `${toDo.length} due` : undefined}
            onPress={() => router.push('/forms')}
          />
          <ListRow title="Time Off" subtitle="Request time off and view status" onPress={() => router.push('/time-off')} />
          <ListRow title="Time History" subtitle="Review entries and weekly totals" onPress={() => router.push('/time-history')} />
          <ListRow title="Correction Requests" subtitle="View or request a time correction" onPress={() => router.push('/my-correction-requests')} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  activeCard: {
    borderRadius: 12,
    backgroundColor: colors.primary,
    padding: 18,
    gap: 6,
  },
  activeTitle: {
    color: colors.primaryText,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
  activeJob: {
    color: colors.primaryText,
    fontSize: 18,
    fontWeight: '600',
  },
  activeActivity: {
    color: '#E7EFE3',
    fontSize: 14,
  },
  shiftMetrics: {
    flexDirection: 'row',
    gap: 32,
    marginTop: 10,
  },
  metricLabel: {
    color: '#D7E2D2',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.primaryText,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  detailsLink: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  idleTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  idleText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  actionStack: {
    gap: 8,
  },
  quickSection: {
    gap: 6,
    marginTop: 4,
  },
  quickList: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
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
  warningBlock: {
    gap: 8,
  },
  warningLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
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
