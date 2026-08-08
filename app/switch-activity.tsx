import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { OfflineNotice } from '@/components/OfflineNotice';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { UnbillableCategorySelector } from '@/components/UnbillableCategorySelector';
import { getWorkTypeLabel, resolveCurrentActiveEntry, resolveJobTitle } from '@/features/clocking/presentation';
import { useClockingActions } from '@/hooks/useClockingActions';
import { useUnbillableCategories } from '@/hooks/useUnbillableCategories';
import { createRequestMeta } from '@/services/requestGuards';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { colors } from '@/theme/colors';
import type { TimeEntryWorkType } from '@/types/domain';

type ActivityOption = {
  type: TimeEntryWorkType;
  label: string;
  help: string;
  requiresJob: boolean;
};

export default function SwitchActivityScreen() {
  const { user, capabilities } = useAuthStore();
  const { currentActiveEntryId, jobs, timeEntries } = useClockingStore();
  const { loading, refreshWorkContext, switchActivity } = useClockingActions();
  const {
    categories: unbillableCategories,
    loading: unbillableCategoriesLoading,
    error: unbillableCategoriesError,
    loadIfNeeded: loadUnbillableCategoriesIfNeeded,
    retry: retryUnbillableCategories,
  } = useUnbillableCategories();
  const [selectedWorkType, setSelectedWorkType] = useState<TimeEntryWorkType>('job');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedUnbillableCategoryId, setSelectedUnbillableCategoryId] = useState('');
  const [retryMeta, setRetryMeta] = useState<{ requestId: string; idempotencyKey: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const activityOptions = useMemo<ActivityOption[]>(() => {
    const options: ActivityOption[] = [
      {
        type: 'job',
        label: 'Job Work',
        help: 'Billable labor tied to a specific job.',
        requiresJob: true,
      },
      {
        type: 'non_billable',
        label: 'Unbillable Time',
        help: 'Paid work that is not billed to a job.',
        requiresJob: false,
      },
    ];

    if (capabilities?.paidDriveTime) {
      options.splice(1, 0, {
        type: 'drive_time',
        label: 'Drive Time',
        help: 'Travel between work locations.',
        requiresJob: false,
      });
    }

    return options;
  }, [capabilities?.paidDriveTime]);

  const selectedActivity = useMemo(
    () => activityOptions.find((option) => option.type === selectedWorkType) ?? activityOptions[0],
    [activityOptions, selectedWorkType]
  );

  const showJobSelection = selectedWorkType === 'job' || selectedWorkType === 'drive_time';
  const requiresJobSelection = selectedActivity?.requiresJob === true;
  const requiresUnbillableCategory = selectedWorkType === 'non_billable';

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
    requiresJobSelection,
    selectedJobId,
    requiresUnbillableCategory,
    unbillableCategoriesLoading,
    unbillableCategoriesError,
    unbillableCategories,
    selectedUnbillableCategoryId,
  ]);

  async function submitSwitch(metaOverride?: { requestId: string; idempotencyKey: string }) {
    if (!activeEntry || !user?.employeeId) {
      setError('No active shift found.');
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
    router.replace('/active-shift');
  }

  return (
    <Screen>
      <OfflineNotice />

      <View style={styles.card}>
        {!activeEntry ? (
          <StatusBanner tone="info" message="No active shift found. Clock in before switching activity." />
        ) : (
          <>
            <Text style={styles.title}>Switch activity</Text>
            <Text style={styles.help}>Current activity: {getWorkTypeLabel(activeEntry.workType)}</Text>
            <Text style={styles.help}>Current context: {resolveJobTitle(activeEntry, jobs)}</Text>

            <View style={styles.list}>
              {activityOptions.map((option) => {
                const selected = selectedWorkType === option.type;
                return (
                  <Pressable
                    key={option.type}
                    testID={`switch-activity-option-${option.type}`}
                    onPress={() => setSelectedWorkType(option.type)}
                    style={[styles.row, selected && styles.rowSelected]}
                  >
                    <View style={styles.textBlock}>
                      <Text style={styles.rowTitle}>{option.label}</Text>
                      <Text style={styles.rowMeta}>{option.help}</Text>
                    </View>
                    <View style={[styles.checkDot, selected && styles.checkDotSelected]}>
                      {selected ? <Text style={styles.checkMark}>✓</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {showJobSelection ? (
              <>
                <Text style={styles.sectionLabel}>{requiresJobSelection ? 'Select a job' : 'Job context (optional)'}</Text>
                {assignedJobs.length === 0 ? (
                  <StatusBanner
                    tone={requiresJobSelection ? 'error' : 'info'}
                    message={requiresJobSelection
                      ? 'No assigned scheduled/in-progress jobs available.'
                      : 'No assigned scheduled/in-progress jobs available. You can continue without a job context.'}
                  />
                ) : (
                  <View style={styles.list}>
                    {assignedJobs.map((job) => {
                      const selected = selectedJobId === job.id;
                      return (
                        <Pressable
                          key={job.id}
                          testID={`switch-job-option-${job.id}`}
                          onPress={() => setSelectedJobId(job.id)}
                          style={[styles.row, selected && styles.rowSelected]}
                        >
                          <View style={styles.textBlock}>
                            <Text style={styles.rowTitle}>{job.title || 'Untitled Job'}</Text>
                            <Text style={styles.rowMeta}>{job.status.replace('_', ' ')}</Text>
                          </View>
                          <View style={[styles.checkDot, selected && styles.checkDotSelected]}>
                            {selected ? <Text style={styles.checkMark}>✓</Text> : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </>
            ) : null}

            {requiresUnbillableCategory ? (
              <UnbillableCategorySelector
                categories={unbillableCategories}
                selectedCategoryId={selectedUnbillableCategoryId}
                loading={unbillableCategoriesLoading}
                error={unbillableCategoriesError}
                onSelect={setSelectedUnbillableCategoryId}
                onRetry={() => {
                  void retryUnbillableCategories();
                }}
              />
            ) : null}
          </>
        )}
      </View>

      {status ? <StatusBanner tone="success" message={status} /> : null}
      {error ? <StatusBanner tone="error" message={error} /> : null}

      <PrimaryActionButton
        label={loading ? 'Switching...' : 'Switch Activity'}
        disabled={!canSubmit || loading}
        onPress={() => void submitSwitch()}
      />

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