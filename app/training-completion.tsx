import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AuthorizedPdfViewer } from '@/components/AuthorizedPdfViewer';
import { ErrorState } from '@/components/ErrorState';
import { InfoRow, ScreenHeader, SectionCard, StatusBadge } from '@/components/MobilePrimitives';
import { LoadingState } from '@/components/LoadingState';
import { Screen, ScreenSafeAreaView } from '@/components/Screen';
import { formatTrainingDate } from '@/features/training/presentation';
import { useTrainingActions } from '@/hooks/useTrainingActions';
import { useTrainingStore } from '@/store/trainingStore';
import { spacing } from '@/theme/colors';
import { normalizeContentMode } from '@/types/document';

export default function TrainingCompletionScreen() {
  const params = useLocalSearchParams<{ completionId?: string | string[] }>();
  const completionId = Array.isArray(params.completionId) ? params.completionId[0] : params.completionId ?? '';
  const { completions } = useTrainingStore();
  const { refreshHistory } = useTrainingActions();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const completion = completions.find((item) => item.completionId === completionId || item.id === completionId) ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!completionId || completion) {
      setLoading(false);
      return () => { cancelled = true; };
    }
    void refreshHistory({ force: true }).then((result) => {
      if (cancelled) return;
      if (!result.ok) setError(result.offline ? 'This completed Training PDF is unavailable offline.' : result.error ?? 'Completed Training could not be loaded.');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [completion, completionId, refreshHistory]);

  if (loading && !completion) return <Screen><LoadingState label="Loading completed Training..." /></Screen>;
  if (!completion) return <Screen><ErrorState message={error ?? 'Completed Training was not found.'} /></Screen>;
  if (normalizeContentMode(completion.contentMode) !== 'document' || !completion.document) {
    return <Screen><ErrorState message="This completion does not include a PDF document." /></Screen>;
  }

  return (
    <ScreenSafeAreaView testID="training-completion-document-safe-area">
      <View testID="training-completion-document" style={styles.container}>
        <ScreenHeader title={completion.trainingTitle} subtitle="Completed Training record" action={<StatusBadge label="Completed" tone="success" />} />
        <SectionCard>
          <InfoRow label="Completed" value={formatTrainingDate(completion.completedAt, true)} emphasis />
          <InfoRow label="Version" value={String(completion.completedVersion)} />
        </SectionCard>
        <AuthorizedPdfViewer document={completion.document} />
      </View>
    </ScreenSafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.sm },
});