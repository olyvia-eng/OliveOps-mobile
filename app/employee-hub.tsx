import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { loadMyTraining, loadMyTrainingHistory } from '@/api/trainingApi';
import { EmptyState, ListRow, ScreenHeader, SectionCard, SegmentedControl, StatusBadge } from '@/components/MobilePrimitives';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { formatTrainingDate, getTrainingStatusLabel, getTrainingStatusTone } from '@/features/training/presentation';
import { useAuthStore } from '@/store/authStore';
import { spacing } from '@/theme/colors';
import type { TrainingAssignment, TrainingCompletion } from '@/types/training';

type HubTab = 'assigned' | 'history';

export default function EmployeeHubScreen() {
  const { accessToken } = useAuthStore();
  const [tab, setTab] = useState<HubTab>('assigned');
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [completions, setCompletions] = useState<TrainingCompletion[]>([]);
  const [attentionCount, setAttentionCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [assigned, history] = await Promise.all([
        loadMyTraining(accessToken),
        loadMyTrainingHistory(accessToken),
      ]);
      setAssignments(assigned.assignments);
      setAttentionCount(assigned.attentionCount);
      setCompletions(history.completions);
      setError(null);
      setLoaded(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Training could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  return (
    <Screen testID="employee-hub-screen">
      <ScreenHeader title="Employee Hub" subtitle="Your assigned training and completion history" />
      {loaded && error ? <StatusBanner tone="error" message={error} /> : null}
      <SegmentedControl
        testIDPrefix="employee-hub-tab"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'assigned', label: `Assigned ${assignments.length}` },
          { value: 'history', label: `History ${completions.length}` },
        ]}
      />
      {!loaded && loading ? <LoadingState label="Loading training..." /> : null}
      {!loaded && !loading && error ? <ErrorState message={error} onRetry={() => { void refresh(); }} /> : null}
      {loaded && tab === 'assigned' ? (
        assignments.length === 0 ? (
          <EmptyState title="No training assigned" message="New training assignments will appear here." />
        ) : (
          <View style={styles.list}>
            {attentionCount > 0 ? <StatusBanner tone="info" message={`${attentionCount} assignment${attentionCount === 1 ? '' : 's'} need attention.`} /> : null}
            <SectionCard>
              {assignments.map((assignment) => (
                <ListRow
                  key={assignment.id}
                  testID={`training-row-${assignment.id}`}
                  title={assignment.trainingTitle}
                  subtitle={`Due ${formatTrainingDate(assignment.currentDueDate)}`}
                  leading={<StatusBadge label={getTrainingStatusLabel(assignment.presentationStatus)} tone={getTrainingStatusTone(assignment.presentationStatus)} />}
                  onPress={() => router.push({ pathname: '/training-detail', params: { assignmentId: assignment.id } })}
                />
              ))}
            </SectionCard>
          </View>
        )
      ) : null}
      {loaded && tab === 'history' ? (
        completions.length === 0 ? (
          <EmptyState title="No completed training yet" message="Completed training records will appear here." />
        ) : (
          <SectionCard>
            {completions.map((completion) => (
              <ListRow
                key={completion.id}
                testID={`training-completion-${completion.id}`}
                title={completion.trainingTitle}
                subtitle={`Completed ${formatTrainingDate(completion.completedAt, true)} · Version ${completion.completedVersion}`}
                leading={<StatusBadge label="Completed" tone="success" />}
              />
            ))}
          </SectionCard>
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { gap: spacing.md } });