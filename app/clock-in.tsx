import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { OfflineNotice } from '@/components/OfflineNotice';
import { AdvisoryFormsPrompt } from '@/components/AdvisoryFormsPrompt';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { UnbillableCategorySelector } from '@/components/UnbillableCategorySelector';
import { ActivitySelector } from '@/components/ActivitySelector';
import { ListRow, ScreenHeader, SectionHeader } from '@/components/MobilePrimitives';
import { useClockingActions } from '@/hooks/useClockingActions';
import { useFormsActions } from '@/hooks/useFormsActions';
import { useUnbillableCategories } from '@/hooks/useUnbillableCategories';
import { createRequestMeta } from '@/services/requestGuards';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { useFormsWorkflowStore, type FormsWorkflowIntent } from '@/store/formsWorkflowStore';
import { colors } from '@/theme/colors';
import type { TimeEntryWorkType } from '@/types/domain';

type ActivityOption = {
  type: TimeEntryWorkType;
  label: string;
  help: string;
  requiresJob: boolean;
};

export default function ClockInScreen() {
  const { user } = useAuthStore();
  const { jobs } = useClockingStore();
  const { clockIn, loading, refreshWorkContext } = useClockingActions();
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
  const [selectedUnbillableCategoryId, setSelectedUnbillableCategoryId] = useState('');
  const [retryMeta, setRetryMeta] = useState<{ requestId: string; idempotencyKey: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advisoryForms, setAdvisoryForms] = useState<import('@/types/forms').EmployeeForm[]>([]);
  const [checkingForms, setCheckingForms] = useState(false);
  const advisoryAcceptedRef = useRef(false);
  const checkingFormsRef = useRef(false);
  const continuingWorkflowRef = useRef<string | null>(null);

  useEffect(() => {
    void refreshWorkContext();
  }, [refreshWorkContext]);

  const assignedJobs = useMemo(() => {
    const employeeId = user?.employeeId;
    return jobs.filter((job) => {
      if (job.status !== 'scheduled' && job.status !== 'in_progress') return false;
      if (!employeeId) return true;
      if (!Array.isArray(job.assignedEmployeeIds) || job.assignedEmployeeIds.length === 0) return true;
      return job.assignedEmployeeIds.includes(employeeId);
    });
  }, [jobs, user?.employeeId]);

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

  const showJobSelection = activityChosen && selectedWorkType === 'job';
  const requiresJobSelection = activityChosen && selectedActivity?.requiresJob === true;
  const requiresUnbillableCategory = activityChosen && selectedWorkType === 'non_billable';

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
    if (requiresJobSelection) return Boolean(selectedJobId);
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

  useEffect(() => {
    if (!clockInWorkflow || clockInWorkflow.intent.employeeId !== user?.employeeId) return;

    const intent = clockInWorkflow.intent;
    setSelectedWorkType(intent.workType);
    setActivityChosen(true);
    setSelectedJobId(intent.jobIds[0] ?? '');
    setSelectedUnbillableCategoryId(intent.unbillableCategoryId ?? '');
    setAdvisoryForms(clockInWorkflow.forms.slice(clockInWorkflow.completedCount));

    if (clockInWorkflow.completedCount < clockInWorkflow.forms.length) return;
    if (continuingWorkflowRef.current === clockInWorkflow.id) return;
    continuingWorkflowRef.current = clockInWorkflow.id;
    void submitClockIn(undefined, true, intent);
  }, [clockInWorkflow, user?.employeeId]);

  async function submitClockIn(
    metaOverride?: { requestId: string; idempotencyKey: string },
    continuePastAdvisory = false,
    intentOverride?: Extract<FormsWorkflowIntent, { kind: 'clock_in' }>,
  ) {
    const employeeId = intentOverride?.employeeId ?? user?.employeeId;
    const workType = intentOverride?.workType ?? selectedWorkType;
    const jobIds = intentOverride?.jobIds ?? (selectedWorkType === 'non_billable'
      ? []
      : (selectedJobId ? [selectedJobId] : []));
    const unbillableCategoryId = intentOverride?.unbillableCategoryId ?? selectedUnbillableCategoryId;

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
      const forms = results.flatMap((result) => result.ok ? result.forms : []);
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
            unbillableCategoryId: workType === 'non_billable' ? unbillableCategoryId : undefined,
          },
          forms,
        });
        setAdvisoryForms(forms);
        return;
      }
      advisoryAcceptedRef.current = true;
    }

    const meta = metaOverride ?? retryMeta ?? createRequestMeta(employeeId);
    setRetryMeta(meta);

    const result = await clockIn(
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

    setRetryMeta(null);
  clearWorkflow();
    setStatus('Clock-in submitted successfully.');
    router.replace('/active-shift');
  }

  return (
    <Screen>
      <OfflineNotice />
      <ScreenHeader title="Clock In" subtitle="Start a new shift" />
      <ActivitySelector
        heading="What are you working on?"
        selectedType={activityChosen ? selectedWorkType : null}
        onSelect={(type) => {
          setSelectedWorkType(type);
          setActivityChosen(true);
          setSelectedJobId('');
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
                  ? 'No assigned scheduled/in-progress jobs available.'
                  : 'No assigned scheduled/in-progress jobs available. You can continue without a job context.'}
              />
            ) : (
              <View style={styles.selectionList}>
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
                        setAdvisoryForms([]);
                        advisoryAcceptedRef.current = false;
                      }}
                    />
                  );
                })}
              </View>
            )}
          </View>
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

      {status ? <StatusBanner tone="success" message={status} /> : null}
      {error ? <StatusBanner tone="error" message={error} /> : null}

      {advisoryForms.length > 0 ? (
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
      ) : (
        <PrimaryActionButton
          label={loading ? 'Clocking in...' : checkingForms ? 'Checking Forms...' : 'Clock In'}
          disabled={!canSubmit || loading || checkingForms}
          onPress={() => void submitClockIn()}
        />
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
  selectionList: { borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.surface, paddingHorizontal: 12 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 10,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  help: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  jobsList: {
    gap: 10,
  },
  jobRow: {
    minHeight: 64,
    borderRadius: 12,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  jobRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.inputFocusBackground,
  },
  jobTextBlock: {
    flex: 1,
    gap: 4,
  },
  jobTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '600',
  },
  jobMeta: {
    color: colors.textSecondary,
    fontSize: 14,
    textTransform: 'capitalize',
  },
  checkDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkDotSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkMark: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
});
