import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ListRow, ScreenHeader, SectionCard, SectionHeader, StatusBadge } from '@/components/MobilePrimitives';
import { PrimaryScreen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { formatTrainingDate, getTrainingStatusLabel, getTrainingStatusTone } from '@/features/training/presentation';
import { useTrainingActions } from '@/hooks/useTrainingActions';
import { useTrainingStore } from '@/store/trainingStore';
import { colors, spacing, typography } from '@/theme/colors';

const ATTENTION_PREVIEW_LIMIT = 3;

export default function EmployeeHubScreen() {
  const { assignments, overdueCount, dueSoonCount, loadedAt, error } = useTrainingStore();
  const { refreshAssignments } = useTrainingActions();
  const attentionCount = overdueCount + dueSoonCount;
  const attention = useMemo(() => assignments
    .filter((item) => item.presentationStatus === 'overdue' || item.presentationStatus === 'due_soon')
    .sort((left, right) => {
      const priority = (status: string) => status === 'overdue' ? 0 : 1;
      return priority(left.presentationStatus) - priority(right.presentationStatus)
        || String(left.currentDueDate ?? '').localeCompare(String(right.currentDueDate ?? ''));
    }), [assignments]);

  useFocusEffect(useCallback(() => { void refreshAssignments(); }, [refreshAssignments]));

  return (
    <PrimaryScreen testID="employee-hub-screen">
      <ScreenHeader title="Employee Hub" subtitle="Training, procedures, and company resources" />
      {loadedAt && error ? <StatusBanner tone="error" message={error} /> : null}
      {attention.length > 0 ? <View style={styles.section} testID="hub-attention">
        <SectionHeader title="Needs your attention" />
        <SectionCard>{attention.slice(0, ATTENTION_PREVIEW_LIMIT).map((assignment) => (
          <ListRow key={assignment.id} testID={`hub-training-${assignment.id}`} title={assignment.trainingTitle}
            subtitle={`Due ${formatTrainingDate(assignment.currentDueDate)}`}
            leading={<StatusBadge label={getTrainingStatusLabel(assignment.presentationStatus)} tone={getTrainingStatusTone(assignment.presentationStatus)} />}
            onPress={() => router.push({ pathname: '/training-detail', params: { assignmentId: assignment.id } })} />
        ))}{attention.length > ATTENTION_PREVIEW_LIMIT ? (
          <ListRow testID="hub-view-all-training" title="View all Training" detail={`${attention.length}`} onPress={() => router.push('/training')} />
        ) : null}</SectionCard>
      </View> : null}
      <View style={styles.section}>
        <SectionHeader title="Resources" />
        <SectionCard>
          <ListRow testID="hub-resource-training" title="Training" subtitle="Assigned learning and completion history"
            detail={attentionCount > 0 ? `${attentionCount} need attention` : undefined} onPress={() => router.push('/training')} />
          <ListRow testID="hub-resource-sops" title="Standard Operating Procedures" subtitle="Company procedures and safety references" onPress={() => router.push('/sops')} />
        </SectionCard>
        <Text style={styles.supporting}>SOPs are reference material and do not affect Training completion.</Text>
      </View>
    </PrimaryScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  supporting: { color: colors.textSecondary, fontSize: typography.caption, lineHeight: 18 },
});
