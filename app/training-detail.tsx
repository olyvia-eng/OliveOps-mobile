import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { prepareDownload } from '@/api/storageApi';
import { completeTraining, loadMyTrainingDetail } from '@/api/trainingApi';
import { AuthorizedPdfViewer } from '@/components/AuthorizedPdfViewer';
import { ErrorState } from '@/components/ErrorState';
import { InfoRow, ScreenHeader, SectionCard, SectionHeader, StatusBadge } from '@/components/MobilePrimitives';
import { LoadingState } from '@/components/LoadingState';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen, ScreenSafeAreaView } from '@/components/Screen';
import { SecondaryButton } from '@/components/SecondaryButton';
import { StatusBanner } from '@/components/StatusBanner';
import { formatTrainingDate, getRecurrenceLabel, getTrainingStatusLabel, getTrainingStatusTone } from '@/features/training/presentation';
import { createRequestMeta } from '@/services/requestGuards';
import { useTrainingActions } from '@/hooks/useTrainingActions';
import { useAuthStore } from '@/store/authStore';
import { colors, radii, spacing, typography } from '@/theme/colors';
import { normalizeContentMode } from '@/types/document';
import { ApiError } from '@/types/errors';
import type { MyTrainingDetailResponse, TrainingChecklistItem } from '@/types/training';

function normalizedName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export default function TrainingDetailScreen() {
  const params = useLocalSearchParams<{ assignmentId?: string | string[] }>();
  const assignmentId = Array.isArray(params.assignmentId) ? params.assignmentId[0] : params.assignmentId ?? '';
  const { accessToken, user } = useAuthStore();
  const { refreshAssignments } = useTrainingActions();
  const [detail, setDetail] = useState<MyTrainingDetailResponse | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [acknowledged, setAcknowledged] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [openingAttachment, setOpeningAttachment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submissionIdRef = useRef(createRequestMeta(`training-${assignmentId}`).idempotencyKey);
  const documentScrollRef = useRef<ScrollView>(null);

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
    if (!detail || !user?.name || normalizedName(signatureName) !== normalizedName(user.name)) return;
    const trainingSections = detail.version.trainingSections ?? [];
    const checklistItems = trainingSections.length > 0
      ? trainingSections.flatMap((section) => section.checklistItems)
      : detail.version.checklist;
    setSubmitting(true);
    setError(null);
    try {
      await completeTraining({
        assignmentId: detail.assignment.id,
        submissionId: submissionIdRef.current,
        checklistResponses: checklistItems.map((item) => ({ itemId: item.itemId, checked: true })),
        acknowledged: true,
        signatureName: user.name.trim(),
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

  const trainingSections = detail.version.trainingSections ?? [];
  const checklistItems = trainingSections.length > 0
    ? trainingSections.flatMap((section) => section.checklistItems)
    : detail.version.checklist;
  const allChecked = checklistItems.every((item) => checkedItems.has(item.itemId));
  const signatureMatches = Boolean(user?.name) && normalizedName(signatureName) === normalizedName(user?.name ?? '');
  const canComplete = allChecked && acknowledged && signatureMatches && !submitting;

  function renderChecklistItem(item: TrainingChecklistItem) {
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
  }

  const sectionContent = trainingSections.map((section) => (
    <View key={section.sectionId} testID={`training-section-${section.sectionId}`} style={styles.section}>
      <SectionHeader title={section.title} />
      <Text testID={`training-section-description-${section.sectionId}`} style={styles.instructions}>{section.description}</Text>
      {section.checklistItems.map(renderChecklistItem)}
    </View>
  ));

  const completionControls = (
    <View style={styles.acknowledgementSection}>
      <SectionHeader title="Acknowledgement" />
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
      <Text style={styles.signatureLabel}>Type your full name</Text>
      <TextInput
        testID="training-signature-input"
        accessibilityLabel="Type your full name"
        autoCapitalize="words"
        autoCorrect={false}
        value={signatureName}
        onChangeText={setSignatureName}
        placeholder={user?.name ?? 'Full name'}
        placeholderTextColor={colors.inputPlaceholder}
        onFocus={() => {
          requestAnimationFrame(() => documentScrollRef.current?.scrollToEnd({ animated: true }));
        }}
        style={styles.signatureInput}
      />
      <View testID="training-signature-preview" style={styles.signaturePreview}>
        <Text style={styles.signatureText}>{signatureName.trim() || 'Signature preview'}</Text>
      </View>
      {signatureName.trim() && !signatureMatches ? (
        <Text testID="training-signature-error" style={styles.signatureError}>Enter your full name exactly as shown in your OliveOps account.</Text>
      ) : null}
      <PrimaryActionButton label={submitting ? 'Completing...' : 'Complete Training'} disabled={!canComplete} onPress={() => { void submit(); }} />
    </View>
  );

  if (normalizeContentMode(detail.version.contentMode) === 'document') {
    return (
      <ScreenSafeAreaView testID="training-document-screen-safe-area">
        <KeyboardAvoidingView
          testID="training-document-keyboard-avoiding-view"
          style={styles.documentKeyboardAvoiding}
          behavior={Platform.select({ ios: 'padding', android: undefined })}
        >
          <ScrollView
            ref={documentScrollRef}
            testID="training-document-screen"
            contentContainerStyle={styles.documentContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            nestedScrollEnabled
          >
            <View style={styles.documentHeader}>
              <ScreenHeader
                title={detail.version.title}
                subtitle={`Assigned version ${detail.version.version}`}
                action={<StatusBadge label={getTrainingStatusLabel(detail.assignment.presentationStatus)} tone={getTrainingStatusTone(detail.assignment.presentationStatus)} />}
              />
              {error ? <StatusBanner tone="error" message={error} /> : null}
            </View>
            {detail.version.document ? (
              <AuthorizedPdfViewer document={detail.version.document} embedded />
            ) : (
              <ErrorState message="The PDF for this Training version is unavailable." onRetry={() => { void load(); }} />
            )}
            {detail.version.document ? (
              <View testID="training-completion-panel" style={styles.completionPanel}>
                {trainingSections.length > 0 || checklistItems.length > 0 ? (
                  <View testID="training-document-checklist" style={styles.documentChecklistContent}>
                    {trainingSections.length > 0 ? sectionContent : checklistItems.map(renderChecklistItem)}
                  </View>
                ) : null}
                {completionControls}
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </ScreenSafeAreaView>
    );
  }

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
      {trainingSections.length > 0 ? sectionContent : (
        <View style={styles.section}>
          <SectionHeader title="Required Checklist" />
          {checklistItems.map(renderChecklistItem)}
        </View>
      )}
      {completionControls}
    </Screen>
  );
}

const styles = StyleSheet.create({
  documentKeyboardAvoiding: { flex: 1 },
  documentContent: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.md },
  documentHeader: { gap: spacing.sm },
  completionPanel: { gap: spacing.md },
  documentChecklistContent: { gap: spacing.xs },
  section: { gap: spacing.sm },
  instructions: { color: colors.textPrimary, fontSize: typography.body, lineHeight: 23 },
  acknowledgementSection: { gap: spacing.sm },
  checkRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider, paddingVertical: spacing.sm },
  checkRowSelected: { backgroundColor: colors.oliveTint },
  acknowledgement: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radii.lg, padding: spacing.md },
  checkbox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, backgroundColor: colors.surface },
  checkboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  checkmark: { color: colors.primaryText, fontSize: typography.bodySmall, fontWeight: typography.bold },
  checkText: { flex: 1, color: colors.textPrimary, fontSize: typography.body, lineHeight: 22 },
  signatureLabel: { color: colors.textPrimary, fontSize: typography.bodySmall, fontWeight: typography.semibold },
  signatureInput: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: spacing.md, fontSize: typography.body },
  signaturePreview: { minHeight: 54, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: spacing.sm },
  signatureText: { color: colors.textPrimary, fontSize: 24, fontStyle: 'italic' },
  signatureError: { color: colors.error, fontSize: typography.bodySmall },
  pressed: { opacity: 0.7 },
});