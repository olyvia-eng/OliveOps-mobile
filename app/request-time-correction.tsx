import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { ActivitySelector } from '@/components/ActivitySelector';
import { ScreenHeader, SectionHeader, StatusBadge } from '@/components/MobilePrimitives';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { UnbillableCategorySelector } from '@/components/UnbillableCategorySelector';
import { WorkAreaSelector } from '@/components/WorkAreaSelector';
import { createRequestMeta } from '@/services/requestGuards';
import {
  formatEntryTimeRange,
  getCorrectionTypeLabel,
  getWorkTypeLabel,
  resolveJobTitle,
} from '@/features/clocking/presentation';
import { useClockingActions } from '@/hooks/useClockingActions';
import { useEffectiveClockState } from '@/hooks/useEffectiveClockState';
import { useTimeCorrectionActions } from '@/hooks/useTimeCorrectionActions';
import { useUnbillableCategories } from '@/hooks/useUnbillableCategories';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { useOptionalOfflineClockStore } from '@/store/offlineClockContext';
import { colors, radii, spacing } from '@/theme/colors';
import { WORK_AREA_CLOCKING_CONTRACT_VERSION, type CreateTimeCorrectionRequest } from '@/types/api';
import type { TimeCorrectionRequestType, TimeEntryWorkType } from '@/types/domain';
import { businessDateKey, businessLocalDateTimeToIso, formatBusinessTime } from '@/utils/businessTime';
import { returnToParentOrReplace } from '@/utils/navigation';

const REQUEST_TYPE_OPTIONS: Array<{ id: TimeCorrectionRequestType; label: string }> = [
  { id: 'forgot_clock_in', label: 'Forgot to clock in' },
  { id: 'forgot_clock_out', label: 'Forgot to clock out' },
  { id: 'wrong_time', label: 'Wrong time' },
  { id: 'wrong_job', label: 'Wrong job' },
  { id: 'wrong_activity', label: 'Wrong activity' },
  { id: 'other', label: 'Other' },
];

export default function RequestTimeCorrectionScreen() {
  const params = useLocalSearchParams<{
    timeEntryId?: string;
    requestType?: TimeCorrectionRequestType;
    postClockOut?: string;
    intendedAt?: string;
    offlineAction?: string;
    requestedActivity?: TimeEntryWorkType;
    requestedJobId?: string;
    requestedUnbillableCategoryId?: string;
    offlineCommandId?: string;
    localShiftId?: string;
    offlineReason?: string;
  }>();
  const { user } = useAuthStore();
  const { businessTimeZone, jobs, timeEntries } = useClockingStore();
  const effectiveClock = useEffectiveClockState();
  const offlineClock = useOptionalOfflineClockStore();
  const { clockOut, loading: clockingLoading } = useClockingActions();
  const { submitCorrection, loading } = useTimeCorrectionActions();
  const {
    categories: unbillableCategories,
    loading: unbillableCategoriesLoading,
    error: unbillableCategoriesError,
    loadIfNeeded: loadUnbillableCategoriesIfNeeded,
    retry: retryUnbillableCategories,
  } = useUnbillableCategories();

  const entryId = typeof params.timeEntryId === 'string' ? params.timeEntryId : undefined;
  const defaultRequestType = typeof params.requestType === 'string'
    ? params.requestType
    : (entryId ? 'wrong_time' : 'forgot_clock_in');
  const intendedAt = typeof params.intendedAt === 'string' && Number.isFinite(Date.parse(params.intendedAt))
    ? new Date(params.intendedAt)
    : null;

  const [requestType, setRequestType] = useState<TimeCorrectionRequestType>(defaultRequestType);
  const [requestedDate, setRequestedDate] = useState(() => businessDateKey(intendedAt ?? new Date(), businessTimeZone));
  const [requestedStartTime, setRequestedStartTime] = useState(() => intendedAt && params.offlineAction === 'clock_in'
    ? formatBusinessTime(intendedAt, businessTimeZone, { hour: '2-digit', minute: '2-digit', hour12: false })
    : '08:00');
  const [requestedEndTime, setRequestedEndTime] = useState(() => intendedAt && params.offlineAction === 'clock_out'
    ? formatBusinessTime(intendedAt, businessTimeZone, { hour: '2-digit', minute: '2-digit', hour12: false })
    : '17:00');
  const [requestedActivity, setRequestedActivity] = useState<TimeEntryWorkType>(params.requestedActivity ?? 'job');
  const [requestedJobId, setRequestedJobId] = useState<string>(params.requestedJobId ?? '');
  const [requestedWorkAreaId, setRequestedWorkAreaId] = useState('');
  const [requestedUnbillableCategoryId, setRequestedUnbillableCategoryId] = useState<string>(params.requestedUnbillableCategoryId ?? '');
  const [reason, setReason] = useState(typeof params.offlineReason === 'string' ? params.offlineReason : '');
  const [retryMeta, setRetryMeta] = useState<{ requestId: string; idempotencyKey: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetEntry = useMemo(() => {
    if (!entryId) return null;
    return effectiveClock.timeEntries.find((entry) => entry.id === entryId)
      ?? timeEntries.find((entry) => entry.id === entryId)
      ?? null;
  }, [effectiveClock.timeEntries, entryId, timeEntries]);
  const targetEntryId = targetEntry?.id ?? entryId;

  const activeEntry = effectiveClock.activeEntry;

  const requiresActivitySelection = requestType === 'wrong_activity' || requestType === 'forgot_clock_in';
  const requiresUnbillableCategory = requiresActivitySelection && requestedActivity === 'non_billable';
  const requiresJobSelection = requestType === 'wrong_job'
    || ((requestType === 'wrong_activity' || requestType === 'forgot_clock_in') && requestedActivity === 'job');
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === requestedJobId),
    [jobs, requestedJobId],
  );
  const requiresWorkArea = requiresJobSelection && selectedJob?.hasOperationalWorkAreas === true;

  useEffect(() => {
    if (!requiresWorkArea || !selectedJob) {
      setRequestedWorkAreaId('');
      return;
    }
    const eligible = selectedJob.eligibleOperationalWorkAreas ?? [];
    if (eligible.length === 1) {
      setRequestedWorkAreaId(eligible[0].id);
      return;
    }
    if (!eligible.some((workArea) => workArea.id === requestedWorkAreaId)) {
      setRequestedWorkAreaId('');
    }
  }, [requestedWorkAreaId, requiresWorkArea, selectedJob]);

  useEffect(() => {
    if (!requiresUnbillableCategory) return;
    void loadUnbillableCategoriesIfNeeded();
  }, [loadUnbillableCategoriesIfNeeded, requiresUnbillableCategory]);

  useEffect(() => {
    if (!requiresUnbillableCategory) return;
    if (!requestedUnbillableCategoryId) return;

    const isStillValid = unbillableCategories.some((category) => category.id === requestedUnbillableCategoryId);
    if (!isStillValid) {
      setRequestedUnbillableCategoryId('');
    }
  }, [requiresUnbillableCategory, requestedUnbillableCategoryId, unbillableCategories]);

  function combineDateAndTime(dateValue: string, timeValue: string) {
    return businessLocalDateTimeToIso(dateValue, timeValue, businessTimeZone);
  }

  const submitting = loading || clockingLoading;

  function getPayload(meta: { requestId: string; idempotencyKey: string }): CreateTimeCorrectionRequest | null {
    const payload: CreateTimeCorrectionRequest = {
      ...meta,
      requestType,
      reason: reason.trim(),
      clockingContractVersion: WORK_AREA_CLOCKING_CONTRACT_VERSION,
    };

    if (targetEntryId) {
      payload.timeEntryId = targetEntryId;
    }

    if (requestType === 'forgot_clock_in') {
      payload.requestedClockInAt = combineDateAndTime(requestedDate, requestedStartTime);
      payload.requestedClockOutAt = combineDateAndTime(requestedDate, requestedEndTime);
      payload.requestedActivityType = requestedActivity;
      if (requestedActivity === 'job') {
        payload.requestedJobId = requestedJobId || undefined;
        payload.requestedWorkAreaId = requestedWorkAreaId || undefined;
      }
      if (requestedActivity === 'non_billable') {
        payload.requestedUnbillableCategoryId = requestedUnbillableCategoryId || undefined;
      }
    }

    if (requestType === 'forgot_clock_out') {
      const sourceDate = params.offlineAction
        ? requestedDate
        : targetEntry ? businessDateKey(new Date(targetEntry.clockIn), businessTimeZone) : requestedDate;
      payload.requestedClockOutAt = combineDateAndTime(sourceDate, requestedEndTime);
    }

    if (requestType === 'wrong_time') {
      const sourceDate = targetEntry ? businessDateKey(new Date(targetEntry.clockIn), businessTimeZone) : requestedDate;
      payload.requestedClockInAt = combineDateAndTime(sourceDate, requestedStartTime);
      payload.requestedClockOutAt = combineDateAndTime(sourceDate, requestedEndTime);
    }

    if (requestType === 'wrong_job') {
      payload.requestedActivityType = 'job';
      payload.requestedJobId = requestedJobId || undefined;
      payload.requestedWorkAreaId = requestedWorkAreaId || undefined;
    }

    if (requestType === 'wrong_activity') {
      payload.requestedActivityType = requestedActivity;
      if (requestedActivity === 'job') {
        payload.requestedJobId = requestedJobId || undefined;
        payload.requestedWorkAreaId = requestedWorkAreaId || undefined;
      }
      if (requestedActivity === 'non_billable') {
        payload.requestedUnbillableCategoryId = requestedUnbillableCategoryId || undefined;
      }
    }

    return payload;
  }

  async function submitRequest(metaOverride?: { requestId: string; idempotencyKey: string }) {
    setError(null);
    setStatus(null);

    if (!reason.trim()) {
      setError('Tell your manager what happened before submitting.');
      return;
    }

    if (requestType !== 'forgot_clock_in' && !targetEntryId) {
      setError('A historical entry is required for this correction type.');
      return;
    }

    if (requestType !== 'forgot_clock_in' && targetEntry && targetEntry.status !== 'clocked_out' && !requiresClockOutFirst) {
      setError('You are still clocked in. Clock out first, then submit this correction.');
      return;
    }

    if (requestType === 'forgot_clock_in' || requestType === 'wrong_time') {
      const inAt = combineDateAndTime(requestedDate, requestedStartTime);
      const outAt = combineDateAndTime(requestedDate, requestedEndTime);
      if (!inAt || !outAt) {
        setError('Enter valid start and end times.');
        return;
      }
      if (Date.parse(inAt) >= Date.parse(outAt)) {
        setError('Requested clock-out must be after requested clock-in.');
        return;
      }
    }

    if (requestType === 'wrong_job' && !requestedJobId) {
      setError('Choose a correct job before submitting.');
      return;
    }

    if ((requestType === 'wrong_activity' || requestType === 'forgot_clock_in')
      && requestedActivity === 'job'
      && !requestedJobId) {
      setError('Choose a correct job before submitting.');
      return;
    }

    if (requiresWorkArea && !requestedWorkAreaId) {
      setError(selectedJob?.eligibleOperationalWorkAreas?.length
        ? 'Choose a Work Area before submitting.'
        : 'This Job has no Work Areas available for clocking.');
      return;
    }

    if (requiresUnbillableCategory) {
      if (unbillableCategoriesLoading) {
        setError('Unbillable categories are still loading.');
        return;
      }
      if (unbillableCategoriesError) {
        setError('Unbillable categories could not be loaded. Retry and try again.');
        return;
      }
      if (unbillableCategories.length === 0) {
        setError('No unbillable categories are currently available. Ask your administrator to configure them in OliveOps.');
        return;
      }
      if (!requestedUnbillableCategoryId) {
        setError('Choose an unbillable category before submitting.');
        return;
      }
    }

    const meta = metaOverride
      ?? retryMeta
      ?? createRequestMeta(targetEntryId ?? user?.employeeId ?? requestType);
    setRetryMeta(meta);
    const payload = getPayload(meta);
    if (!payload) {
      setError('Could not build correction request payload.');
      return;
    }

    const result = await submitCorrection(payload);
    if (!result.ok) {
      setError(result.error || 'Could not submit correction request.');
      return;
    }

    if (typeof params.offlineCommandId === 'string' && result.correction?.id) {
      await offlineClock?.resolveCommandWithCorrection(params.offlineCommandId, result.correction.id);
    }

    setRetryMeta(null);
    setStatus(result.warning || 'Correction request submitted');
    setTimeout(() => {
      returnToParentOrReplace('/time-history');
    }, 500);
  }

  async function onClockOutAndRequestCorrection() {
    if (!activeEntry) {
      setError('No active shift found.');
      return;
    }

    const meta = createRequestMeta(activeEntry.id);
    const clockOutResult = await clockOut(activeEntry.id, '', undefined, meta);
    if (!clockOutResult.ok) {
      setError(clockOutResult.error || 'Clock-out failed. Correction was not created.');
      return;
    }

    router.replace({ pathname: '/request-time-correction', params: { timeEntryId: activeEntry.id, requestType: 'forgot_clock_out', postClockOut: '1' } });
  }

  const requiresClockOutFirst = Boolean(
    requestType === 'forgot_clock_out'
    && activeEntry
    && (!targetEntryId || targetEntryId === activeEntry.id),
  );
  const activeOfflineCorrectionBlocked = Boolean(params.offlineCommandId && requiresClockOutFirst);

  return (
    <Screen>
      <View style={styles.section}>
        <ScreenHeader title="Request a Correction" subtitle="Tell your manager what needs to change" />
        {targetEntry ? (
          <View style={styles.summaryBlock}>
            <View style={styles.summaryHeading}>
              <SectionHeader title="Original Entry" />
              <StatusBadge label={getWorkTypeLabel(targetEntry.workType)} />
            </View>
            <Text style={styles.summaryTitle}>{resolveJobTitle(targetEntry, jobs)}</Text>
            <Text style={styles.summaryRange}>{formatEntryTimeRange(targetEntry, false, businessTimeZone)}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Correction type</Text>
        {REQUEST_TYPE_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            style={[styles.option, requestType === option.id ? styles.optionSelected : null]}
            onPress={() => setRequestType(option.id)}
            testID={`correction-type-${option.id}`}
          >
            <Text style={styles.optionLabel}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      {requiresClockOutFirst ? (
        <View style={styles.section}>
          <StatusBanner
            tone={activeOfflineCorrectionBlocked ? 'error' : 'info'}
            message={activeOfflineCorrectionBlocked
              ? 'This shift is still active on the server. A correction cannot be requested until active-shift correction support is available.'
              : 'You are still clocked in.'}
          />
          {!activeOfflineCorrectionBlocked ? (
            <>
              <Text style={styles.helperText}>Did you forget to clock out earlier?</Text>
              <PrimaryActionButton label="Clock Out Now" onPress={() => router.push('/clock-out')} />
              <PrimaryActionButton
                label={submitting ? 'Submitting...' : 'Clock Out & Request Correction'}
                disabled={submitting}
                onPress={() => { void onClockOutAndRequestCorrection(); }}
              />
            </>
          ) : null}
        </View>
      ) : null}

      {(requestType === 'forgot_clock_in' || requestType === 'wrong_time') ? (
        <View style={styles.section}>
          {requestType === 'forgot_clock_in' ? <Text style={styles.label}>What time did you actually start?</Text> : <Text style={styles.label}>Requested start</Text>}
          <TextInput
            style={styles.input}
            value={requestedDate}
            onChangeText={setRequestedDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.inputPlaceholder}
            testID="correction-date-input"
          />
          <TextInput
            style={styles.input}
            value={requestedStartTime}
            onChangeText={setRequestedStartTime}
            placeholder="HH:MM"
            placeholderTextColor={colors.inputPlaceholder}
            testID="correction-start-input"
          />
          <Text style={styles.label}>{requestType === 'forgot_clock_in' ? 'What time did you actually finish?' : 'Requested end'}</Text>
          <TextInput
            style={styles.input}
            value={requestedEndTime}
            onChangeText={setRequestedEndTime}
            placeholder="HH:MM"
            placeholderTextColor={colors.inputPlaceholder}
            testID="correction-end-input"
          />
        </View>
      ) : null}

      {requestType === 'forgot_clock_out' ? (
        <View style={styles.section}>
          <Text style={styles.label}>What time did you actually finish?</Text>
          <TextInput
            style={styles.input}
            value={requestedEndTime}
            onChangeText={setRequestedEndTime}
            placeholder="HH:MM"
            placeholderTextColor={colors.inputPlaceholder}
            testID="correction-end-input"
          />
        </View>
      ) : null}

      {requiresActivitySelection ? (
        <ActivitySelector
          heading="Choose correct activity"
          selectedType={requestedActivity}
          onSelect={(activity) => {
            setRequestedActivity(activity);
            setRequestedJobId('');
            setRequestedWorkAreaId('');
          }}
        />
      ) : null}

      {requiresUnbillableCategory ? (
        <UnbillableCategorySelector
          categories={unbillableCategories}
          selectedCategoryId={requestedUnbillableCategoryId}
          loading={unbillableCategoriesLoading}
          error={unbillableCategoriesError}
          onSelect={setRequestedUnbillableCategoryId}
          onRetry={() => {
            void retryUnbillableCategories();
          }}
        />
      ) : null}

      {(requestType === 'wrong_job' || ((requestType === 'wrong_activity' || requestType === 'forgot_clock_in') && requestedActivity === 'job')) ? (
        <View style={styles.section}>
          <Text style={styles.label}>Choose correct job</Text>
          {jobs.map((job) => (
            <Pressable
              key={job.id}
              style={[styles.option, requestedJobId === job.id ? styles.optionSelected : null]}
              onPress={() => {
                setRequestedJobId(job.id);
                setRequestedWorkAreaId('');
              }}
              testID={`job-option-${job.id}`}
            >
              <Text style={styles.optionLabel}>{job.title || 'Untitled job'}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {requiresJobSelection && selectedJob ? (
        <WorkAreaSelector
          job={selectedJob}
          selectedWorkAreaId={requestedWorkAreaId}
          onSelect={setRequestedWorkAreaId}
          testIDPrefix="correction-work-area-option"
        />
      ) : null}

      <View style={styles.section}>
        <Text style={styles.label}>Tell your manager what happened</Text>
        <TextInput
          style={[styles.input, styles.notes]}
          value={reason}
          onChangeText={setReason}
          placeholder="Add details for your manager"
          placeholderTextColor={colors.inputPlaceholder}
          multiline
          numberOfLines={4}
          testID="correction-reason-input"
        />
      </View>

      {status ? (
        <View style={styles.section}>
          <StatusBanner tone="success" message={status} />
          <Text style={styles.helperText}>Your original time entry will remain unchanged until the request is approved.</Text>
        </View>
      ) : null}
      {error ? <StatusBanner tone="error" message={error} /> : null}
      {params.postClockOut === '1' ? <StatusBanner tone="info" message="Clock-out completed. Please submit your correction request." /> : null}

      <PrimaryActionButton
        label={submitting ? 'Submitting...' : 'Submit Request'}
        disabled={
          submitting
          || requiresClockOutFirst
          || (requiresWorkArea && !requestedWorkAreaId)
          || (requiresUnbillableCategory && (
            unbillableCategoriesLoading
            || Boolean(unbillableCategoriesError)
            || unbillableCategories.length === 0
            || !requestedUnbillableCategoryId
          ))
        }
        onPress={() => { void submitRequest(); }}
      />
      {error && retryMeta ? (
        <PrimaryActionButton
          label="Retry Request"
          disabled={submitting}
          onPress={() => { void submitRequest(retryMeta); }}
        />
      ) : null}
      {submitting ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      <Text style={styles.footerHint}>Request type: {getCorrectionTypeLabel(requestType)}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  summaryBlock: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12, gap: 5 },
  summaryHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  summaryRange: {
    color: colors.textPrimary,
    fontSize: 15,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  option: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.oliveTint,
  },
  optionLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    minHeight: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
  },
  notes: {
    minHeight: 108,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  footerHint: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});
