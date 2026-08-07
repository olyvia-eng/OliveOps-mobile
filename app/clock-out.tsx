import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { OfflineNotice } from '@/components/OfflineNotice';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { completeUpload, prepareUpload, uploadUriToS3 } from '@/api/storageApi';
import { useClockingActions } from '@/hooks/useClockingActions';
import { isOnline } from '@/services/connectivity';
import { createRequestMeta } from '@/services/requestGuards';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';

export default function ClockOutScreen() {
  const { user, accessToken } = useAuthStore();
  const { timeEntries } = useClockingStore();
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
    return timeEntries.find((entry) => entry.employeeId === user.employeeId && entry.status === 'clocked_in') || null;
  }, [timeEntries, user?.employeeId]);

  useEffect(() => {
    void refreshWorkContext();
  }, [refreshWorkContext]);

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

    setPhotoUri(asset.uri);
    setPhotoName(asset.fileName || `clock-out-${Date.now()}.jpg`);
    setPhotoFileId('');
    setSuccess(null);
    setError(null);
  }

  async function uploadPhotoAttachment() {
    if (!activeEntry) {
      setError('No active shift found for upload.');
      return;
    }
    if (!photoUri) {
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
      const extension = photoName.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
      const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
      const fileResponse = await fetch(photoUri);
      const blob = await fileResponse.blob();
      if (!blob.size) {
        throw new Error('Could not read selected photo size.');
      }

      const prepared = await prepareUpload({
        action: 'prepare-upload',
        fileName: photoName || `clock-out-${Date.now()}.${extension}`,
        mimeType,
        sizeBytes: blob.size,
        entityType: 'time-entry',
        entityId: activeEntry.id,
        category: 'clock-out-photo',
      }, accessToken);

      if (!prepared.fileId || !prepared.uploadUrl) {
        throw new Error(prepared.error || 'Upload could not be prepared.');
      }

      await uploadUriToS3(prepared.uploadUrl, photoUri, mimeType, prepared.requiredHeaders);
      await completeUpload(prepared.fileId, accessToken);

      setPhotoFileId(prepared.fileId);
      setSuccess('Photo uploaded and verified.');
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

    if (!notes.trim()) {
      setError('Add notes before clocking out.');
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
        <Text style={styles.title}>Clock Out</Text>
        <TextInput
          multiline
          numberOfLines={4}
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes"
          placeholderTextColor="#64748B"
          style={[styles.input, styles.notes]}
        />
        <View style={styles.photoCard}>
          <Text style={styles.photoLabel}>Optional photo attachment</Text>
          <Text style={styles.photoMeta}>{photoName || 'No photo selected'}</Text>
          {photoFileId ? <Text style={styles.photoMeta}>Uploaded fileId: {photoFileId}</Text> : null}
          <PrimaryActionButton label="Capture Photo" disabled={uploadingPhoto || loading} onPress={() => void choosePhoto()} />
          <PrimaryActionButton
            label={uploadingPhoto ? 'Uploading Photo...' : 'Upload Photo'}
            disabled={!photoUri || uploadingPhoto || loading}
            onPress={() => void uploadPhotoAttachment()}
          />
        </View>
      </View>

      {success ? <StatusBanner tone="success" message={success} /> : null}
      {error ? <StatusBanner tone="error" message={error} /> : null}
      {!activeEntry ? <StatusBanner tone="info" message="No active shift found. Refresh and try again." /> : null}

      <PrimaryActionButton
        label={loading ? 'Submitting...' : 'Confirm Clock Out'}
        disabled={!activeEntry || loading || uploadingPhoto || !notes.trim()}
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
    backgroundColor: '#111827',
    padding: 16,
    gap: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  input: {
    minHeight: 52,
    borderRadius: 10,
    borderColor: '#334155',
    borderWidth: 1,
    color: '#FFFFFF',
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    fontSize: 18,
  },
  notes: {
    minHeight: 110,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  photoCard: {
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#0B1220',
  },
  photoLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  photoMeta: {
    color: '#CBD5E1',
    fontSize: 13,
  },
});
