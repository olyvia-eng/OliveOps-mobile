import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { OfflineNotice } from '@/components/OfflineNotice';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { completeUpload, prepareUpload, uploadUriToS3 } from '@/api/storageApi';
import { formatElapsedShort, resolveJobTitle } from '@/features/clocking/presentation';
import { useClockingActions } from '@/hooks/useClockingActions';
import { isOnline } from '@/services/connectivity';
import { createRequestMeta } from '@/services/requestGuards';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { colors } from '@/theme/colors';

export default function ClockOutScreen() {
  const { user, accessToken } = useAuthStore();
  const { timeEntries, jobs } = useClockingStore();
  const { clockOut, loading, refreshWorkContext } = useClockingActions();

  const [notes, setNotes] = useState('');
  const [photoFileId, setPhotoFileId] = useState('');
  const [photoUri, setPhotoUri] = useState('');
  const [photoName, setPhotoName] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [retryMeta, setRetryMeta] = useState<{ requestId: string; idempotencyKey: string } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeEntry = useMemo(() => {
    if (!user?.employeeId) return null;
    const activeEntries = timeEntries.filter((entry) => entry.employeeId === user.employeeId && entry.status === 'clocked_in');
    if (activeEntries.length === 0) return null;
    return activeEntries.sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime())[0] || null;
  }, [timeEntries, user?.employeeId]);

  useEffect(() => {
    void refreshWorkContext();
  }, [refreshWorkContext]);

  const shiftLabel = useMemo(() => {
    if (!activeEntry) return 'No active shift';
    return resolveJobTitle(activeEntry, jobs);
  }, [activeEntry, jobs]);

  async function choosePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera permission is required to capture a clock-out photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    const nextName = asset.fileName || `clock-out-${Date.now()}.jpg`;

    setPhotoUri(asset.uri);
    setPhotoName(nextName);
    setPhotoFileId('');
    setSuccess(null);
    setError(null);

    await uploadPhotoAttachment(asset.uri, nextName);
  }

  async function uploadPhotoAttachment(uriOverride?: string, nameOverride?: string) {
    if (!activeEntry) {
      setError('No active shift found for upload.');
      return;
    }
    const currentUri = uriOverride ?? photoUri;
    const currentName = nameOverride ?? photoName;

    if (!currentUri) {
      setError('Capture a photo before uploading.');
      return;
    }

    const online = await isOnline();
    if (!online) {
      setError('Offline. Reconnect and retry photo upload.');
      return;
    }

    setUploadingPhoto(true);
    setError(null);
    setSuccess(null);

    try {
      const extension = currentName.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
      const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
      const fileResponse = await fetch(currentUri);
      const blob = await fileResponse.blob();
      if (!blob.size) {
        throw new Error('Could not read selected photo size.');
      }

      const prepared = await prepareUpload({
        action: 'prepare-upload',
        fileName: currentName || `clock-out-${Date.now()}.${extension}`,
        mimeType,
        sizeBytes: blob.size,
        entityType: 'time-entry',
        entityId: activeEntry.id,
        category: 'clock-out-photo',
      }, accessToken);

      if (!prepared.fileId || !prepared.uploadUrl) {
        throw new Error(prepared.error || 'Upload could not be prepared.');
      }

      await uploadUriToS3(prepared.uploadUrl, currentUri, mimeType, prepared.requiredHeaders);
      await completeUpload(prepared.fileId, accessToken);

      setPhotoFileId(prepared.fileId);
      setSuccess('Photo attached.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Photo upload failed.');
    } finally {
      setUploadingPhoto(false);
    }
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

    const result = await clockOut(activeEntry.id, notes.trim(), photoFileId.trim() || undefined, meta);
    if (!result.ok) {
      setError(result.error || 'Clock-out failed.');
      return;
    }

    setRetryMeta(null);
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
          <Text style={styles.photoMeta}>Optional - attach a photo of completed work.</Text>

          {photoUri ? (
            <View style={styles.photoPreviewBlock}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              <Text style={styles.photoName}>{photoName || 'Photo attached'}</Text>
              <View style={styles.photoActionsRow}>
                <Pressable
                  accessibilityRole="button"
                  style={styles.photoAction}
                  disabled={uploadingPhoto || loading}
                  onPress={() => void choosePhoto()}
                >
                  <Text style={styles.photoActionText}>Replace Photo</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={styles.photoAction}
                  disabled={uploadingPhoto || loading}
                  onPress={() => {
                    setPhotoUri('');
                    setPhotoName('');
                    setPhotoFileId('');
                    setSuccess(null);
                  }}
                >
                  <Text style={styles.photoActionText}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.photoAddButton, pressed && styles.photoAddButtonPressed]}
              disabled={uploadingPhoto || loading}
              onPress={() => void choosePhoto()}
            >
              <Text style={styles.photoAddButtonText}>Add Photo</Text>
            </Pressable>
          )}

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
        disabled={!activeEntry || loading || uploadingPhoto}
        onPress={onConfirmClockOut}
      />

      {error && retryMeta ? (
        <PrimaryActionButton
          label="Retry Clock Out"
          disabled={loading || uploadingPhoto}
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
