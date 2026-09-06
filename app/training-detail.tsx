import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { prepareDownload } from '@/api/storageApi';
import { completeTraining, loadMyTrainingDetail } from '@/api/trainingApi';
import { ErrorState } from '@/components/ErrorState';
import { InfoRow, ScreenHeader, SectionCard, SectionHeader, StatusBadge } from '@/components/MobilePrimitives';
import { LoadingState } from '@/components/LoadingState';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { SecondaryButton } from '@/components/SecondaryButton';
import { StatusBanner } from '@/components/StatusBanner';
import { formatTrainingDate, getRecurrenceLabel, getTrainingStatusLabel, getTrainingStatusTone } from '@/features/training/presentation';
import { createRequestMeta } from '@/services/requestGuards';
import { useTrainingActions } from '@/hooks/useTrainingActions';
import { useAuthStore } from '@/store/authStore';
import { colors, radii, spacing, typography } from '@/theme/colors';
import { ApiError } from '@/types/errors';
import type { MyTrainingDetailResponse } from '@/types/training';

export default function TrainingDetailScreen() {
  const params = useLocalSearchParams<{ assignmentId?: string | string[] }>();
  const assignmentId = Array.isArray(params.assignmentId) ? params.assignmentId[0] : params.assignmentId ?? '';
  const { accessToken } = useAuthStore();
  const { refreshAssignments } = useTrainingActions();
  const [detail, setDetail] = useState<MyTrainingDetailResponse | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [openingAttachment, setOpeningAttachment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submissionIdRef = useRef(createRequestMeta(`training-${assignmentId}`).idempotencyKey);

  async function load() {
    if (!assignmentId) {
      setError('Training assignment not found.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setDetail(await loadMyTrainingDetail(assignmentId, accessToken));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Training could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [assignmentId, accessToken]);

  function toggleItem(itemId: string) {
    setCheckedItems((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function openAttachment() {
    const fileId = detail?.version.attachmentFileId;
    if (!fileId) return;
    setOpeningAttachment(true);
    setError(null);
    try {
      const result = await prepareDownload(fileId, accessToken);
      await Linking.openURL(result.downloadUrl);
    } catch {
      setError('The training attachment could not be opened.');
    } finally {
      setOpeningAttachment(false);
    }
  }

  async function submit() {
    if (!detail) return;
    setSubmitting(true);
    setError(null);
    try {
      await completeTraining({
        assignmentId: detail.assignment.id,
        submissionId: submissionIdRef.current,
        checklistResponses: detail.version.checklist.map((item) => ({ itemId: item.itemId, checked: true })),
        acknowledged: true,
      }, accessToken);
      await refreshAssignments({ force: true });
      router.replace('/training');
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'cycle_complete') {
        await refreshAssignments({ force: true });
        router.replace('/training');
        return;
      }
      if (reason instanceof ApiError && reason.code === 'stale_assignment') {
        setError('This assignment changed. Return to the Employee Hub to refresh it.');
      } else {
        setError(reason instanceof Error ? reason.message : 'Training could not be completed.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !detail) return <Screen><LoadingState label="Loading training..." /></Screen>;
  if (!detail) return <Screen><ErrorState message={error ?? 'Training assignment not found.'} onRetry={() => { void load(); }} /></Screen>;

  const allChecked = detail.version.checklist.every((item) => checkedItems.has(item.itemId));
  const canComplete = allChecked && acknowledged && !submitting;

  return (
    <Screen testID="training-detail-screen">
      <ScreenHeader
        title={detail.version.title}
        subtitle={detail.version.shortDescription || 'Assigned employee training'}
        action={<StatusBadge label={getTrainingStatusLabel(detail.assignment.presentationStatus)} tone={getTrainingStatusTone(detail.assignment.presentationStatus)} />}
      />
      {error ? <StatusBanner tone="error" message={error} /> : null}
      <SectionCard>
        <InfoRow label="Due" value={formatTrainingDate(detail.assignment.currentDueDate)} emphasis />
        <InfoRow label="Version" value={String(detail.version.version)} />
        <InfoRow label="Recurrence" value={getRecurrenceLabel(detail.version.recurrenceType, detail.version.recurrenceMonths)} />
      </SectionCard>
      {detail.version.instructions ? (
        <View style={styles.section}>
          <SectionHeader title="Instructions" />
          <Text style={styles.instructions}>{detail.version.instructions}</Text>
        </View>
      ) : null}
      {detail.version.attachmentFileId ? (
        <SecondaryButton label={openingAttachment ? 'Opening Attachment...' : 'Open Attachment'} disabled={openingAttachment} onPress={() => { void openAttachment(); }} />
      ) : null}
      <View style={styles.section}>
        <SectionHeader title="Required Checklist" />
        {detail.version.checklist.map((item) => {
          const checked = checkedItems.has(item.itemId);
          return (
            <Pressable
              key={item.itemId}
              testID={`training-check-${item.itemId}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              onPress={() => toggleItem(item.itemId)}
              style={({ pressed }) => [styles.checkRow, checked && styles.checkRowSelected, pressed && styles.pressed]}
            >
              <View style={[styles.checkbox, checked && styles.checkboxSelected]}><Text style={styles.checkmark}>{checked ? '✓' : ''}</Text></View>
              <Text style={styles.checkText}>{item.text}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        testID="training-acknowledgement"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: acknowledged }}
        onPress={() => setAcknowledged((value) => !value)}
        style={({ pressed }) => [styles.acknowledgement, acknowledged && styles.checkRowSelected, pressed && styles.pressed]}
      >
        <View style={[styles.checkbox, acknowledged && styles.checkboxSelected]}><Text style={styles.checkmark}>{acknowledged ? '✓' : ''}</Text></View>
        <Text style={styles.checkText}>{detail.version.acknowledgementStatement}</Text>
      </Pressable>
      <PrimaryActionButton label={submitting ? 'Completing...' : 'Complete Training'} disabled={!canComplete} onPress={() => { void submit(); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  instructions: { color: colors.textPrimary, fontSize: typography.body, lineHeight: 23 },
  checkRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider, paddingVertical: spacing.sm },
  checkRowSelected: { backgroundColor: colors.oliveTint },
  acknowledgement: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radii.lg, padding: spacing.md },
  checkbox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, backgroundColor: colors.surface },
  checkboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  checkmark: { color: colors.primaryText, fontSize: typography.bodySmall, fontWeight: typography.bold },
  checkText: { flex: 1, color: colors.textPrimary, fontSize: typography.body, lineHeight: 22 },
  pressed: { opacity: 0.7 },
});