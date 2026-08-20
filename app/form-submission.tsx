import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ErrorState } from '@/components/ErrorState';
import { FormContextSummary } from '@/components/FormContextSummary';
import { LoadingState } from '@/components/LoadingState';
import { ScreenHeader, StatusBadge } from '@/components/MobilePrimitives';
import { Screen } from '@/components/Screen';
import { formatSubmittedAt, getSubmissionStatusLabel } from '@/features/forms/formPresentation';
import { useFormsActions } from '@/hooks/useFormsActions';
import { useClockingStore } from '@/store/clockingStore';
import { useFormsStore } from '@/store/formsStore';
import { colors, spacing, typography } from '@/theme/colors';

export default function FormSubmissionScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { businessTimeZone } = useClockingStore();
  const submissionId = typeof id === 'string' ? id : '';
  const { submissionDetails } = useFormsStore();
  const { getSubmission, loadingSubmission } = useFormsActions();
  const [error, setError] = useState<string | null>(null);
  const requestedRef = useRef(false);
  const detail = submissionDetails[submissionId];

  async function loadDetail() {
    if (!submissionId) return;
    const result = await getSubmission(submissionId);
    setError(result.ok ? null : (result.error ?? 'Could not load this submission.'));
  }

  useEffect(() => {
    if (!submissionId || detail || requestedRef.current) return;
    requestedRef.current = true;
    void loadDetail();
  }, [detail, getSubmission, submissionId]);

  if (!detail && loadingSubmission) return <Screen><LoadingState label="Loading submission..." /></Screen>;
  if (!detail && error) return <Screen><ErrorState message={error} onRetry={() => { setError(null); void loadDetail(); }} /></Screen>;
  if (!detail) return <Screen><ErrorState message="This completed submission is unavailable." /></Screen>;

  return (
    <Screen>
      <ScreenHeader
        title={detail.form.name}
        subtitle={`Submitted ${formatSubmittedAt(detail.submission.submittedAt, businessTimeZone)}`}
        action={(
          <StatusBadge
            label={getSubmissionStatusLabel(detail.submission.status)}
            tone={detail.submission.status === 'approved' ? 'success' : detail.submission.status === 'rejected' ? 'error' : 'neutral'}
          />
        )}
      />
      {detail.form.description ? <Text style={styles.description}>{detail.form.description}</Text> : null}
      <FormContextSummary context={detail.submission.context} />
      <View style={styles.answers}>
        {detail.answers.map((answer) => (
          <View key={answer.fieldId} style={styles.answer}>
            <Text style={styles.label}>{answer.label}</Text>
            <Text style={styles.value}>{answer.value?.trim() || 'No answer'}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  description: { color: colors.textSecondary, fontSize: typography.body, lineHeight: 23 },
  answers: { borderTopWidth: 1, borderTopColor: colors.divider },
  answer: { gap: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.divider, paddingVertical: spacing.md },
  label: { color: colors.textSecondary, fontSize: typography.bodySmall, fontWeight: typography.semibold },
  value: { color: colors.textPrimary, fontSize: typography.body, lineHeight: 23 },
});