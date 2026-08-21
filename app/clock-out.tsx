import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { OfflineNotice } from '@/components/OfflineNotice';
import { AdvisoryFormsPrompt } from '@/components/AdvisoryFormsPrompt';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { ScreenHeader, SectionHeader, StatusBadge } from '@/components/MobilePrimitives';
import { completeUpload, deleteUploadedFile, prepareUpload, uploadUriToS3 } from '@/api/storageApi';
import { MAX_TIME_ENTRY_PHOTOS } from '@/features/clocking/constants';
import {
  formatDurationForEntry,
  formatDurationMinutes,
  formatEntryTimeRange,
  getCurrentShiftSegments,
  getWorkTypeLabel,
  resolveCurrentActiveEntry,
  resolveEntryPrimaryLabel,
  resolveJobTitle,
} from '@/features/clocking/presentation';
import { useClockingActions } from '@/hooks/useClockingActions';
import { useFormsActions } from '@/hooks/useFormsActions';
import { isOnline } from '@/services/connectivity';
import { createRequestMeta } from '@/services/requestGuards';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { useOptionalOfflineClockStore } from '@/store/offlineClockContext';
import { useFormsWorkflowStore } from '@/store/formsWorkflowStore';
import { colors } from '@/theme/colors';
import { toUserFacingError } from '@/utils/userFacingError';
import type { EmployeeForm } from '@/types/forms';

type PhotoAttachmentStatus = 'uploading' | 'uploaded' | 'failed';

type PhotoAttachment = {
  localId: string;
  uri: string;
  name: string;
  mimeType: string;
  fileId?: string;
  status: PhotoAttachmentStatus;
  error?: string;
};

function inferMimeType(fileName: string, fallback?: string) {
  if (typeof fallback === 'string' && fallback.trim()) {
    return fallback;
  }

  const lowerName = (fileName || '').toLowerCase();
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  if (lowerName.endsWith('.heic')) return 'image/heic';
  if (lowerName.endsWith('.heif')) return 'image/heif';
  return 'image/jpeg';
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/heic') return 'heic';
  if (mimeType === 'image/heif') return 'heif';
  return 'jpg';
}

export default function ClockOutScreen() {
  const { user, accessToken } = useAuthStore();
  const { currentActiveEntryId, timeEntries, jobs, businessTimeZone } = useClockingStore();
  const offlineClock = useOptionalOfflineClockStore();
  const { clockOut, loading, refreshWorkContext } = useClockingActions();
  const { getRequiredForms, refreshForms } = useFormsActions();
  const { workflow, startWorkflow, clearWorkflow } = useFormsWorkflowStore();

  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<PhotoAttachment[]>([]);
  const [retryMeta, setRetryMeta] = useState<{ requestId: string; idempotencyKey: string; fingerprint: string } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionSettingsRequired, setPermissionSettingsRequired] = useState(false);
  const [navigatingAfterSuccess, setNavigatingAfterSuccess] = useState(false);
  const [postActionForms, setPostActionForms] = useState<EmployeeForm[]>([]);
  const [offline, setOffline] = useState(false);
  const attachmentsRef = useRef<PhotoAttachment[]>([]);
  const submittedRef = useRef(false);
  const cleanedFileIdsRef = useRef<Set<string>>(new Set());

  const uploadingPhoto = attachments.some((attachment) => attachment.status === 'uploading');
  const hasIncompletePhoto = attachments.some((attachment) => attachment.status !== 'uploaded');

  const activeEntry = useMemo(() => {
    const effectiveEntries = offlineClock?.effectiveTimeEntries ?? timeEntries;
    const effectiveActiveId = offlineClock?.effectiveCurrentActiveEntryId ?? currentActiveEntryId;
    return resolveCurrentActiveEntry(effectiveEntries, user?.employeeId, effectiveActiveId);
  }, [currentActiveEntryId, offlineClock?.effectiveCurrentActiveEntryId, offlineClock?.effectiveTimeEntries, timeEntries, user?.employeeId]);

  useEffect(() => {
    void refreshWorkContext();
  }, [refreshWorkContext]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    void isOnline().then((online) => setOffline(!online));
  }, []);

  useEffect(() => {
    return () => {
      if (submittedRef.current) return;

      for (const attachment of attachmentsRef.current) {
        if (attachment.status !== 'uploaded' || !attachment.fileId) continue;
        void cleanupUploadedAttachment(attachment.fileId);
      }
    };
  }, []);

  const shiftLabel = useMemo(() => {
    if (!activeEntry) return 'No active shift';
    return resolveJobTitle(activeEntry, jobs);
  }, [activeEntry, jobs]);

  const shiftSegments = useMemo(
    () => getCurrentShiftSegments(
      offlineClock?.effectiveTimeEntries ?? timeEntries,
      user?.employeeId,
      offlineClock?.effectiveCurrentActiveEntryId ?? currentActiveEntryId,
    ),
    [currentActiveEntryId, offlineClock?.effectiveCurrentActiveEntryId, offlineClock?.effectiveTimeEntries, timeEntries, user?.employeeId],
  );
  const totalShiftMinutes = useMemo(() => shiftSegments.reduce((total, segment) => {
    const startedAt = Date.parse(segment.clockIn);
    const endedAt = segment.clockOut ? Date.parse(segment.clockOut) : Date.now();
    return total + Math.max(0, (endedAt - startedAt) / 60000 - (segment.breakMinutes || 0));
  }, 0), [shiftSegments]);
  const clockOutWorkflow = workflow?.originRoute === '/clock-out' && workflow.intent.kind === 'clock_out_follow_up'
    ? { ...workflow, intent: workflow.intent }
    : null;
  const remainingPostActionForms = clockOutWorkflow
    ? clockOutWorkflow.forms.slice(clockOutWorkflow.completedCount)
    : postActionForms;

  function updateAttachment(localId: string, updater: (previous: PhotoAttachment) => PhotoAttachment) {
    setAttachments((previous) => previous.map((attachment) => {
      if (attachment.localId !== localId) return attachment;
      return updater(attachment);
    }));
  }

  async function cleanupUploadedAttachment(fileId: string) {
    if (cleanedFileIdsRef.current.has(fileId)) return;
    cleanedFileIdsRef.current.add(fileId);

    try {
      await deleteUploadedFile(fileId, accessToken);
    } catch {
      // Cleanup is best effort and must not interrupt navigation.
    }
  }

  async function promptPhotoSource() {
    if (!await isOnline()) {
      setOffline(true);
      setError('Photos require a connection. You can clock out now without photos.');
      return;
    }
    setOffline(false);
    if (attachments.length >= MAX_TIME_ENTRY_PHOTOS) {
      setError(`You can attach up to ${MAX_TIME_ENTRY_PHOTOS} photos.`);
      return;
    }

    Alert.alert('Add Photo', 'Choose a photo source.', [
      { text: 'Take Photo', onPress: () => { void choosePhoto('camera'); } },
      { text: 'Choose from Library', onPress: () => { void choosePhoto('library'); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function choosePhoto(source: 'camera' | 'library') {
    try {
      await choosePhotoFromSource(source);
    } catch {
      setError('Could not open that photo source. Check app permissions and try again.');
    }
  }

  async function choosePhotoFromSource(source: 'camera' | 'library') {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setPermissionSettingsRequired(permission.canAskAgain === false);
        setError(permission.canAskAgain === false
          ? 'Camera access is disabled. Open Settings to allow camera access.'
          : 'Camera permission is required to capture a clock-out photo.');
        return;
      }
    }

    setPermissionSettingsRequired(false);

    const remainingSlots = MAX_TIME_ENTRY_PHOTOS - attachments.length;
    if (remainingSlots <= 0) {
      setError(`You can attach up to ${MAX_TIME_ENTRY_PHOTOS} photos.`);
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        mediaTypes: ['images'],
        quality: 0.8,
      })
      : await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        mediaTypes: ['images'],
        quality: 0.8,
      });

    if (result.canceled || result.assets.length === 0) return;

    const selectedAssets = result.assets.slice(0, remainingSlots);
    const pendingUploads = selectedAssets.map((asset, index) => {
      const mimeType = inferMimeType(asset.fileName || '', asset.mimeType ?? undefined);
      const extension = extensionForMimeType(mimeType);
      const nextName = asset.fileName || `clock-out-${Date.now()}-${index}.${extension}`;
      const localId = `attachment-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;

      return {
        localId,
        uri: asset.uri,
        name: nextName,
        mimeType,
      };
    });

    setAttachments((previous) => [
      ...previous,
      ...pendingUploads.map((upload) => ({
        localId: upload.localId,
        uri: upload.uri,
        name: upload.name,
        mimeType: upload.mimeType,
        status: 'uploading' as PhotoAttachmentStatus,
      })),
    ]);
    setSuccess(null);
    setError(null);

    await Promise.all(pendingUploads.map((upload) => uploadPhotoAttachment({
      localId: upload.localId,
      uri: upload.uri,
      fileName: upload.name,
      mimeType: upload.mimeType,
    })));
  }

  async function uploadPhotoAttachment({
    localId,
    uri,
    fileName,
    mimeType,
  }: {
    localId: string;
    uri: string;
    fileName: string;
    mimeType: string;
  }) {
    if (!activeEntry) {
      setError('No active shift found for upload.');
      updateAttachment(localId, (previous) => ({
        ...previous,
        status: 'failed',
        fileId: undefined,
        error: 'No active shift found for upload.',
      }));
      return;
    }

    const online = await isOnline();
    if (!online) {
      setError('Offline. Reconnect and retry photo upload.');
      updateAttachment(localId, (previous) => ({
        ...previous,
        status: 'failed',
        fileId: undefined,
        error: 'Offline. Reconnect and retry photo upload.',
      }));
      return;
    }

    setError(null);
    setSuccess(null);

    let preparedFileId: string | undefined;
    try {
      const fileResponse = await fetch(uri);
      const blob = await fileResponse.blob();
      if (!blob.size) {
        throw new Error('Could not read selected photo size.');
      }

      const prepared = await prepareUpload({
        action: 'prepare-upload',
        fileName,
        mimeType,
        sizeBytes: blob.size,
        entityType: 'time-entry',
        entityId: activeEntry.id,
        category: 'clock-out-photo',
      }, accessToken);

      if (!prepared.fileId || !prepared.uploadUrl) {
        throw new Error('Upload could not be prepared.');
      }
      preparedFileId = prepared.fileId;

      await uploadUriToS3(prepared.uploadUrl, uri, mimeType, prepared.requiredHeaders);
      await completeUpload(prepared.fileId, accessToken);

      updateAttachment(localId, (previous) => ({
        ...previous,
        status: 'uploaded',
        fileId: prepared.fileId,
        error: undefined,
      }));
      setSuccess('Photo attached.');
    } catch (uploadError) {
      if (preparedFileId) {
        await cleanupUploadedAttachment(preparedFileId);
      }
      const message = toUserFacingError(uploadError, 'Photo upload failed. Please try again.');
      setError(message);
      updateAttachment(localId, (previous) => ({
        ...previous,
        status: 'failed',
        fileId: undefined,
        error: message,
      }));
    }
  }

  function removeAttachment(localId: string) {
    const target = attachments.find((attachment) => attachment.localId === localId);
    setAttachments((previous) => previous.filter((attachment) => attachment.localId !== localId));

    if (target?.status === 'uploaded' && target.fileId) {
      void cleanupUploadedAttachment(target.fileId);
    }

    setSuccess(null);
  }

  function retryAttachment(localId: string) {
    const target = attachments.find((attachment) => attachment.localId === localId);
    if (!target) return;

    updateAttachment(localId, (previous) => ({
      ...previous,
      status: 'uploading',
      fileId: undefined,
      error: undefined,
    }));
    void uploadPhotoAttachment({
      localId,
      uri: target.uri,
      fileName: target.name,
      mimeType: target.mimeType,
    });
  }

  async function submitClockOut(metaOverride?: { requestId: string; idempotencyKey: string; fingerprint?: string }) {
    if (!activeEntry) {
      setError('No active shift found.');
      return;
    }

    setError(null);
    setSuccess(null);

    const online = await isOnline();
    const uploadedPhotoAttachmentFileIds = (online ? attachments : [])
      .filter((attachment) => attachment.status === 'uploaded' && Boolean(attachment.fileId))
      .map((attachment) => attachment.fileId as string);
    const fingerprint = JSON.stringify({
      entryId: activeEntry.id,
      notes: notes.trim(),
      photoAttachmentFileIds: uploadedPhotoAttachmentFileIds,
    });
    const reusableMeta = metaOverride?.fingerprint === fingerprint
      ? metaOverride
      : retryMeta?.fingerprint === fingerprint
        ? retryMeta
        : createRequestMeta(activeEntry.id);
    const meta = { requestId: reusableMeta.requestId, idempotencyKey: reusableMeta.idempotencyKey };
    setRetryMeta({ ...meta, fingerprint });

    const result = await clockOut(
      activeEntry.id,
      notes.trim(),
      uploadedPhotoAttachmentFileIds.length > 0 ? uploadedPhotoAttachmentFileIds : undefined,
      meta
    );
    if (!result.ok) {
      setError(result.error || 'Clock-out failed.');
      return;
    }

    setRetryMeta(null);
    const pendingSync = 'pendingSync' in result && result.pendingSync;
    if (pendingSync) {
      await Promise.all(uploadedPhotoAttachmentFileIds.map(cleanupUploadedAttachment));
    }
    submittedRef.current = true;
    setSuccess(pendingSync ? 'Clock-out saved on this device. It will sync when online.' : 'Clock-out submitted successfully.');
    setNavigatingAfterSuccess(true);
    if (pendingSync) {
      router.replace('/home');
      return;
    }
    const leavingJobId = activeEntry.jobIds?.[0] ?? activeEntry.jobId;
    const checks = [getRequiredForms('after_clock_out')];
    if (leavingJobId) {
      checks.push(getRequiredForms('after_leaving_job', { jobId: leavingJobId }));
    }
    const results = await Promise.all(checks);
    const forms = results.flatMap((advisory) => advisory.ok ? advisory.forms : []);
    if (forms.length > 0) {
      startWorkflow({
        originRoute: '/clock-out',
        destination: '/home',
        phase: 'post_action',
        intent: {
          kind: 'clock_out_follow_up',
          recordedDurationLabel: formatDurationMinutes(totalShiftMinutes),
        },
        forms,
      });
      setPostActionForms(forms);
      return;
    }
    router.replace('/home');
  }

  function onConfirmClockOut() {
    Alert.alert('Confirm Clock Out', 'Submit this clock-out now?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: () => { void submitClockOut(); } },
    ]);
  }

  if (clockOutWorkflow) {
    const allCompleted = remainingPostActionForms.length === 0;
    const lastCompletedForm = clockOutWorkflow.forms[clockOutWorkflow.completedCount - 1];
    return (
      <Screen>
        <OfflineNotice />
        <ScreenHeader
          title={allCompleted ? 'Shift complete' : "You're clocked out"}
          subtitle={`${clockOutWorkflow.intent.recordedDurationLabel} recorded`}
        />
        <StatusBanner tone="success" message="Clocked out" />
        {allCompleted ? (
          <>
            <Text style={styles.completionMessage}>
              {clockOutWorkflow.forms.length === 1 && lastCompletedForm
                ? `${lastCompletedForm.name} submitted.`
                : 'All post-shift forms completed.'}
            </Text>
            <PrimaryActionButton
              label="Done"
              onPress={() => {
                clearWorkflow();
                router.replace('/home');
              }}
            />
          </>
        ) : (
          <AdvisoryFormsPrompt
            forms={remainingPostActionForms}
            heading={`${remainingPostActionForms.length} form${remainingPostActionForms.length === 1 ? '' : 's'} need${remainingPostActionForms.length === 1 ? 's' : ''} your attention`}
            message="Your shift is already clocked out."
            completeLabel={clockOutWorkflow.completedCount > 0 ? 'Complete Next Form' : 'Complete Form'}
            skipLabel="Do Later"
            completedCount={clockOutWorkflow.completedCount}
            totalCount={clockOutWorkflow.forms.length}
            onComplete={(form) => router.push({
              pathname: '/form',
              params: {
                list: 'todo', formId: form.id, trigger: form.trigger,
                jobId: form.context?.jobId, equipmentId: form.context?.equipmentId,
                divisionId: form.context?.divisionId, workflowId: clockOutWorkflow.id,
              },
            })}
            onSkip={() => {
              clearWorkflow();
              router.replace('/home');
            }}
          />
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <OfflineNotice />
      <ScreenHeader title="Clock Out" subtitle="Review your shift before submitting" />
      <View style={styles.summarySection}>
        <SectionHeader title="Shift Summary" />
        {activeEntry ? (
          <View style={styles.timeline}>
            {shiftSegments.map((segment, index) => (
              <View key={segment.id} style={styles.segmentRow}>
                <View style={styles.timelineRail}>
                  <View style={[styles.timelineDot, segment.id === activeEntry.id && styles.timelineDotActive]} />
                  {index < shiftSegments.length - 1 ? <View style={styles.timelineLine} /> : null}
                </View>
                <View style={styles.segmentContent}>
                  <Text style={styles.segmentTime}>{formatEntryTimeRange(segment, segment.id === activeEntry.id, businessTimeZone)}</Text>
                  <View style={styles.segmentHeading}>
                    <Text style={styles.segmentTitle}>{getWorkTypeLabel(segment.workType)}</Text>
                    <Text style={styles.segmentDuration}>{formatDurationForEntry(segment)}</Text>
                  </View>
                  {segment.workType !== 'drive_time' ? <Text style={styles.segmentMeta}>{resolveEntryPrimaryLabel(segment, jobs)}</Text> : null}
                </View>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Shift Time</Text>
              <Text testID="total-shift-time-value" style={styles.totalValue}>{formatDurationMinutes(totalShiftMinutes)}</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.formSection}>
        <Text style={styles.label}>Notes <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput
          multiline
          numberOfLines={4}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add optional notes about today's work..."
          placeholderTextColor={colors.inputPlaceholder}
          style={[styles.input, styles.notes]}
        />

        <View style={styles.photoCard}>
          <View style={styles.photoHeading}>
            <Text style={styles.photoLabel}>Photo <Text style={styles.optional}>(optional)</Text></Text>
            <StatusBadge label={`${attachments.length}/${MAX_TIME_ENTRY_PHOTOS}`} />
          </View>
          <Text style={styles.photoMeta}>Attach photos of completed work.</Text>
          {offline ? <StatusBanner tone="offline" message="Photos require a connection. You can clock out now without photos." /> : null}

          {attachments.map((attachment) => (
            <View key={attachment.localId} style={styles.photoPreviewBlock}>
              <Image source={{ uri: attachment.uri }} style={styles.photoPreview} />
              <Text style={styles.photoName}>{attachment.name || 'Photo attached'}</Text>
              <Text style={styles.photoStatus}>
                {attachment.status === 'uploading' ? 'Uploading' : attachment.status === 'uploaded' ? 'Uploaded' : attachment.error || 'Failed'}
              </Text>
              <View style={styles.photoActionsRow}>
                {attachment.status === 'failed' ? (
                  <Pressable
                    accessibilityRole="button"
                    style={styles.photoAction}
                    disabled={uploadingPhoto || loading}
                    onPress={() => retryAttachment(attachment.localId)}
                  >
                    <Text style={styles.photoActionText}>Retry</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  style={styles.photoAction}
                  disabled={uploadingPhoto || loading}
                  onPress={() => removeAttachment(attachment.localId)}
                >
                  <Text style={styles.photoActionText}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ))}

          {!offline && attachments.length < MAX_TIME_ENTRY_PHOTOS ? (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.photoAddButton, pressed && styles.photoAddButtonPressed]}
              disabled={uploadingPhoto || loading}
              onPress={() => { void promptPhotoSource(); }}
            >
              <Text style={styles.photoAddButtonText}>Add Photo</Text>
            </Pressable>
          ) : null}

          {uploadingPhoto ? (
            <View style={styles.uploadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.uploadingText}>Attaching photo...</Text>
            </View>
          ) : null}
        </View>
      </View>

      {success ? <StatusBanner tone="success" message={success} /> : null}
      {postActionForms.length > 0 ? (
        <AdvisoryFormsPrompt
          forms={postActionForms}
          heading={`${postActionForms.length} form${postActionForms.length === 1 ? '' : 's'} need${postActionForms.length === 1 ? 's' : ''} your attention`}
          message="Your clock-out is complete."
          skipLabel="Do Later"
          onComplete={(form) => {
            const activeWorkflow = workflow?.originRoute === '/clock-out' ? workflow : null;
            if (!activeWorkflow) return;
            router.push({
              pathname: '/form',
              params: {
                list: 'todo', formId: form.id, trigger: form.trigger,
                jobId: form.context?.jobId, equipmentId: form.context?.equipmentId,
                divisionId: form.context?.divisionId, workflowId: activeWorkflow.id,
              },
            });
          }}
          onSkip={() => {
            clearWorkflow();
            router.replace('/home');
          }}
        />
      ) : null}
      {error ? <StatusBanner tone="error" message={error} /> : null}
      {permissionSettingsRequired ? (
        <PrimaryActionButton
          label="Open Settings"
          disabled={loading}
          onPress={() => { void Linking.openSettings(); }}
        />
      ) : null}
      {!activeEntry && !navigatingAfterSuccess ? <StatusBanner tone="info" message="No active shift found. Refresh and try again." /> : null}

      {postActionForms.length === 0 ? (
        <PrimaryActionButton
          label={loading ? 'Clocking out...' : 'Clock Out'}
          disabled={!activeEntry || loading || hasIncompletePhoto}
          onPress={onConfirmClockOut}
        />
      ) : null}

      {error && retryMeta ? (
        <PrimaryActionButton
          label="Retry Clock Out"
          disabled={loading || hasIncompletePhoto}
          onPress={() => void submitClockOut(retryMeta)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  completionMessage: { color: colors.textSecondary, fontSize: 15, lineHeight: 21 },
  summarySection: { gap: 8 },
  timeline: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 8 },
  segmentRow: { flexDirection: 'row', minHeight: 76 },
  timelineRail: { width: 24, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border, marginTop: 5 },
  timelineDotActive: { backgroundColor: colors.primary },
  timelineLine: { width: 1, flex: 1, backgroundColor: colors.divider, marginVertical: 3 },
  segmentContent: { flex: 1, paddingBottom: 14 },
  segmentTime: { color: colors.textSecondary, fontSize: 13 },
  segmentHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 3 },
  segmentTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  segmentDuration: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  segmentMeta: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12 },
  totalLabel: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  totalValue: { minWidth: 72, color: colors.primary, fontSize: 18, fontWeight: '700', textAlign: 'right' },
  formSection: { gap: 10 },
  optional: { color: colors.textMuted, fontWeight: '400' },
  photoHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 12,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  shiftSummary: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 3,
  },
  shiftJob: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '600',
  },
  shiftMeta: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    minHeight: 52,
    borderRadius: 12,
    borderColor: colors.border,
    borderWidth: 1,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  notes: {
    minHeight: 110,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  photoCard: {
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.surface,
  },
  photoLabel: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  photoMeta: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  photoPreviewBlock: {
    gap: 10,
  },
  photoPreview: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },
  photoName: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  photoStatus: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoAction: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flex: 1,
  },
  photoActionText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  photoAddButton: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  photoAddButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  photoAddButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
