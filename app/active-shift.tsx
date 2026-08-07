import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';

function elapsedHours(clockIn: string) {
  const start = new Date(clockIn).getTime();
  const now = Date.now();
  return Math.max(0, (now - start) / (1000 * 60 * 60)).toFixed(2);
}

export default function ActiveShiftScreen() {
  const { user } = useAuthStore();
  const { timeEntries } = useClockingStore();

  const entry = useMemo(() => {
    if (!user?.employeeId) return null;
    return timeEntries.find((item) => item.employeeId === user.employeeId && item.status === 'clocked_in') || null;
  }, [timeEntries, user?.employeeId]);

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>Active Shift</Text>
        {!entry ? (
          <Text style={styles.text}>No active shift right now.</Text>
        ) : (
          <>
            <Text style={styles.text}>Clocked in at: {new Date(entry.clockIn).toLocaleString()}</Text>
            <Text style={styles.text}>Running hours: {elapsedHours(entry.clockIn)}</Text>
            <Text style={styles.text}>Job: {(entry.jobIds && entry.jobIds[0]) || entry.jobId || 'Not set'}</Text>
          </>
        )}
      </View>

      <PrimaryActionButton label="Go To Clock Out" onPress={() => router.push('/clock-out')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    backgroundColor: '#111827',
    padding: 16,
    gap: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  text: {
    color: '#E2E8F0',
    fontSize: 16,
  },
});
