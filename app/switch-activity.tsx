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
import { getWorkTypeLabel, resolveCurrentActiveEntry, resolveJobTitle } from '@/features/clocking/presentation';
import { useClockingActions } from '@/hooks/useClockingActions';
import { useFormsActions } from '@/hooks/useFormsActions';
import { useUnbillableCategories } from '@/hooks/useUnbillableCategories';
import { createRequestMeta } from '@/services/requestGuards';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { colors } from '@/theme/colors';
import type { TimeEntryWorkType } from '@/types/domain';
import type { EmployeeForm } from '@/types/forms';

type ActivityOption = {
  type: TimeEntryWorkType;
  label: string;
  help: string;
  requiresJob: boolean;
};

export default function SwitchActivityScreen() {
  const { user } = useAuthStore();
  const { currentActiveEntryId, jobs, timeEntries } = useClockingStore();
  const { loading, refreshWorkContext, switchActivity } = useClockingActions();
  const { getRequiredForms, refreshForms } = useFormsActions();
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
  const [advisoryForms, setAdvisoryForms] = useState<EmployeeForm[]>([]);
  const [postActionForms, setPostActionForms] = useState<EmployeeForm[]>([]);
  const [checkingForms, setCheckingForms] = useState(false);
  const advisoryAcceptedRef = useRef(false);
  const checkingFormsRef = useRef(false);

  useEffect(() => {
    void refreshWorkContext();
  }, [refreshWorkContext]);

  const activeEntry = useMemo(() => {
    return resolveCurrentActiveEntry(timeEntries, user?.employeeId, currentActiveEntryId);
  }, [currentActiveEntryId, timeEntries, user?.employeeId]);

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
    if (!activeEntry) return false;
    if (requiresJobSelection) return Boolean(selectedJobId);
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
    requiresUnbillableCategory,
    unbillableCategoriesLoading,
    unbillableCategoriesError,
    unbillableCategories,
    selectedUnbillableCategoryId,
  ]);

  async function submitSwitch(
    metaOverride?: { requestId: string; idempotencyKey: string },
    continuePastAdvisory = false,
  ) {
    if (!activeEntry || !user?.employeeId) {
      setError('No active shift found.');
      return;
    }

    if (!activityChosen) {
      setError('Choose what you are switching to.');
      return;
    }

    if (requiresJobSelection && !selectedJobId) {
      setError('Select a job before switching to job work.');
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
      if (!selectedUnbillableCategoryId) {
        setError('Select an unbillable category before switching activity.');
        return;
      }
    }

    setStatus(null);
    setError(null);

    const previousJobId = activeEntry.jobIds?.[0] ?? activeEntry.jobId;
    const nextJobId = selectedWorkType === 'job' ? selectedJobId : undefined;
    if (!continuePastAdvisory && !advisoryAcceptedRef.current && !metaOverride && nextJobId && nextJobId !== previousJobId) {
      if (checkingFormsRef.current) return;
      checkingFormsRef.current = true;
      setCheckingForms(true);
      const advisory = await getRequiredForms('before_starting_job', { jobId: nextJobId });
      checkingFormsRef.current = false;
      setCheckingForms(false);
      if (advisory.ok && advisory.forms.length > 0) {
        setAdvisoryForms(advisory.forms);
        return;
      }
      advisoryAcceptedRef.current = true;
    }

    const meta = metaOverride ?? retryMeta ?? createRequestMeta(user.employeeId);
    setRetryMeta(meta);

    const nextJobIds = selectedWorkType === 'non_billable'
      ? []
      : (selectedJobId ? [selectedJobId] : []);

    const result = await switchActivity(
      selectedWorkType,
      nextJobIds,
      selectedWorkType === 'non_billable' ? selectedUnbillableCategoryId : undefined,
      meta,
    );
    if (!result.ok) {
      setError(result.error || 'Could not switch activity.');
      return;
    }

    setRetryMeta(null);
    setStatus('Activity switched successfully.');
    if (previousJobId && previousJobId !== nextJobId) {
      const advisory = await getRequiredForms('after_completing_job', { jobId: previousJobId });
      if (advisory.ok && advisory.forms.length > 0) {
        setPostActionForms(advisory.forms);
        return;
      }
    }
    router.replace('/active-shift');
  }

  return (
    <Screen>
      <OfflineNotice />
      <ScreenHeader title="Switch Activity" subtitle={activeEntry ? `Currently ${getWorkTypeLabel(activeEntry.workType)}` : undefined} />
        {!activeEntry ? (
          <StatusBanner tone="info" message="No active shift found. Clock in before switching activity." />
        ) : (
          <>
            <ActivitySelector
              heading="What are you switching to?"
              testIDPrefix="switch-activity-option"
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
                          testID={`switch-job-option-${job.id}`}
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
          </>
        )}

      {status ? <StatusBanner tone="success" message={status} /> : null}
      {error ? <StatusBanner tone="error" message={error} /> : null}

      {advisoryForms.length > 0 ? (
        <AdvisoryFormsPrompt
          forms={advisoryForms}
          heading="Form to complete before continuing"
          message="You can complete it now or continue switching jobs."
          skipLabel="Continue Anyway"
          onComplete={(form) => {
            void refreshForms({ force: true }).then((result) => {
              if (!result.ok) return router.push('/forms');
              router.push({
                pathname: '/form',
                params: {
                  list: 'todo', formId: form.id, trigger: form.trigger,
                  jobId: form.context?.jobId, equipmentId: form.context?.equipmentId,
                  divisionId: form.context?.divisionId, returnTo: '/switch-activity',
                },
              });
            });
          }}
          onSkip={() => { void submitSwitch(undefined, true); }}
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
          onSkip={() => router.replace('/active-shift')}
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
  list: {
    gap: 10,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  row: {
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
  rowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.inputFocusBackground,
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '600',
  },
  rowMeta: {
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