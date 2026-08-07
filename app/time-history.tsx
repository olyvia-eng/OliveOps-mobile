import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { useClockingStore } from '@/store/clockingStore';
import { getTodayEntries, getWeekTotalHours } from '@/api/timeEntriesApi';

export default function TimeHistoryScreen() {
  const { timeEntries } = useClockingStore();
  const todayEntries = useMemo(() => getTodayEntries(timeEntries), [timeEntries]);
  const weekTotal = useMemo(() => getWeekTotalHours(timeEntries), [timeEntries]);

  return (
    <Screen>
      <View style={styles.headerCard}>
        <Text style={styles.title}>Time History</Text>
        <Text style={styles.meta}>Today entries: {todayEntries.length}</Text>
        <Text style={styles.meta}>This week total: {weekTotal.toFixed(2)} hours</Text>
      </View>

      <FlatList
        data={todayEntries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10 }}
        renderItem={({ item }) => (
          <View style={styles.entryCard}>
            <Text style={styles.entryText}>In: {new Date(item.clockIn).toLocaleTimeString()}</Text>
            <Text style={styles.entryText}>Out: {item.clockOut ? new Date(item.clockOut).toLocaleTimeString() : 'Active'}</Text>
            <Text style={styles.entryText}>Job: {(item.jobIds && item.jobIds[0]) || item.jobId || 'N/A'}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No time entries for today.</Text>}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    borderRadius: 14,
    backgroundColor: '#111827',
    padding: 16,
    gap: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  meta: {
    color: '#E2E8F0',
    fontSize: 16,
  },
  entryCard: {
    borderRadius: 12,
    backgroundColor: '#1F2937',
    padding: 14,
    gap: 4,
  },
  entryText: {
    color: '#F1F5F9',
    fontSize: 15,
  },
  empty: {
    color: '#94A3B8',
    fontSize: 16,
  },
});
