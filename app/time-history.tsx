import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDurationForEntry, formatDurationMinutes, formatEntryTimeRange, resolveJobTitle } from '@/features/clocking/presentation';
import { useClockingStore } from '@/store/clockingStore';
import { getTodayEntries, getWeekTotalHours } from '@/api/timeEntriesApi';
import { colors } from '@/theme/colors';

export default function TimeHistoryScreen() {
  const { timeEntries, jobs } = useClockingStore();
  const todayEntries = useMemo(() => getTodayEntries(timeEntries), [timeEntries]);
  const orderedEntries = useMemo(
    () => [...todayEntries].sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime()),
    [todayEntries]
  );
  const weekTotal = useMemo(() => getWeekTotalHours(timeEntries), [timeEntries]);
  const weekTotalLabel = useMemo(() => formatDurationMinutes(weekTotal * 60), [weekTotal]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        data={orderedEntries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <View style={styles.headerCard}>
            <Text style={styles.title}>Today's entries</Text>
            <Text style={styles.meta}>Today entries: {todayEntries.length}</Text>
            <Text style={styles.meta}>This week total: {weekTotalLabel}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.entryCard}>
            <View style={styles.entryTopRow}>
              <Text style={styles.entryJob}>{resolveJobTitle(item, jobs)}</Text>
              {item.clockOut ? (
                <Text style={styles.entryDuration}>{formatDurationForEntry(item)}</Text>
              ) : (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeDot}>●</Text>
                  <Text style={styles.activeLabel}>Active</Text>
                </View>
              )}
            </View>
            <Text style={styles.entryDateLabel}>Today</Text>
            <Text style={styles.entryRange}>{formatEntryTimeRange(item)}</Text>
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
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
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
    gap: 6,
  },
  entryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  entryJob: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  entryDuration: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.successBorder,
    backgroundColor: colors.successBackground,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  activeDot: {
    color: colors.primary,
    fontSize: 10,
  },
  activeLabel: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  entryDateLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  entryRange: {
    color: colors.textPrimary,
    fontSize: 15,
  },
  empty: {
    color: colors.textSecondary,
    fontSize: 15,
    marginTop: 12,
  },
});
