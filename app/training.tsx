import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { EmptyState, ListRow, ScreenHeader, SectionCard, SegmentedControl, StatusBadge } from '@/components/MobilePrimitives';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { formatTrainingDate, getTrainingStatusLabel, getTrainingStatusTone } from '@/features/training/presentation';
import { useTrainingActions } from '@/hooks/useTrainingActions';
import { useTrainingStore } from '@/store/trainingStore';
import { spacing } from '@/theme/colors';
import { normalizeContentMode } from '@/types/document';

type TrainingTab = 'assigned' | 'history';

export default function TrainingScreen() {
  const [tab, setTab] = useState<TrainingTab>('assigned');
  const { assignments, completions, overdueCount, dueSoonCount, loadedAt, loading, error } = useTrainingStore();
  const { refreshAssignments, refreshHistory } = useTrainingActions();
  const attentionCount = overdueCount + dueSoonCount;
  const loaded = loadedAt !== null;
  const refresh = useCallback(async () => { await Promise.all([refreshAssignments(), refreshHistory()]); }, [refreshAssignments, refreshHistory]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  return (
    <Screen testID="training-screen">
      <ScreenHeader title="Training" subtitle="Assigned training and completion history" />
      {loaded && error ? <StatusBanner tone="error" message={error} /> : null}
      <SegmentedControl testIDPrefix="training-tab" value={tab} onChange={setTab} options={[
        { value: 'assigned', label: `Assigned ${assignments.length}` },
        { value: 'history', label: `History ${completions.length}` },
      ]} />
      {!loaded && loading ? <LoadingState label="Loading training..." /> : null}
      {!loaded && !loading && error ? <ErrorState message={error} onRetry={() => { void refresh(); }} /> : null}
      {loaded && tab === 'assigned' ? assignments.length === 0 ? (
        <EmptyState title="No training assigned" message="New training assignments will appear here." />
      ) : (
        <View style={styles.list}>
          {attentionCount > 0 ? <StatusBanner tone="info" message={`${attentionCount} assignment${attentionCount === 1 ? '' : 's'} need attention.`} /> : null}
          <SectionCard>{assignments.map((assignment) => (
            <ListRow key={assignment.id} testID={`training-row-${assignment.id}`} title={assignment.trainingTitle}
              subtitle={`Due ${formatTrainingDate(assignment.currentDueDate)}`}
              leading={<StatusBadge label={getTrainingStatusLabel(assignment.presentationStatus)} tone={getTrainingStatusTone(assignment.presentationStatus)} />}
              onPress={() => router.push({ pathname: '/training-detail', params: { assignmentId: assignment.id } })} />
          ))}</SectionCard>
        </View>
      ) : null}
      {loaded && tab === 'history' ? completions.length === 0 ? (
        <EmptyState title="No completed training yet" message="Completed training records will appear here." />
      ) : (
        <SectionCard>{completions.map((completion) => (
          <ListRow key={completion.id} testID={`training-completion-${completion.id}`} title={completion.trainingTitle}
            subtitle={`Completed ${formatTrainingDate(completion.completedAt, true)} · Version ${completion.completedVersion}`}
            leading={<StatusBadge label="Completed" tone="success" />}
            onPress={normalizeContentMode(completion.contentMode) === 'document'
              ? () => router.push({ pathname: '/training-completion', params: { completionId: completion.completionId } })
              : undefined} />
        ))}</SectionCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { gap: spacing.md } });
