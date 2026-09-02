import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { Screen } from '@/components/Screen';
import { OfflineNotice } from '@/components/OfflineNotice';
import { OfflineClockStatus } from '@/components/OfflineClockStatus';
import { StatusBanner } from '@/components/StatusBanner';
import { ActionCard, InfoRow, ListRow, ScreenHeader, SectionCard, SectionHeader, StatusBadge } from '@/components/MobilePrimitives';
import {
  formatLongShiftWarning,
  formatElapsedShort,
  getGreetingForTime,
  getWorkTypeLabel,
  resolveJobTitle,
  resolveWorkAreaName,
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
  const { activeShiftWarnings, businessTimeZone, currentActiveEntryId, jobs, timeEntries } = useClockingStore();
  const offlineClock = useOptionalOfflineClockStore();
  const effectiveClock = useEffectiveClockState();
  const { refreshWorkContext } = useClockingActions();
  const { refreshForms } = useFormsActions();
  const { toDo } = useFormsStore();
  const pendingClockIn = usePendingClockInStore();
  const pendingClockOut = usePendingClockOutStore();
  const pendingClockInReady = pendingClockIn.phase.kind === 'ready_to_finalize';
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

  const authoritativeActiveShift = currentActiveEntryId
    ? timeEntries.find((entry) => entry.id === currentActiveEntryId && entry.status === 'clocked_in') ?? null
    : null;
  const activeShift = authoritativeActiveShift ?? effectiveClock.activeEntry;
  const localPendingClockIn = effectiveClock.activeSource === 'offline_pending';
  const showPendingClockIn = Boolean(pendingClockIn.workflow && !authoritativeActiveShift);
  const effectiveJobs = useMemo(() => jobs.length > 0
    ? jobs
    : (offlineClock?.cache?.jobs ?? []).map((job) => ({ ...job, assignedEmployeeIds: [] })),
  [jobs, offlineClock?.cache?.jobs]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (authoritativeActiveShift && pendingClockIn.workflow) void pendingClockIn.reconcileActiveShift();
  }, [authoritativeActiveShift, pendingClockIn.reconcileActiveShift, pendingClockIn.workflow]);

  const currentJobLabel = useMemo(() => {
    if (!activeShift) return 'Not clocked in';
    return resolveJobTitle(activeShift, effectiveJobs);
  }, [activeShift, effectiveJobs]);

  const currentActivityLabel = useMemo(() => {
    if (!activeShift) return 'None';
    return getWorkTypeLabel(activeShift.workType);
  }, [activeShift]);
  const currentWorkAreaLabel = useMemo(() => activeShift ? resolveWorkAreaName(activeShift) : undefined, [activeShift]);

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
      {showPendingClockIn && pendingClockInReady && pendingClockIn.error
        ? <StatusBanner tone="error" message={pendingClockIn.error} />
        : null}

      {pendingClockOut.workflow ? (
        <ActionCard>
          <StatusBadge label="Clock out pending" tone="active" />
          <Text style={styles.idleTitle}>Complete required form</Text>
          <Text style={styles.idleText}>
            {`Required form ${pendingClockOut.completedCount + 1} of ${pendingClockOut.totalCount}`}
          </Text>
        </ActionCard>
      ) : showPendingClockIn ? (
        <ActionCard>
          <StatusBadge label="Clock in pending" tone="active" />
          <Text style={styles.idleTitle}>
            {pendingClockInReady ? 'Required forms complete' : 'Complete required pre-shift form'}
          </Text>
          <Text style={styles.idleText}>
            {pendingClockInReady
              ? pendingClockIn.error
                ? 'Clock-in still needs to be finished.'
                : 'Finishing clock in...'
              : pendingClockIn.phase.kind === 'requirements_outstanding'
                ? `Required form ${pendingClockIn.phase.current} of ${pendingClockIn.phase.total}`
                : null}
          </Text>
        </ActionCard>
      ) : activeShift ? (
        <SectionCard testID="current-work-card">
          <View style={styles.currentWorkHeader}>
            <View style={styles.currentWorkHeading}>
              <Text style={styles.currentWorkEyebrow}>CURRENT WORK</Text>
              <Text style={styles.currentWorkTitle}>
                {localPendingClockIn ? 'Your clock-in is waiting to sync' : "You're clocked in"}
              </Text>
            </View>
            <StatusBadge
              label={localPendingClockIn ? 'Clock in pending sync' : 'Active'}
              tone="active"
            />
          </View>
          <View style={styles.currentWorkDetails}>
            <InfoRow label="Job" value={currentJobLabel} emphasis />
            {currentWorkAreaLabel ? <InfoRow label="Work Area" value={currentWorkAreaLabel} /> : null}
            <InfoRow label="Activity" value={currentActivityLabel} />
            <InfoRow label="Started" value={formatBusinessTime(new Date(effectiveClock.shiftStartedAt ?? activeShift.clockIn), businessTimeZone, { hour: 'numeric', minute: '2-digit' })} />
            <InfoRow label="Total shift" value={runningDuration} emphasis />
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/active-shift')}>
            <Text style={styles.detailsLink}>View shift details ›</Text>
          </Pressable>
        </SectionCard>
      ) : (
        <ActionCard>
          <StatusBadge label={effectiveClock.effectiveStatus === 'clocked_out_pending'
            ? 'Clocked out — Pending sync'
            : 'Not clocked in'} />
          <Text style={styles.idleTitle}>Ready to start your shift?</Text>
          <Text style={styles.idleText}>Choose what you're working on and clock in.</Text>
        </ActionCard>
      )}

      {!activeShift && !showPendingClockIn && !pendingClockOut.workflow && effectiveJobs.length > 0 ? (
        <View style={styles.assignedSection}>
          <SectionHeader title="Assigned Jobs" />
          <SectionCard>
            {effectiveJobs.slice(0, 3).map((job) => (
              <ListRow
                key={job.id}
                title={job.title || 'Untitled Job'}
                subtitle={job.status.replace('_', ' ')}
              />
            ))}
          </SectionCard>
        </View>
      ) : null}

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
      ) : showPendingClockIn && pendingClockInReady ? (
        <PrimaryActionButton
          label={pendingClockIn.busy
            ? 'Finishing Clock In...'
            : pendingClockIn.error
              ? 'Retry Finish Clock In'
              : 'Finish Clock In'}
          disabled={pendingClockIn.busy}
          onPress={() => {
            setPendingFormError(null);
            void pendingClockIn.finalize().then(async (result) => {
              if (result.ok) await refreshWorkContext();
            });
          }}
        />
      ) : showPendingClockIn && pendingClockIn.currentRequirement ? (
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
      ) : showPendingClockIn ? (
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
  currentWorkHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  currentWorkHeading: { flex: 1, gap: 3 },
  currentWorkEyebrow: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  currentWorkTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  currentWorkDetails: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10, gap: 4 },
  detailsLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
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
  assignedSection: { gap: 6 },
  quickList: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  warningBlock: {
    gap: 8,
  },
  warningLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
