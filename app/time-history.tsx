import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { resolveJobTitle } from '@/features/clocking/presentation';
import { useClockingStore } from '@/store/clockingStore';
import { getTodayEntries, getWeekTotalHours } from '@/api/timeEntriesApi';
import { colors } from '@/theme/colors';

export default function TimeHistoryScreen() {
  const { timeEntries, jobs } = useClockingStore();
  const todayEntries = useMemo(() => getTodayEntries(timeEntries), [timeEntries]);
  const weekTotal = useMemo(() => getWeekTotalHours(timeEntries), [timeEntries]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        data={todayEntries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <View style={styles.headerCard}>
            <Text style={styles.title}>Time History</Text>
            <Text style={styles.meta}>Today entries: {todayEntries.length}</Text>
            <Text style={styles.meta}>This week total: {weekTotal.toFixed(2)} hours</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.entryCard}>
            <Text style={styles.entryText}>In: {new Date(item.clockIn).toLocaleTimeString()}</Text>
            <Text style={styles.entryText}>Out: {item.clockOut ? new Date(item.clockOut).toLocaleTimeString() : 'Active'}</Text>
            <Text style={styles.entryText}>Job: {resolveJobTitle(item, jobs)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No time entries for today.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 10,
  },
  headerCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 6,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 31,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  entryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 4,
  },
  entryText: {
    color: colors.textPrimary,
    fontSize: 15,
  },
  empty: {
    color: colors.textSecondary,
    fontSize: 15,
    marginTop: 12,
  },
});
