import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { useClockingActions } from '@/hooks/useClockingActions';
import { useAuthStore } from '@/store/authStore';

export default function ClockInScreen() {
  const { user } = useAuthStore();
  const { clockIn, loading } = useClockingActions();
  const [jobId, setJobId] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => Boolean(user?.employeeId && jobId.trim()), [user?.employeeId, jobId]);

  async function onClockIn() {
    if (!user?.employeeId) {
      setError('Employee profile is not linked to this account.');
      return;
    }

    setStatus(null);
    setError(null);
    const result = await clockIn(user.employeeId, [jobId.trim()]);

    if (!result.ok) {
      setError(result.error || 'Clock-in failed.');
      return;
    }

    setStatus('Clock-in submitted successfully.');
    router.replace('/active-shift');
  }

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>Clock In</Text>
        <Text style={styles.help}>Enter your assigned job ID for now. Job picker wiring lands in the next milestone.</Text>
        <TextInput
          value={jobId}
          onChangeText={setJobId}
          placeholder="Assigned job ID"
          placeholderTextColor="#64748B"
          style={styles.input}
        />
      </View>

      {status ? <StatusBanner tone="success" message={status} /> : null}
      {error ? <StatusBanner tone="error" message={error} /> : null}

      <PrimaryActionButton
        label={loading ? 'Submitting...' : 'Confirm Clock In'}
        disabled={!canSubmit || loading}
        onPress={() => void onClockIn()}
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
  help: {
    color: '#CBD5E1',
    fontSize: 14,
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
});
