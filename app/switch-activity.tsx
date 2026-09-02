import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { OfflineNotice } from '@/components/OfflineNotice';
import { AdvisoryFormsPrompt } from '@/components/AdvisoryFormsPrompt';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { UnbillableCategorySelector } from '@/components/UnbillableCategorySelector';
import { WorkAreaSelector } from '@/components/WorkAreaSelector';
import { ActivitySelector } from '@/components/ActivitySelector';
import { InfoRow, ListRow, ScreenHeader, SectionCard, SectionHeader } from '@/components/MobilePrimitives';
import { getWorkTypeLabel, resolveJobTitle, resolveWorkAreaName } from '@/features/clocking/presentation';
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
import type { TimeEntryWorkType } from '@/types/domain';
import type { EmployeeForm } from '@/types/forms';
import { returnToParentOrReplace } from '@/utils/navigation';

type ActivityOption = {
  type: TimeEntryWorkType;
  label: string;
  help: string;
  requiresJob: boolean;
};

export default function SwitchActivityScreen() {
  const { user } = useAuthStore();
  const { jobs } = useClockingStore();
  const offlineClock = useOptionalOfflineClockStore();
  const effectiveClock = useEffectiveClockState();
  const { loading, refreshWorkContext, switchActivity } = useClockingActions();
  const { getRequiredForms, refreshForms } = useFormsActions();
  const { workflow, startWorkflow, clearWorkflow } = useFormsWorkflowStore();
  const {
    categories: unbillableCategories,
    loading: unbillableCategoriesLoading,
    error: unbillableCategoriesError,
    loadIfNeeded: loadUnbillableCategoriesIfNeeded,
    retry: retryUnbillableCategories,
  } = useUnbillableCategories();
  const [selectedWorkType, setSelectedWorkType] = useState<TimeEntryWorkType>('job');
  const [activityChosen, setActivityChosen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedWorkAreaId, setSelectedWorkAreaId] = useState('');
  const [selectedUnbillableCategoryId, setSelectedUnbillableCategoryId] = useState('');
  const [retryMeta, setRetryMeta] = useState<{ requestId: string; idempotencyKey: string; fingerprint: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advisoryForms, setAdvisoryForms] = useState<EmployeeForm[]>([]);
  const [postActionForms, setPostActionForms] = useState<EmployeeForm[]>([]);
  const [checkingForms, setCheckingForms] = useState(false);
  const advisoryAcceptedRef = useRef(false);
  const checkingFormsRef = useRef(false);
  const continuingWorkflowRef = useRef<string | null>(null);

  useEffect(() => {
    void refreshWorkContext();
  }, [refreshWorkContext]);

  const activeEntry = effectiveClock.activeEntry;

  useEffect(() => {
    if (effectiveClock.hydrated && effectiveClock.effectiveStatus === 'clocked_out_pending') {
      router.replace('/home');
    }
  }, [effectiveClock.effectiveStatus, effectiveClock.hydrated]);

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

  const showJobSelection = activityChosen && selectedWorkType === 'job';
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
    if (!activeEntry) return false;
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
    activeEntry,
    activityChosen,
    requiresJobSelection,
    selectedJobId,
    requiresWorkArea,
    selectedWorkAreaId,
    requiresUnbillableCategory,
    unbillableCategoriesLoading,
    unbillableCategoriesError,
    unbillableCategories,
    selectedUnbillableCategoryId,
  ]);

  const preSwitchWorkflow = workflow?.originRoute === '/switch-activity' && workflow.intent.kind === 'switch_activity'
    ? { ...workflow, intent: workflow.intent }
    : null;
  const postSwitchWorkflow = workflow?.originRoute === '/switch-activity' && workflow.intent.kind === 'switch_activity_follow_up'
    ? { ...workflow, intent: workflow.intent }
    : null;

  useEffect(() => {
    if (!preSwitchWorkflow || preSwitchWorkflow.intent.employeeId !== user?.employeeId) return;

    const intent = preSwitchWorkflow.intent;
    setSelectedWorkType(intent.workType);
    setActivityChosen(true);
    setSelectedJobId(intent.jobIds[0] ?? '');
    setSelectedWorkAreaId(intent.workAreaId ?? '');
    setSelectedUnbillableCategoryId(intent.unbillableCategoryId ?? '');
    setAdvisoryForms(preSwitchWorkflow.forms.slice(preSwitchWorkflow.completedCount));

    if (preSwitchWorkflow.completedCount < preSwitchWorkflow.forms.length) return;
    if (continuingWorkflowRef.current === preSwitchWorkflow.id) return;
    continuingWorkflowRef.current = preSwitchWorkflow.id;
    void submitSwitch(undefined, true, intent);
  }, [preSwitchWorkflow?.id, preSwitchWorkflow?.completedCount, user?.employeeId]);

  async function submitSwitch(
    metaOverride?: { requestId: string; idempotencyKey: string; fingerprint?: string },
    continuePastAdvisory = false,
    intentOverride?: Extract<FormsWorkflowIntent, { kind: 'switch_activity' }>,
  ) {
    const employeeId = intentOverride?.employeeId ?? user?.employeeId;
    const workType = intentOverride?.workType ?? selectedWorkType;
    const jobIds = intentOverride?.jobIds ?? (selectedWorkType === 'non_billable'
      ? []
      : (selectedJobId ? [selectedJobId] : []));
    const unbillableCategoryId = intentOverride?.unbillableCategoryId ?? selectedUnbillableCategoryId;
    const workAreaId = intentOverride?.workAreaId ?? selectedWorkAreaId;
    const targetJob = assignedJobs.find((job) => job.id === jobIds[0]);
    const selectedWorkArea = targetJob?.eligibleOperationalWorkAreas?.find((workArea) => workArea.id === workAreaId);

    if (!activeEntry || !employeeId || employeeId !== user?.employeeId) {
      setError('No active shift found.');
      return;
    }

    if (intentOverride && activeEntry.id !== intentOverride.activeEntryId) {
      clearWorkflow();
      setError('Your active shift changed. Choose the activity again before switching.');
      return;
    }

    if (!intentOverride && !activityChosen) {
      setError('Choose what you are switching to.');
      return;
    }

    if (workType === 'job' && jobIds.length === 0) {
      setError('Select a job before switching to job work.');
      return;
    }

    if (workType === 'job' && targetJob?.hasOperationalWorkAreas === true && !selectedWorkArea) {
      setError(targetJob.eligibleOperationalWorkAreas?.length
        ? 'Select a Work Area before switching activity.'
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
        setError('Select an unbillable category before switching activity.');
        return;
      }
    }

    setStatus(null);
    setError(null);

    const previousJobId = activeEntry.jobIds?.[0] ?? activeEntry.jobId;
    const nextJobId = workType === 'job' ? jobIds[0] : undefined;
    if (!continuePastAdvisory && !advisoryAcceptedRef.current && !metaOverride && nextJobId && nextJobId !== previousJobId) {
      if (checkingFormsRef.current) return;
      checkingFormsRef.current = true;
      setCheckingForms(true);
      const advisory = await getRequiredForms('before_starting_job', { jobId: nextJobId });
      checkingFormsRef.current = false;
      setCheckingForms(false);
      if (advisory.ok && advisory.forms.length > 0) {
        startWorkflow({
          originRoute: '/switch-activity',
          destination: '/active-shift',
          phase: 'pre_action',
          intent: {
            kind: 'switch_activity',
            employeeId,
            activeEntryId: activeEntry.id,
            workType,
            jobIds,
            workAreaId: workType === 'job' ? selectedWorkArea?.id : undefined,
            unbillableCategoryId: workType === 'non_billable' ? unbillableCategoryId : undefined,
          },
          forms: advisory.forms,
        });
        setAdvisoryForms(advisory.forms);
        return;
      }
      advisoryAcceptedRef.current = true;
    }

    const fingerprint = JSON.stringify({ employeeId, activeEntryId: activeEntry.id, workType, jobIds, workAreaId: workType === 'job' ? selectedWorkArea?.id : undefined, unbillableCategoryId: workType === 'non_billable' ? unbillableCategoryId : undefined });
    const reusableMeta = metaOverride?.fingerprint === fingerprint
      ? metaOverride
      : retryMeta?.fingerprint === fingerprint
        ? retryMeta
        : createRequestMeta(employeeId);
    const meta = { requestId: reusableMeta.requestId, idempotencyKey: reusableMeta.idempotencyKey };
    setRetryMeta({ ...meta, fingerprint });

    const result = selectedWorkArea
      ? await switchActivity(
          workType,
          jobIds,
          undefined,
          meta,
          { id: selectedWorkArea.id, name: selectedWorkArea.name },
        )
      : await switchActivity(
          workType,
          jobIds,
          workType === 'non_billable' ? unbillableCategoryId : undefined,
          meta,
        );
    if (!result.ok) {
      setError(result.error || 'Could not switch activity.');
      return;
    }

    setRetryMeta(null);
    setStatus('pendingSync' in result && result.pendingSync ? 'Activity change saved on this device. It will sync when online.' : 'Activity switched successfully.');
    if (previousJobId && previousJobId !== nextJobId) {
      const advisory = await getRequiredForms('after_leaving_job', { jobId: previousJobId });
      if (advisory.ok && advisory.forms.length > 0) {
        startWorkflow({
          originRoute: '/switch-activity',
          destination: '/active-shift',
          phase: 'post_action',
          intent: { kind: 'switch_activity_follow_up' },
          forms: advisory.forms,
        });
        setPostActionForms(advisory.forms);
        return;
      }
    }
    clearWorkflow();
    returnToParentOrReplace('/active-shift');
  }

  if (postSwitchWorkflow) {
    const remainingForms = postSwitchWorkflow.forms.slice(postSwitchWorkflow.completedCount);
    const allCompleted = remainingForms.length === 0;
    return (
      <Screen>
        <OfflineNotice />
        <ScreenHeader title={allCompleted ? 'Activity complete' : 'Activity switched'} subtitle="Your work activity has been updated" />
        <StatusBanner tone="success" message="Activity switch complete" />
        {allCompleted ? (
          <PrimaryActionButton
            label="Done"
            onPress={() => {
              clearWorkflow();
              returnToParentOrReplace('/active-shift');
            }}
          />
        ) : (
          <AdvisoryFormsPrompt
            forms={remainingForms}
            heading={`${remainingForms.length} form${remainingForms.length === 1 ? '' : 's'} need${remainingForms.length === 1 ? 's' : ''} your attention`}
            message="Your activity switch is complete."
            completeLabel={postSwitchWorkflow.completedCount > 0 ? 'Complete Next Form' : 'Complete Form'}
            skipLabel="Do Later"
            completedCount={postSwitchWorkflow.completedCount}
            totalCount={postSwitchWorkflow.forms.length}
            onComplete={(form) => router.push({
              pathname: '/form',
              params: {
                list: 'todo', formId: form.id, trigger: form.trigger,
                jobId: form.context?.jobId, equipmentId: form.context?.equipmentId,
                divisionId: form.context?.divisionId, workflowId: postSwitchWorkflow.id,
              },
            })}
            onSkip={() => {
              clearWorkflow();
              returnToParentOrReplace('/active-shift');
            }}
          />
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <OfflineNotice />
      <ScreenHeader title="Switch Activity" subtitle="Update what you're working on without ending your shift" />
        {!activeEntry ? (
          <StatusBanner tone="info" message="No active shift found. Clock in before switching activity." />
        ) : (
          <>
            <View style={styles.currentSection}>
              <SectionHeader title="Current" />
              <SectionCard>
                <InfoRow label="Activity" value={getWorkTypeLabel(activeEntry.workType)} emphasis />
                {activeEntry.workType !== 'drive_time' ? <InfoRow label="Job" value={resolveJobTitle(activeEntry, assignedJobs)} /> : null}
                {resolveWorkAreaName(activeEntry) ? <InfoRow label="Work Area" value={resolveWorkAreaName(activeEntry) || ''} /> : null}
              </SectionCard>
            </View>
            <ActivitySelector
              heading="What are you switching to?"
              testIDPrefix="switch-activity-option"
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

            {showJobSelection ? (
              <View style={styles.progressiveSection}>
                <SectionHeader title="Which job?" />
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
                          testID={`switch-job-option-${job.id}`}
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

            {showJobSelection && selectedJob ? (
              <WorkAreaSelector
                job={selectedJob}
                selectedWorkAreaId={selectedWorkAreaId}
                onSelect={setSelectedWorkAreaId}
                testIDPrefix="switch-work-area-option"
              />
            ) : null}

            {activityChosen && selectedWorkType === 'drive_time' ? (
              <StatusBanner tone="info" message="No job is required for Drive Time." />
            ) : null}

            {requiresUnbillableCategory ? (
              <View style={styles.progressiveSection}>
                <SectionHeader title="What are you doing?" />
                <UnbillableCategorySelector
                  categories={unbillableCategories}
                  selectedCategoryId={selectedUnbillableCategoryId}
                  loading={unbillableCategoriesLoading}
                  error={unbillableCategoriesError}
                  onSelect={setSelectedUnbillableCategoryId}
                  onRetry={() => { void retryUnbillableCategories(); }}
                />
              </View>
            ) : null}
          </>
        )}

      {status ? <StatusBanner tone="success" message={status} /> : null}
      {error ? <StatusBanner tone="error" message={error} /> : null}

      {advisoryForms.length > 0 ? (
        <AdvisoryFormsPrompt
          forms={advisoryForms}
          heading="Form to complete before continuing"
          message="You can complete it now or continue switching jobs."
          skipLabel="Skip for Now"
          completedCount={preSwitchWorkflow?.completedCount}
          totalCount={preSwitchWorkflow?.forms.length}
          cancelLabel="Cancel Switch"
          onComplete={(form) => {
            if (preSwitchWorkflow) {
              router.push({
                pathname: '/form',
                params: {
                  list: 'todo', formId: form.id, trigger: form.trigger,
                  jobId: form.context?.jobId, equipmentId: form.context?.equipmentId,
                  divisionId: form.context?.divisionId, workflowId: preSwitchWorkflow.id,
                },
              });
              return;
            }
            void refreshForms({ force: true });
          }}
          onSkip={() => {
            const intent = preSwitchWorkflow?.intent;
            void submitSwitch(undefined, true, intent?.kind === 'switch_activity' ? intent : undefined);
          }}
          onCancel={() => {
            clearWorkflow();
            setAdvisoryForms([]);
            returnToParentOrReplace('/active-shift');
          }}
        />
      ) : postActionForms.length > 0 ? (
        <AdvisoryFormsPrompt
          forms={postActionForms}
          heading={`${postActionForms.length} form${postActionForms.length === 1 ? '' : 's'} need${postActionForms.length === 1 ? 's' : ''} your attention`}
          message="Your activity switch is complete."
          skipLabel="Do Later"
          onComplete={(form) => {
            void refreshForms({ force: true }).then((result) => {
              if (!result.ok) return router.replace('/forms');
              router.replace({
                pathname: '/form',
                params: {
                  list: 'todo', formId: form.id, trigger: form.trigger,
                  jobId: form.context?.jobId, equipmentId: form.context?.equipmentId,
                  divisionId: form.context?.divisionId, returnTo: '/active-shift',
                },
              });
            });
          }}
          onSkip={() => returnToParentOrReplace('/active-shift')}
        />
      ) : (
        <PrimaryActionButton
          label={loading ? 'Switching...' : checkingForms ? 'Checking Forms...' : 'Switch Activity'}
          disabled={!canSubmit || loading || checkingForms}
          onPress={() => void submitSwitch()}
        />
      )}

      {error && retryMeta ? (
        <PrimaryActionButton
          label="Retry Switch Activity"
          disabled={loading}
          onPress={() => void submitSwitch(retryMeta)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressiveSection: { gap: 8 },
  currentSection: { gap: 8 },
});