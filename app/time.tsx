import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { PrimaryScreen } from '@/components/Screen';
import { InfoRow, ListRow, ScreenHeader, SectionCard, SectionHeader, StatusBadge } from '@/components/MobilePrimitives';
import {
  buildEffectiveTimeEntries,
  formatDurationForEntry,
  formatDurationMinutes,
  formatElapsedShort,
  formatEntryTimeRange,
  formatLongShiftWarning,
  getWorkTypeLabel,
  resolveEntryPrimaryLabel,
  resolveJobTitle,
  resolveUnbillableCategoryName,
  resolveWorkAreaName,
} from '@/features/clocking/presentation';
import { getTodayTimeSummary } from '@/features/clocking/todaySummary';
import { useClockingActions } from '@/hooks/useClockingActions';
import { useEffectiveClockState } from '@/hooks/useEffectiveClockState';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { getOfflineConflictMessage, useOptionalOfflineClockStore } from '@/store/offlineClockContext';
import { usePendingClockInStore } from '@/store/pendingClockInStore';
import { usePendingClockOutStore } from '@/store/pendingClockOutStore';
import { colors, spacing, typography } from '@/theme/colors';
import { formatBusinessTime } from '@/utils/businessTime';

const ENTRY_PREVIEW_LIMIT = 5;

export default function TimeScreen() {
  const { user } = useAuthStore();
  const { activeShiftWarnings, businessTimeZone, currentActiveEntryId, jobs, timeCorrections, timeEntries } = useClockingStore();
  const effectiveClock = useEffectiveClockState();
  const offlineClock = useOptionalOfflineClockStore();
  const pendingClockIn = usePendingClockInStore();
  const pendingClockOut = usePendingClockOutStore();
  const { refreshWorkContext } = useClockingActions();
  const [now, setNow] = useState(Date.now());
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const authoritativeActiveEntry = currentActiveEntryId
    ? timeEntries.find((entry) => entry.id === currentActiveEntryId && entry.status === 'clocked_in') ?? null
    : null;
  const pendingClockInVisible = Boolean(pendingClockIn.workflow && !authoritativeActiveEntry);
  const activeEntry = pendingClockInVisible ? null : authoritativeActiveEntry ?? effectiveClock.activeEntry;
  const effectiveJobs = useMemo(() => jobs.length > 0
    ? jobs
    : (offlineClock?.cache?.jobs ?? []).map((job) => ({ ...job, assignedEmployeeIds: [] })),
  [jobs, offlineClock?.cache?.jobs]);
  const effectiveEntries = useMemo(
    () => buildEffectiveTimeEntries(effectiveClock.timeEntries, timeCorrections),
    [effectiveClock.timeEntries, timeCorrections],
  );
  const today = useMemo(
    () => getTodayTimeSummary(effectiveEntries, businessTimeZone, new Date(now), effectiveClock.effectiveActiveEntryId),
    [businessTimeZone, effectiveClock.effectiveActiveEntryId, effectiveEntries, now],
  );
  const rejectedCorrections = useMemo(
    () => timeCorrections.filter((correction) => correction.status === 'rejected'),
    [timeCorrections],
  );
  const longShift = Boolean(activeEntry && activeShiftWarnings.possibleForgottenClockOut);
  const offlineConflict = offlineClock?.effectiveState.currentShiftConflict ?? null;
  const offlinePendingCount = offlineClock?.effectiveState.pendingCount ?? 0;
  const hasAttention = pendingClockInVisible
    || Boolean(pendingClockOut.workflow)
    || longShift
    || rejectedCorrections.length > 0
    || offlinePendingCount > 0
    || Boolean(offlineConflict);

  function openPendingClockIn() {
    setRecoveryError(null);
    if (pendingClockIn.phase.kind === 'ready_to_finalize') {
      void pendingClockIn.finalize().then(async (result) => {
        if (result.ok) await refreshWorkContext();
        else setRecoveryError(result.error ?? 'Clock-in still needs attention.');
      });
      return;
    }
    const occurrenceId = pendingClockIn.workflow?.workflowOccurrenceId;
    const requirementId = pendingClockIn.currentRequirement?.requirementId;
    const open = (formId: string) => router.push({ pathname: '/form', params: {
      formId,
      trigger: 'before_clock_in',
      workflowOccurrenceId: occurrenceId,
      workflowRequirementId: requirementId,
    } });
    if (pendingClockIn.currentForm && occurrenceId && requirementId) {
      open(pendingClockIn.currentForm.id);
      return;
    }
    void pendingClockIn.ensureCurrentForm().then((form) => {
      if (form && occurrenceId && requirementId) open(form.id);
      else setRecoveryError('Required clock-in form could not be loaded. Reconnect and try again.');
    });
  }

  function openPendingClockOut() {
    const occurrenceId = pendingClockOut.workflow?.workflowOccurrenceId;
    const requirementId = pendingClockOut.currentRequirement?.workflowRequirementId;
    if (pendingClockOut.currentForm && occurrenceId && requirementId) {
      router.push({ pathname: '/form', params: {
        formId: pendingClockOut.currentForm.id,
        trigger: 'after_clock_out',
        workflowOccurrenceId: occurrenceId,
        workflowRequirementId: requirementId,
      } });
      return;
    }
    router.push('/clock-out');
  }

  return (
    <PrimaryScreen testID="time-screen">
      <ScreenHeader title="Time" subtitle="Your shift and today's recorded work" />

      <SectionCard testID="time-current-shift">
        {!activeEntry ? (
          <>
            <StatusBadge label={pendingClockInVisible || pendingClockOut.workflow ? 'Clocking action pending' : 'Not clocked in'} />
            <Text style={styles.cardTitle}>{pendingClockInVisible || pendingClockOut.workflow ? 'Complete the required form below' : 'Ready to start your shift?'}</Text>
            <Text style={styles.supportingText}>{pendingClockInVisible || pendingClockOut.workflow
              ? 'Your next clocking action is available after this workflow is resolved.'
              : "Choose what you're working on and clock in."}</Text>
            {!pendingClockInVisible && !pendingClockOut.workflow ? (
              <PrimaryActionButton label="Clock In" onPress={() => router.push('/clock-in')} />
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.statusRow}>
              <StatusBadge
                label={effectiveClock.effectiveStatus === 'clocked_in_pending' ? 'Clocked in - Pending sync' : 'Clocked in'}
                tone="active"
              />
              <Text style={styles.elapsed}>{formatElapsedShort(effectiveClock.shiftStartedAt ?? activeEntry.clockIn, now)}</Text>
            </View>
            <Text style={styles.cardTitle}>{activeEntry.workType === 'non_billable'
              ? resolveUnbillableCategoryName(activeEntry)
              : getWorkTypeLabel(activeEntry.workType)}</Text>
            <View style={styles.shiftDetails}>
              {activeEntry.workType === 'job' ? <InfoRow label="Job" value={resolveJobTitle(activeEntry, effectiveJobs)} emphasis /> : null}
              {resolveWorkAreaName(activeEntry) ? <InfoRow label="Work Area" value={resolveWorkAreaName(activeEntry)!} /> : null}
              <InfoRow label="Activity" value={getWorkTypeLabel(activeEntry.workType)} />
              <InfoRow label="Clocked in" value={formatBusinessTime(new Date(effectiveClock.shiftStartedAt ?? activeEntry.clockIn), businessTimeZone, { hour: 'numeric', minute: '2-digit' })} />
            </View>
            {!pendingClockOut.workflow ? (
              <View style={styles.actions}>
                <PrimaryActionButton label="Clock Out" onPress={() => router.push('/clock-out')} />
                <SecondaryButton label="Switch Activity" onPress={() => router.push('/switch-activity')} />
              </View>
            ) : null}
          </>
        )}
      </SectionCard>

      <View style={styles.section}>
        <SectionHeader title="Today" />
        <SectionCard testID="today-summary">
          <InfoRow label="Total recorded" value={formatDurationMinutes(today.totalMinutes)} emphasis />
          {today.jobMinutes > 0 ? <InfoRow label="Job Work" value={formatDurationMinutes(today.jobMinutes)} /> : null}
          {today.driveMinutes > 0 ? <InfoRow label="Drive Time" value={formatDurationMinutes(today.driveMinutes)} /> : null}
          {today.unbillableMinutes > 0 ? <InfoRow label="Unbillable Time" value={formatDurationMinutes(today.unbillableMinutes)} /> : null}
        </SectionCard>
      </View>

      {hasAttention ? (
        <View style={styles.section} testID="time-attention">
          <SectionHeader title="Needs attention" />
          <SectionCard>
            {pendingClockOut.workflow ? (
              <ListRow title="Complete required clock-out form" subtitle="Your clock-out is waiting for a required form." onPress={openPendingClockOut} />
            ) : null}
            {pendingClockInVisible ? (
              <ListRow
                title={pendingClockIn.phase.kind === 'ready_to_finalize' ? 'Finish clocking in' : 'Complete required clock-in form'}
                subtitle="Your clock-in has not finished yet."
                onPress={openPendingClockIn}
              />
            ) : null}
            {longShift ? (
              <ListRow
                title="Possible missing clock-out"
                subtitle={formatLongShiftWarning(effectiveClock.shiftStartedAt ?? activeEntry!.clockIn, now)}
                onPress={() => router.push('/clock-out')}
              />
            ) : null}
            {offlineConflict ? (
              <ListRow
                title="Clock conflict needs review"
                subtitle={getOfflineConflictMessage(offlineConflict.lastErrorCode)}
                onPress={() => router.push({ pathname: '/offline-time-change', params: { commandId: offlineConflict.id } })}
              />
            ) : offlinePendingCount > 0 ? (
              <ListRow
                title={`${offlinePendingCount} offline time ${offlinePendingCount === 1 ? 'change is' : 'changes are'} waiting to sync`}
                subtitle="Reconnect to synchronize today's time."
                onPress={() => { void offlineClock?.syncNow(); }}
              />
            ) : null}
            {rejectedCorrections.length > 0 ? (
              <ListRow
                title={`${rejectedCorrections.length} correction ${rejectedCorrections.length === 1 ? 'request was' : 'requests were'} returned`}
                subtitle="Review the response and submit another correction if needed."
                onPress={() => router.push('/my-correction-requests')}
              />
            ) : null}
          </SectionCard>
          {recoveryError ? <Text style={styles.errorText}>{recoveryError}</Text> : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          title="Today's entries"
          action={<Pressable accessibilityRole="button" onPress={() => router.push('/time-history')}><Text style={styles.link}>View Time History</Text></Pressable>}
        />
        {today.entries.length === 0 ? (
          <Text style={styles.supportingText}>No time has been recorded today.</Text>
        ) : (
          <SectionCard>
            {today.entries.slice(0, ENTRY_PREVIEW_LIMIT).map((entry) => (
              <ListRow
                key={entry.id}
                testID={`today-entry-${entry.id}`}
                title={getWorkTypeLabel(entry.workType)}
                subtitle={`${entry.workType === 'job' ? `${resolveEntryPrimaryLabel(entry, effectiveJobs)} - ` : ''}${formatEntryTimeRange(entry, entry.id === effectiveClock.effectiveActiveEntryId, businessTimeZone)}`}
                detail={formatDurationForEntry(entry, now)}
                leading={entry.id.startsWith('local-clock:') ? <StatusBadge label="Pending sync" tone="active" /> : undefined}
                onPress={() => router.push({ pathname: '/time-entry-detail', params: { timeEntryId: entry.id } })}
              />
            ))}
          </SectionCard>
        )}
      </View>
    </PrimaryScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  cardTitle: { color: colors.textPrimary, fontSize: typography.title, fontWeight: typography.bold },
  supportingText: { color: colors.textSecondary, fontSize: typography.bodySmall, lineHeight: 20 },
  elapsed: { color: colors.textPrimary, fontSize: typography.title, fontWeight: typography.bold },
  shiftDetails: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.sm, gap: spacing.xs },
  actions: { gap: spacing.sm, paddingTop: spacing.xs },
  link: { color: colors.primary, fontSize: typography.bodySmall, fontWeight: typography.bold },
  errorText: { color: colors.error, fontSize: typography.bodySmall },
});