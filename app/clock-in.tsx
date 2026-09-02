import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { OfflineNotice } from '@/components/OfflineNotice';
import { AdvisoryFormsPrompt } from '@/components/AdvisoryFormsPrompt';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { UnbillableCategorySelector } from '@/components/UnbillableCategorySelector';
import { WorkAreaSelector } from '@/components/WorkAreaSelector';
import { ActivitySelector } from '@/components/ActivitySelector';
import { StartTimeField } from '@/components/StartTimeField';
import { ListRow, ScreenHeader, SectionCard, SectionHeader } from '@/components/MobilePrimitives';
import { scopeJobsForSession } from '@/features/clocking/scoping';
import { useClockingActions } from '@/hooks/useClockingActions';
import { useEffectiveClockState } from '@/hooks/useEffectiveClockState';
import { useFormsActions } from '@/hooks/useFormsActions';
import { useUnbillableCategories } from '@/hooks/useUnbillableCategories';
import { createRequestMeta } from '@/services/requestGuards';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { useOptionalOfflineClockStore } from '@/store/offlineClockContext';
import { useFormsWorkflowStore, type FormsWorkflowIntent } from '@/store/formsWorkflowStore';
import { usePendingClockInStore } from '@/store/pendingClockInStore';
import { usePendingClockOutStore } from '@/store/pendingClockOutStore';
import { colors } from '@/theme/colors';
import type { TimeEntryWorkType } from '@/types/domain';
import { businessDateKey, businessLocalDateTimeToIso } from '@/utils/businessTime';

type ClockInStage = 'activity' | 'job' | 'work_area' | 'category';

type ActivityOption = {
  type: TimeEntryWorkType;
  label: string;
  help: string;
  requiresJob: boolean;
};

export default function ClockInScreen() {
  const { user } = useAuthStore();
  const { businessTimeZone, clockingCapabilities, currentActiveEntryId, jobs, timeEntries } = useClockingStore();
  const offlineClock = useOptionalOfflineClockStore();
  const effectiveClock = useEffectiveClockState();
  const { clockIn, loading, refreshWorkContext } = useClockingActions();
  const { getRequiredForms, refreshForms } = useFormsActions();
  const { workflow, startWorkflow, clearWorkflow } = useFormsWorkflowStore();
  const pendingClockIn = usePendingClockInStore();
  const pendingClockOut = usePendingClockOutStore();
  const {
    categories: unbillableCategories,
    loading: unbillableCategoriesLoading,
    error: unbillableCategoriesError,
    loadIfNeeded: loadUnbillableCategoriesIfNeeded,
    retry: retryUnbillableCategories,
  } = useUnbillableCategories();
  const [selectedWorkType, setSelectedWorkType] = useState<TimeEntryWorkType>('job');
  const [activityChosen, setActivityChosen] = useState(false);
  const [stage, setStage] = useState<ClockInStage>('activity');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedWorkAreaId, setSelectedWorkAreaId] = useState('');
  const [selectedUnbillableCategoryId, setSelectedUnbillableCategoryId] = useState('');
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(null);
  const [retryMeta, setRetryMeta] = useState<{ requestId: string; idempotencyKey: string; fingerprint: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advisoryForms, setAdvisoryForms] = useState<import('@/types/forms').EmployeeForm[]>([]);
  const [checkingForms, setCheckingForms] = useState(false);
  const advisoryAcceptedRef = useRef(false);
  const checkingFormsRef = useRef(false);
  const continuingWorkflowRef = useRef<string | null>(null);
  const redirectingActiveShiftRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const authoritativeActiveShift = currentActiveEntryId
    ? timeEntries.some((entry) => entry.id === currentActiveEntryId && entry.status === 'clocked_in')
    : false;

  useEffect(() => {
    const intent = pendingClockIn.workflow?.clockInIntent;
    if (!intent || intent.employeeId !== user?.employeeId) return;
    setSelectedWorkType(intent.workType);
    setActivityChosen(true);
    setSelectedJobId(intent.jobIds[0] ?? '');
    setSelectedWorkAreaId(intent.workAreaId ?? '');
    setSelectedUnbillableCategoryId(intent.unbillableCategoryId ?? '');
    setStage(intent.workType === 'job' ? (intent.workAreaId ? 'work_area' : 'job') : intent.workType === 'non_billable' ? 'category' : 'activity');
  }, [pendingClockIn.workflow?.workflowOccurrenceId, user?.employeeId]);

  useFocusEffect(useCallback(() => {
    if (authoritativeActiveShift) {
      if (pendingClockIn.workflow) void pendingClockIn.reconcileActiveShift();
      if (redirectingActiveShiftRef.current) return;
      redirectingActiveShiftRef.current = true;
      router.replace('/active-shift');
      return;
    }
    if (pendingClockIn.workflow) {
      redirectingActiveShiftRef.current = false;
      return;
    }
    if (effectiveClock.hydrated && (
      effectiveClock.effectiveStatus === 'clocked_in_pending'
      || effectiveClock.effectiveStatus === 'clocked_in_synced'
      || (effectiveClock.effectiveStatus === 'needs_attention' && effectiveClock.activeEntry)
    )) {
      if (redirectingActiveShiftRef.current) return;
      redirectingActiveShiftRef.current = true;
      router.replace('/active-shift');
      return;
    }
    redirectingActiveShiftRef.current = false;
  }, [authoritativeActiveShift, effectiveClock.activeEntry, effectiveClock.effectiveStatus, effectiveClock.hydrated, pendingClockIn.reconcileActiveShift, pendingClockIn.workflow]));

  const assignedJobs = useMemo(() => {
    const employeeId = user?.employeeId;
    const availableJobs = jobs.length > 0
      ? jobs
      : (offlineClock?.cache?.jobs ?? []).map((job) => ({ ...job, assignedEmployeeIds: employeeId ? [employeeId] : [] }));
    return scopeJobsForSession(availableJobs, user);
  }, [jobs, offlineClock?.cache?.jobs, user]);

  const activityOptions = useMemo<ActivityOption[]>(() => [
      {
        type: 'job',
        label: 'Job Work',
        help: 'Billable labor tied to a specific job.',
        requiresJob: true,
      },
      {
        type: 'drive_time',
        label: 'Drive Time',
        help: 'Travel between work locations.',
        requiresJob: false,
      },
      {
        type: 'non_billable',
        label: 'Unbillable Time',
        help: 'Paid work that is not billed to a job.',
        requiresJob: false,
      },
    ], []);

  const selectedActivity = useMemo(
    () => activityOptions.find((option) => option.type === selectedWorkType) ?? activityOptions[0],
    [activityOptions, selectedWorkType]
  );
  const selectedJob = useMemo(
    () => assignedJobs.find((job) => job.id === selectedJobId),
    [assignedJobs, selectedJobId],
  );

  const requiresJobSelection = activityChosen && selectedActivity?.requiresJob === true;
  const requiresUnbillableCategory = activityChosen && selectedWorkType === 'non_billable';
  const requiresWorkArea = selectedWorkType === 'job' && selectedJob?.hasOperationalWorkAreas === true;

  useEffect(() => {
    if (!requiresWorkArea || !selectedJob) {
      setSelectedWorkAreaId('');
      return;
    }
    const eligible = selectedJob.eligibleOperationalWorkAreas ?? [];
    if (eligible.length === 1) {
      setSelectedWorkAreaId(eligible[0].id);
      return;
    }
    if (!eligible.some((workArea) => workArea.id === selectedWorkAreaId)) {
      setSelectedWorkAreaId('');
    }
  }, [requiresWorkArea, selectedJob, selectedWorkAreaId]);

  useEffect(() => {
    if (!requiresUnbillableCategory) return;
    void loadUnbillableCategoriesIfNeeded();
  }, [loadUnbillableCategoriesIfNeeded, requiresUnbillableCategory]);

  useEffect(() => {
    if (!requiresUnbillableCategory) return;
    if (!selectedUnbillableCategoryId) return;

    const isStillValid = unbillableCategories.some((category) => category.id === selectedUnbillableCategoryId);
    if (!isStillValid) {
      setSelectedUnbillableCategoryId('');
    }
  }, [requiresUnbillableCategory, selectedUnbillableCategoryId, unbillableCategories]);

  const canSubmit = useMemo(() => {
    if (!activityChosen) return false;
    if (!user?.employeeId) return false;
    if (requiresJobSelection) {
      if (!selectedJobId) return false;
      if (requiresWorkArea) return Boolean(selectedWorkAreaId);
      return true;
    }
    if (requiresUnbillableCategory) {
      if (unbillableCategoriesLoading) return false;
      if (Boolean(unbillableCategoriesError)) return false;
      if (unbillableCategories.length === 0) return false;
      return Boolean(selectedUnbillableCategoryId);
    }
    return true;
  }, [
    requiresJobSelection,
    activityChosen,
    selectedJobId,
    requiresWorkArea,
    selectedWorkAreaId,
    user?.employeeId,
    requiresUnbillableCategory,
    unbillableCategoriesLoading,
    unbillableCategoriesError,
    unbillableCategories,
    selectedUnbillableCategoryId,
  ]);

  const clockInWorkflow = workflow?.originRoute === '/clock-in' && workflow.intent.kind === 'clock_in'
    ? { ...workflow, intent: workflow.intent }
    : null;

  const workflowStep = pendingClockIn.workflow || advisoryForms.length > 0 ? 'forms' : stage;
  const progressSteps = useMemo(() => {
    const finalStep = pendingClockIn.workflow || advisoryForms.length > 0 ? 'forms' : 'clock_in';
    if (!activityChosen || selectedWorkType === 'job') {
      return selectedJob && selectedJob.hasOperationalWorkAreas !== true
        ? ['activity', 'job', finalStep] as const
        : ['activity', 'job', 'work_area', finalStep] as const;
    }
    if (selectedWorkType === 'non_billable') {
      return ['activity', 'category', finalStep] as const;
    }
    return ['activity', finalStep] as const;
  }, [activityChosen, advisoryForms.length, pendingClockIn.workflow, selectedJob, selectedWorkType]);
  const progressIndex = Math.max(0, (progressSteps as readonly string[]).indexOf(workflowStep));

  function continueFromActivity() {
    if (!activityChosen) return;
    setError(null);
    if (selectedWorkType === 'job') {
      setStage('job');
      return;
    }
    if (selectedWorkType === 'non_billable') {
      setStage('category');
      return;
    }
    void submitOnce();
  }

  function continueFromJob() {
    if (!selectedJob) return;
    setError(null);
    if (selectedJob.hasOperationalWorkAreas === true) {
      setStage('work_area');
      return;
    }
    void submitOnce();
  }

  function goBack() {
    setError(null);
    if (stage === 'job' || stage === 'category') {
      setStage('activity');
      return;
    }
    if (stage === 'work_area') setStage('job');
  }

  async function submitOnce() {
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    try {
      await submitClockIn();
    } finally {
      submitInFlightRef.current = false;
    }
  }

  useEffect(() => {
    if (!clockInWorkflow || clockInWorkflow.intent.employeeId !== user?.employeeId) return;

    const intent = clockInWorkflow.intent;
    setSelectedWorkType(intent.workType);
    setActivityChosen(true);
    setSelectedJobId(intent.jobIds[0] ?? '');
    setSelectedWorkAreaId(intent.workAreaId ?? '');
    setSelectedUnbillableCategoryId(intent.unbillableCategoryId ?? '');
    setAdvisoryForms(clockInWorkflow.forms.slice(clockInWorkflow.completedCount));

    if (clockInWorkflow.completedCount < clockInWorkflow.forms.length) return;
    if (continuingWorkflowRef.current === clockInWorkflow.id) return;
    continuingWorkflowRef.current = clockInWorkflow.id;
    void submitClockIn(undefined, true, intent);
  }, [clockInWorkflow?.id, clockInWorkflow?.completedCount, user?.employeeId]);

  async function submitClockIn(
    metaOverride?: { requestId: string; idempotencyKey: string; fingerprint?: string },
    continuePastAdvisory = false,
    intentOverride?: Extract<FormsWorkflowIntent, { kind: 'clock_in' }>,
  ) {
    const employeeId = intentOverride?.employeeId ?? user?.employeeId;
    const workType = intentOverride?.workType ?? selectedWorkType;
    const jobIds = intentOverride?.jobIds ?? (selectedWorkType === 'non_billable'
      ? []
      : (selectedJobId ? [selectedJobId] : []));
    const unbillableCategoryId = intentOverride?.unbillableCategoryId ?? selectedUnbillableCategoryId;
    const workAreaId = intentOverride?.workAreaId ?? selectedWorkAreaId;
    const requestedClockInAt = intentOverride?.requestedClockInAt ?? (clockingCapabilities.adjustClockInTime && selectedStartTime
      ? businessLocalDateTimeToIso(businessDateKey(new Date(), businessTimeZone), selectedStartTime, businessTimeZone)
      : undefined);
    const targetJob = assignedJobs.find((job) => job.id === jobIds[0]);
    const selectedWorkArea = targetJob?.eligibleOperationalWorkAreas?.find((workArea) => workArea.id === workAreaId);

    if (!employeeId || employeeId !== user?.employeeId) {
      setError('Employee profile is not linked to this account.');
      return;
    }

    if (!intentOverride && !activityChosen) {
      setError('Choose what you are working on before clocking in.');
      return;
    }

    if (workType === 'job' && jobIds.length === 0) {
      setError('Select an assigned job before clocking in.');
      return;
    }

    if (workType === 'job' && targetJob?.hasOperationalWorkAreas === true && !selectedWorkArea) {
      setError(targetJob.eligibleOperationalWorkAreas?.length
        ? 'Select a Work Area before clocking in.'
        : 'This Job has no Work Areas available for clocking.');
      return;
    }

    if (workType === 'non_billable') {
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
      if (!unbillableCategoryId) {
        setError('Select an unbillable category before clocking in.');
        return;
      }
    }

    setStatus(null);
    setError(null);

    if (pendingClockIn.workflow) {
      if (pendingClockIn.phase.kind === 'ready_to_finalize') {
        const result = await pendingClockIn.finalize();
        if (result.ok) {
          await refreshWorkContext();
          router.replace('/active-shift');
        } else {
          setError(result.error);
        }
        return;
      }
      const form = await pendingClockIn.ensureCurrentForm();
      if (!form) {
        setError('The required pre-shift form is not available yet. Reconnect and try again.');
      }
      return;
    }

    if (!continuePastAdvisory && !advisoryAcceptedRef.current && !metaOverride) {
      if (checkingFormsRef.current) return;
      checkingFormsRef.current = true;
      setCheckingForms(true);
      const checks = [getRequiredForms('before_clock_in')];
      if (selectedWorkType === 'job' && selectedJobId) {
        checks.push(getRequiredForms('before_starting_job', { jobId: selectedJobId }));
      }
      const results = await Promise.all(checks);
      checkingFormsRef.current = false;
      setCheckingForms(false);
      const forms = results.flatMap((result, index) => result.ok
        ? result.forms.filter((form) => index !== 0
          || (form.completionRequirement !== 'required' && form.required !== true))
        : []);
      if (forms.length > 0) {
        startWorkflow({
          originRoute: '/clock-in',
          destination: '/active-shift',
          phase: 'pre_action',
          intent: {
            kind: 'clock_in',
            employeeId,
            workType,
            jobIds,
            workAreaId: workType === 'job' ? selectedWorkArea?.id : undefined,
            unbillableCategoryId: workType === 'non_billable' ? unbillableCategoryId : undefined,
            requestedClockInAt,
          },
          forms,
        });
        setAdvisoryForms(forms);
        return;
      }
      advisoryAcceptedRef.current = true;
    }

    const fingerprint = JSON.stringify({ employeeId, workType, jobIds, workAreaId: workType === 'job' ? selectedWorkArea?.id : undefined, unbillableCategoryId: workType === 'non_billable' ? unbillableCategoryId : undefined, requestedClockInAt });
    const reusableMeta = metaOverride?.fingerprint === fingerprint
      ? metaOverride
      : retryMeta?.fingerprint === fingerprint
        ? retryMeta
        : createRequestMeta(employeeId);
    const meta = { requestId: reusableMeta.requestId, idempotencyKey: reusableMeta.idempotencyKey };
    setRetryMeta({ ...meta, fingerprint });

    const result = selectedWorkArea
      ? requestedClockInAt
        ? await clockIn(
          employeeId,
          workType,
          jobIds,
          undefined,
          meta,
          { id: selectedWorkArea.id, name: selectedWorkArea.name },
          requestedClockInAt,
        )
        : await clockIn(
          employeeId,
          workType,
          jobIds,
          undefined,
          meta,
          { id: selectedWorkArea.id, name: selectedWorkArea.name },
        )
      : requestedClockInAt
        ? await clockIn(
          employeeId,
          workType,
          jobIds,
          workType === 'non_billable' ? unbillableCategoryId : undefined,
          meta,
          undefined,
          requestedClockInAt,
        )
        : await clockIn(
          employeeId,
          workType,
          jobIds,
          workType === 'non_billable' ? unbillableCategoryId : undefined,
          meta,
        );

    if (!result.ok) {
      setError(result.error || 'Clock-in failed.');
      return;
    }

    const pendingClockOutWorkflow = 'pendingClockOutWorkflow' in result ? result.pendingClockOutWorkflow : undefined;
    if (pendingClockOutWorkflow) {
      await pendingClockOut.acceptWorkflow(pendingClockOutWorkflow);
      setError('Complete the pending clock-out form before starting a new shift.');
      router.replace('/home');
      return;
    }

    const pendingWorkflow = 'pendingWorkflow' in result ? result.pendingWorkflow : undefined;
    if (pendingWorkflow) {
      await pendingClockIn.acceptWorkflow(pendingWorkflow);
      setRetryMeta(null);
      clearWorkflow();
      return;
    }

    setRetryMeta(null);
    clearWorkflow();
    setStatus('pendingSync' in result && result.pendingSync ? 'Clock-in saved on this device. It will sync when online.' : 'Clock-in submitted successfully.');
    router.replace('/active-shift');
  }

  return (
    <Screen>
      <OfflineNotice />
      <ScreenHeader title="Clock In" />
      <View style={styles.progress} testID="clock-in-progress">
        {progressSteps.map((step, index) => {
          const complete = index < progressIndex;
          const active = index === progressIndex;
          const label = step === 'work_area' ? 'Work Area' : step === 'clock_in' ? 'Clock In' : `${step.charAt(0).toUpperCase()}${step.slice(1)}`;
          return (
            <View key={step} style={styles.progressItem}>
              <Text style={[styles.progressText, active && styles.progressTextActive]}>{label}{complete ? ' ✓' : ''}</Text>
              {index < progressSteps.length - 1 ? <View style={[styles.progressLine, complete && styles.progressLineComplete]} /> : null}
            </View>
          );
        })}
      </View>
      {!pendingClockIn.workflow ? (
        <>
        {stage === 'activity' && advisoryForms.length === 0 ? (
          <>
            <ActivitySelector
            heading="What are you doing?"
            helper="Select your current activity."
            selectedType={activityChosen ? selectedWorkType : null}
            onSelect={(type) => {
              setSelectedWorkType(type);
              setActivityChosen(true);
              setSelectedJobId('');
              setSelectedWorkAreaId('');
              setSelectedUnbillableCategoryId('');
              setAdvisoryForms([]);
              advisoryAcceptedRef.current = false;
            }}
          />
          </>
        ) : null}

        {stage === 'job' && advisoryForms.length === 0 ? (
          <View style={styles.progressiveSection}>
            <SectionHeader title="Select a Job" />
            <Text style={styles.helper}>Choose the job you'll be working on.</Text>
            {assignedJobs.length === 0 ? (
              <StatusBanner
                tone={requiresJobSelection ? 'error' : 'info'}
                message={requiresJobSelection
                  ? 'No assigned active jobs available.'
                  : 'No assigned active jobs available. You can continue without a job context.'}
              />
            ) : (
              <SectionCard>
                {assignedJobs.map((job) => {
                  const selected = selectedJobId === job.id;
                  return (
                    <ListRow
                      key={job.id}
                      testID={`job-option-${job.id}`}
                      title={job.title || 'Untitled Job'}
                      subtitle={job.status.replace('_', ' ')}
                      selected={selected}
                      onPress={() => {
                        setSelectedJobId(job.id);
                        setSelectedWorkAreaId('');
                        setAdvisoryForms([]);
                        advisoryAcceptedRef.current = false;
                      }}
                    />
                  );
                })}
              </SectionCard>
            )}
          </View>
        ) : null}

        {stage === 'work_area' && selectedJob && advisoryForms.length === 0 ? (
          <View style={styles.progressiveSection}>
            <SectionHeader title="Select Work Area" />
            <Text style={styles.helper}>Choose the area you'll be working in.</Text>
            <WorkAreaSelector
              job={selectedJob}
              heading={null}
              selectedWorkAreaId={selectedWorkAreaId}
              onSelect={setSelectedWorkAreaId}
            />
          </View>
        ) : null}

        {stage === 'category' && requiresUnbillableCategory && advisoryForms.length === 0 ? (
          <View style={styles.progressiveSection}>
            <SectionHeader title="Select a Category" />
            <Text style={styles.helper}>Choose the type of unbillable work.</Text>
            <UnbillableCategorySelector
              heading={null}
              categories={unbillableCategories}
              selectedCategoryId={selectedUnbillableCategoryId}
              loading={unbillableCategoriesLoading}
              error={unbillableCategoriesError}
              onSelect={setSelectedUnbillableCategoryId}
              onRetry={() => { void retryUnbillableCategories(); }}
            />
          </View>
        ) : null}
        {stage !== 'activity' && canSubmit && clockingCapabilities.adjustClockInTime && advisoryForms.length === 0 ? (
          <StartTimeField
            value={selectedStartTime}
            businessTimeZone={businessTimeZone}
            disabled={loading || checkingForms}
            onChange={setSelectedStartTime}
          />
        ) : null}
        </>
      ) : null}

      {status ? <StatusBanner tone="success" message={status} /> : null}
      {error ? <StatusBanner tone="error" message={error} /> : null}

      {pendingClockIn.workflow && pendingClockIn.phase?.kind === 'ready_to_finalize' ? (
        <View style={styles.progressiveSection}>
          <StatusBanner tone="success" message="Required forms complete" />
          <Text style={styles.helper}>{pendingClockIn.error ? 'Clock-in still needs to be finished.' : 'Finishing clock in...'}</Text>
          {pendingClockIn.error ? (
            <PrimaryActionButton
              label={pendingClockIn.busy ? 'Finishing Clock In...' : 'Retry Finish Clock In'}
              disabled={pendingClockIn.busy}
              onPress={() => {
                void pendingClockIn.finalize().then(async (result) => {
                  if (!result.ok) return;
                  await refreshWorkContext();
                  router.replace('/active-shift');
                });
              }}
            />
          ) : null}
        </View>
      ) : pendingClockIn.workflow && pendingClockIn.currentForm ? (
        <AdvisoryFormsPrompt
          forms={[pendingClockIn.currentForm]}
          heading="Complete Required Form"
          message={`Required form ${pendingClockIn.completedCount + 1} of ${pendingClockIn.totalCount}`}
          completeLabel="Complete Form"
          completedCount={pendingClockIn.completedCount}
          totalCount={pendingClockIn.totalCount}
          onComplete={() => {
            if (!pendingClockIn.currentForm || !pendingClockIn.currentRequirement || !pendingClockIn.workflow) return;
            router.push({
              pathname: '/form',
              params: {
                formId: pendingClockIn.currentForm.id,
                trigger: 'before_clock_in',
                workflowOccurrenceId: pendingClockIn.workflow.workflowOccurrenceId,
                workflowRequirementId: pendingClockIn.currentRequirement.requirementId,
              },
            });
          }}
        />
      ) : pendingClockIn.workflow ? (
        <PrimaryActionButton
          label={pendingClockIn.busy ? 'Refreshing Required Form...' : 'Refresh Required Form'}
          disabled={pendingClockIn.busy}
          onPress={() => {
            setError(null);
            void pendingClockIn.ensureCurrentForm().then((form) => {
              if (!form) setError('Required form could not be loaded. Check your connection and try again.');
            });
          }}
        />
      ) : advisoryForms.length > 0 ? (
        <AdvisoryFormsPrompt
          forms={advisoryForms}
          heading="Pre-shift"
          message={`${advisoryForms.length} form${advisoryForms.length === 1 ? '' : 's'} before starting`}
          completeLabel={clockInWorkflow?.completedCount ? 'Complete Next Form' : 'Complete Form'}
          skipLabel="Skip for Now"
          completedCount={clockInWorkflow?.completedCount}
          totalCount={clockInWorkflow?.forms.length}
          cancelLabel="Cancel Clock In"
          onComplete={(form) => {
            const activeWorkflow = clockInWorkflow;
            if (activeWorkflow) {
              router.push({
                pathname: '/form',
                params: {
                  list: 'todo', formId: form.id, trigger: form.trigger,
                  jobId: form.context?.jobId, equipmentId: form.context?.equipmentId,
                  divisionId: form.context?.divisionId, workflowId: activeWorkflow.id,
                },
              });
              return;
            }
            void refreshForms({ force: true });
          }}
          onSkip={() => {
            const intent = clockInWorkflow?.intent;
            void submitClockIn(undefined, true, intent?.kind === 'clock_in' ? intent : undefined);
          }}
          onCancel={() => {
            clearWorkflow();
            setAdvisoryForms([]);
            router.replace('/home');
          }}
        />
      ) : stage === 'activity' ? (
        <PrimaryActionButton label="Continue" disabled={!activityChosen || loading || checkingForms} onPress={continueFromActivity} />
      ) : (
        <View style={styles.actions}>
          <SecondaryButton label="Back" onPress={goBack} />
          <PrimaryActionButton
            label={loading ? 'Clocking in...' : checkingForms ? 'Checking Forms...' : 'Continue'}
            disabled={(stage === 'job' ? !selectedJobId : !canSubmit) || loading || checkingForms}
            onPress={stage === 'job' ? continueFromJob : () => void submitOnce()}
          />
        </View>
      )}

      {error && retryMeta ? (
        <PrimaryActionButton
          label="Retry Clock In"
          disabled={loading}
          onPress={() => void submitClockIn(retryMeta)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressiveSection: { gap: 8 },
  actions: { gap: 8 },
  helper: { color: colors.textSecondary, fontSize: 14, marginTop: -4 },
  progress: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  progressItem: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  progressText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  progressTextActive: { color: colors.primary, fontWeight: '700' },
  progressLine: { width: 14, height: 1, backgroundColor: colors.divider, marginHorizontal: 6 },
  progressLineComplete: { backgroundColor: colors.primary },
});
