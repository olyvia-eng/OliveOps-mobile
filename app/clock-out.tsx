import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { useClockingActions } from '@/hooks/useClockingActions';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';

export default function ClockOutScreen() {
  const { user } = useAuthStore();
  const { timeEntries } = useClockingStore();
  const { clockOut, loading } = useClockingActions();

  const [notes, setNotes] = useState('');
  const [photoFileId, setPhotoFileId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activeEntry = useMemo(() => {
    if (!user?.employeeId) return null;
    return timeEntries.find((entry) => entry.employeeId === user.employeeId && entry.status === 'clocked_in') || null;
  }, [timeEntries, user?.employeeId]);

  async function onClockOut() {
    if (!activeEntry) {
      setError('No active shift found.');
      return;
    }

    setError(null);
    const result = await clockOut(activeEntry.id, notes.trim(), photoFileId.trim() || undefined);
    if (!result.ok) {
      setError(result.error || 'Clock-out failed.');
      return;
    }

    router.replace('/home');
  }

  return (
    <Screen>
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
        <TextInput
          value={photoFileId}
          onChangeText={setPhotoFileId}
          placeholder="Optional uploaded photo fileId"
          placeholderTextColor="#64748B"
          style={styles.input}
        />
      </View>

      {error ? <StatusBanner tone="error" message={error} /> : null}
      {!activeEntry ? <StatusBanner tone="info" message="No active shift found. Refresh and try again." /> : null}

      <PrimaryActionButton
        label={loading ? 'Submitting...' : 'Confirm Clock Out'}
        disabled={!activeEntry || loading}
        onPress={() => void onClockOut()}
      />
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
});
