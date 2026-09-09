import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { PrimaryScreen } from '@/components/Screen';
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
import { formatTrainingDate } from '@/features/training/presentation';
import { serviceVisitPlaceLabel, serviceVisitStatusLabel, serviceVisitTimeLabel } from '@/features/serviceVisits/presentation';
import { normalizeCompanyFeatures } from '@/features/companyFeatures';
import { useClockingActions } from '@/hooks/useClockingActions';
import { useEffectiveClockState } from '@/hooks/useEffectiveClockState';
import { useTrainingActions } from '@/hooks/useTrainingActions';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { useOptionalOfflineClockStore } from '@/store/offlineClockContext';
import { useTrainingStore } from '@/store/trainingStore';
import { usePendingClockInStore } from '@/store/pendingClockInStore';
import { pendingClockOutFormTarget, usePendingClockOutStore } from '@/store/pendingClockOutStore';
import { colors } from '@/theme/colors';
import { formatBusinessDate, formatBusinessTime } from '@/utils/businessTime';
import { loadMyActiveSnowRoute } from '@/api/snowOperationsApi';
import type { SnowAssignmentResponse } from '@/types/snowOperations';

export default function HomeScreen() {
  const { accessToken, user } = useAuthStore();
  const [snowAssignment, setSnowAssignment] = useState<SnowAssignmentResponse | null>(null);
  const {
    activeShiftWarnings,
    businessTimeZone,
    companyFeatures,
    currentActiveEntryId,
    jobs,
    timeEntries,
    todayServiceVisits = [],
    upcomingServiceVisits = [],
  } = useClockingStore();
  const effectiveCompanyFeatures = normalizeCompanyFeatures(companyFeatures);
  const [visitWindow, setVisitWindow] = useState<'today' | 'upcoming'>('today');
  const offlineClock = useOptionalOfflineClockStore();
  const effectiveClock = useEffectiveClockState();
  const { refreshWorkContext } = useClockingActions();
  const { refreshAssignments } = useTrainingActions();
  const { assignments } = useTrainingStore();
  const pendingClockIn = usePendingClockInStore();
  const pendingClockOut = usePendingClockOutStore();
  const pendingClockInReady = pendingClockIn.phase.kind === 'ready_to_finalize';
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingFormError, setPendingFormError] = useState<string | null>(null);
  const [recoveringRequiredForm, setRecoveringRequiredForm] = useState(false);
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

  useEffect(() => { void refreshAssignments(); }, [refreshAssignments]);

  useEffect(() => {
    if (!effectiveCompanyFeatures.snowOperations) {
      setSnowAssignment(null);
      return;
    }
    let mounted = true;
    void loadMyActiveSnowRoute(accessToken).then((payload) => {
      if (mounted) setSnowAssignment(payload);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, [accessToken, effectiveCompanyFeatures.snowOperations]);

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
  const attentionAssignments = useMemo(() => [
    ...assignments.filter((assignment) => assignment.presentationStatus === 'overdue'),
    ...assignments.filter((assignment) => assignment.presentationStatus === 'due_soon'),
  ], [assignments]);
  const blockingAttention = pendingClockOut.workflow || showPendingClockIn;
  const visibleAttentionCount = (blockingAttention ? 1 : 0) + attentionAssignments.length;
  const longShiftWarning = useMemo(() => {
    if (!activeShift) return '';
    return formatLongShiftWarning(effectiveClock.shiftStartedAt ?? activeShift.clockIn, now);
  }, [activeShift, effectiveClock.shiftStartedAt, now]);

  const greeting = useMemo(() => getGreetingForTime(user?.name || 'Crew Member'), [user?.name]);
  const todayLabel = useMemo(
    () => formatBusinessDate(new Date(now), businessTimeZone, { weekday: 'long', month: 'long', day: 'numeric' }),
    [businessTimeZone, now]
  );

  async function recoverAndOpenRequiredClockOutForm() {
    setPendingFormError(null);
    setRecoveringRequiredForm(true);
    try {
      const canonicalWorkflow = await pendingClockOut.recover();
      if (!canonicalWorkflow) {
        await refreshWorkContext();
        return;
      }
      const target = pendingClockOutFormTarget(canonicalWorkflow);
      if (!target) {
        setPendingFormError('Required form details are unavailable. Retry to refresh them. If this continues, contact your supervisor or administrator to resolve the clock-out requirement.');
        return;
      }
      router.push({
        pathname: '/form',
        params: {
          formId: target.form.id,
          trigger: 'after_clock_out',
          workflowOccurrenceId: target.workflowOccurrenceId,
          workflowRequirementId: target.workflowRequirementId,
        },
      });
    } finally {
      setRecoveringRequiredForm(false);
    }
  }

  return (
    <PrimaryScreen testID="home-scroll">
      <OfflineNotice />
      <OfflineClockStatus showHistoricalAttention />

      <View style={styles.topRow}>
        <Text style={styles.brandText}>OliveOps</Text>
      </View>

      <ScreenHeader title={greeting} subtitle={todayLabel} />

      {effectiveCompanyFeatures.snowOperations && snowAssignment?.route ? (
        <View style={styles.assignedSection}>
          <SectionHeader title="Snow Operations" />
          <SectionCard testID="snow-assignment-card">
            <ListRow
              testID="snow-assignment-link"
              title={snowAssignment.route.name}
              subtitle={snowAssignment.event?.title}
              detail={`${snowAssignment.progress?.completed ?? 0} of ${snowAssignment.progress?.total ?? snowAssignment.stops.length}`}
              onPress={() => router.push('/snow-assignment')}
            />
          </SectionCard>
        </View>
      ) : null}

      {visibleAttentionCount > 0 ? (
        <View style={styles.attentionSection}>
          <SectionHeader
            title="Needs your attention"
            action={visibleAttentionCount > 3 ? (
              <Pressable accessibilityRole="button" onPress={() => router.push('/employee-hub')}>
                <Text style={styles.detailsLink}>View all</Text>
              </Pressable>
            ) : undefined}
          />
          <SectionCard testID="attention-list">
            {blockingAttention ? (
              <ListRow
                testID="attention-blocking-workflow"
                title={pendingClockOut.workflow ? 'Complete required clock-out form' : 'Complete required clock-in form'}
                subtitle="Your clocking workflow is waiting for you"
                onPress={() => {
                  if (pendingClockOut.workflow) {
                    void recoverAndOpenRequiredClockOutForm();
                    return;
                  }
                  if (pendingClockInReady) {
                    void pendingClockIn.finalize().then(async (result) => {
                      if (result.ok) await refreshWorkContext();
                    });
                    return;
                  }
                  const workflowOccurrenceId = pendingClockIn.workflow?.workflowOccurrenceId;
                  const workflowRequirementId = pendingClockIn.currentRequirement?.requirementId;
                  if (pendingClockIn.currentForm && workflowOccurrenceId && workflowRequirementId) {
                    router.push({ pathname: '/form', params: {
                      formId: pendingClockIn.currentForm.id,
                      trigger: 'before_clock_in',
                      workflowOccurrenceId,
                      workflowRequirementId,
                    } });
                    return;
                  }
                  void pendingClockIn.ensureCurrentForm().then((form) => {
                    if (!form || !workflowOccurrenceId || !workflowRequirementId) return;
                    router.push({ pathname: '/form', params: {
                      formId: form.id,
                      trigger: 'before_clock_in',
                      workflowOccurrenceId,
                      workflowRequirementId,
                    } });
                  });
                }}
              />
            ) : null}
            {attentionAssignments.slice(0, blockingAttention ? 2 : 3).map((assignment) => (
              <ListRow
                key={assignment.id}
                testID={`attention-training-${assignment.id}`}
                title={assignment.trainingTitle}
                subtitle={`Due ${formatTrainingDate(assignment.currentDueDate)}`}
                leading={<StatusBadge label={assignment.presentationStatus === 'overdue' ? 'Overdue' : 'Due soon'} tone={assignment.presentationStatus === 'overdue' ? 'error' : 'active'} />}
                onPress={() => router.push({ pathname: '/training-detail', params: { assignmentId: assignment.id } })}
              />
            ))}
          </SectionCard>
        </View>
      ) : null}

      {loadError && !loadError.startsWith('Offline.') ? <StatusBanner tone="error" message={loadError} /> : null}
      {pendingFormError ? <StatusBanner tone="error" message={pendingFormError} /> : null}
      {showPendingClockIn && pendingClockInReady && pendingClockIn.error
        ? <StatusBanner tone="error" message={pendingClockIn.error} />
        : null}

      {effectiveCompanyFeatures.recurringServices ? <View style={styles.assignedSection}>
        <SectionHeader
          title="Service Visits"
          action={upcomingServiceVisits.length > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => setVisitWindow((current) => current === 'today' ? 'upcoming' : 'today')}>
              <Text style={styles.detailsLink}>{visitWindow === 'today' ? 'Upcoming' : 'Today'}</Text>
            </Pressable>
          ) : undefined}
        />
        {(visitWindow === 'today' ? todayServiceVisits : upcomingServiceVisits).length === 0 ? (
          <Text style={styles.emptyVisits}>{visitWindow === 'today' ? 'No Service Visits Today' : 'No Upcoming Service Visits'}</Text>
        ) : (
          <SectionCard testID={`service-visits-${visitWindow}`}>
            {(visitWindow === 'today' ? todayServiceVisits : upcomingServiceVisits).map((visit) => (
              <ListRow
                key={visit.id}
                testID={`service-visit-${visit.id}`}
                title={serviceVisitPlaceLabel(visit)}
                subtitle={[visit.serviceName, visit.propertyAddress].filter(Boolean).join('\n')}
                detail={`${serviceVisitTimeLabel(visit, businessTimeZone)} · ${serviceVisitStatusLabel(visit.status)}`}
                onPress={() => router.push({ pathname: '/service-visit', params: { jobId: visit.jobId, visitId: visit.id } })}
              />
            ))}
          </SectionCard>
        )}
      </View> : null}

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

      {effectiveCompanyFeatures.projects && !activeShift && !showPendingClockIn && !pendingClockOut.workflow && effectiveJobs.length > 0 ? (
        <View style={styles.assignedSection}>
          <SectionHeader title="Assigned Jobs" />
          <SectionCard>
            {effectiveJobs.slice(0, 3).map((job) => (
              <ListRow
                key={job.id}
                title={job.title || 'Untitled Job'}
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

      {pendingClockOut.workflow ? (
        <PrimaryActionButton
          label={recoveringRequiredForm
            ? 'Refreshing Required Form...'
            : pendingClockOut.currentForm
              ? 'Resume Required Form'
              : 'Retry Required Form'}
          disabled={recoveringRequiredForm}
          onPress={() => { void recoverAndOpenRequiredClockOutForm(); }}
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

    </PrimaryScreen>
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
  attentionSection: { gap: 6 },
  assignedSection: { gap: 6 },
  emptyVisits: { color: colors.textSecondary, fontSize: 14, paddingVertical: 8 },
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
  warningBlock: {
    gap: 8,
  },
  warningLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
