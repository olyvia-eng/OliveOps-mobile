import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { OfflineNotice } from '@/components/OfflineNotice';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { completeUpload, deleteUploadedFile, prepareUpload, uploadUriToS3 } from '@/api/storageApi';
import { MAX_TIME_ENTRY_PHOTOS } from '@/features/clocking/constants';
import { formatElapsedShort, resolveCurrentActiveEntry, resolveJobTitle } from '@/features/clocking/presentation';
import { useClockingActions } from '@/hooks/useClockingActions';
import { isOnline } from '@/services/connectivity';
import { createRequestMeta } from '@/services/requestGuards';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { colors } from '@/theme/colors';
import { toUserFacingError } from '@/utils/userFacingError';

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
  const { currentActiveEntryId, timeEntries, jobs } = useClockingStore();
  const { clockOut, loading, refreshWorkContext } = useClockingActions();

  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<PhotoAttachment[]>([]);
  const [retryMeta, setRetryMeta] = useState<{ requestId: string; idempotencyKey: string } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attachmentsRef = useRef<PhotoAttachment[]>([]);
  const submittedRef = useRef(false);
  const cleanedFileIdsRef = useRef<Set<string>>(new Set());

  const uploadingPhoto = attachments.some((attachment) => attachment.status === 'uploading');
  const hasIncompletePhoto = attachments.some((attachment) => attachment.status !== 'uploaded');

  const activeEntry = useMemo(() => {
    return resolveCurrentActiveEntry(timeEntries, user?.employeeId, currentActiveEntryId);
  }, [currentActiveEntryId, timeEntries, user?.employeeId]);

  useEffect(() => {
    void refreshWorkContext();
  }, [refreshWorkContext]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

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

  function promptPhotoSource() {
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
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Camera permission is required to capture a clock-out photo.');
        return;
      }
    }

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

  async function submitClockOut(metaOverride?: { requestId: string; idempotencyKey: string }) {
    if (!activeEntry) {
      setError('No active shift found.');
      return;
    }

    setError(null);
    setSuccess(null);

    const meta = metaOverride ?? retryMeta ?? createRequestMeta(activeEntry.id);
    setRetryMeta(meta);

    const uploadedPhotoAttachmentFileIds = attachments
      .filter((attachment) => attachment.status === 'uploaded' && Boolean(attachment.fileId))
      .map((attachment) => attachment.fileId as string);

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
    submittedRef.current = true;
    setSuccess('Clock-out submitted successfully.');
    router.replace('/home');
  }

  function onConfirmClockOut() {
    Alert.alert('Confirm Clock Out', 'Submit this clock-out now?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: () => { void submitClockOut(); } },
    ]);
  }

  return (
    <Screen>
      <OfflineNotice />
      <View style={styles.card}>
        <Text style={styles.title}>Shift summary</Text>
        {activeEntry ? (
          <View style={styles.shiftSummary}>
            <Text style={styles.shiftJob}>{shiftLabel}</Text>
            <Text style={styles.shiftMeta}>Started {new Date(activeEntry.clockIn).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
            <Text style={styles.shiftMeta}>Duration {formatElapsedShort(activeEntry.clockIn)}</Text>
          </View>
        ) : null}
        <Text style={styles.label}>Notes</Text>
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
          <Text style={styles.photoLabel}>Photo</Text>
          <Text style={styles.photoMeta}>Optional - attach up to {MAX_TIME_ENTRY_PHOTOS} photos of completed work. ({attachments.length}/{MAX_TIME_ENTRY_PHOTOS})</Text>

          {attachments.map((attachment) => (
            <View key={attachment.localId} style={styles.photoPreviewBlock}>
              <Image source={{ uri: attachment.uri }} style={styles.photoPreview} />
              <Text style={styles.photoName}>{attachment.name || 'Photo attached'}</Text>
              <Text style={styles.photoStatus}>
                {attachment.status === 'uploading' ? 'Uploading...' : attachment.status === 'uploaded' ? 'Attached' : attachment.error || 'Upload failed'}
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

          {attachments.length < MAX_TIME_ENTRY_PHOTOS ? (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.photoAddButton, pressed && styles.photoAddButtonPressed]}
              disabled={uploadingPhoto || loading}
              onPress={promptPhotoSource}
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
      {error ? <StatusBanner tone="error" message={error} /> : null}
      {!activeEntry ? <StatusBanner tone="info" message="No active shift found. Refresh and try again." /> : null}

      <PrimaryActionButton
        label={loading ? 'Clocking out...' : 'Clock Out'}
        disabled={!activeEntry || loading || hasIncompletePhoto}
        onPress={onConfirmClockOut}
      />

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
