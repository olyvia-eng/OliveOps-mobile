import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { getCorrectionTypeLabel } from '@/features/clocking/presentation';
import { useTimeCorrectionActions } from '@/hooks/useTimeCorrectionActions';
import { useClockingStore } from '@/store/clockingStore';
import { colors } from '@/theme/colors';

export default function MyCorrectionRequestsScreen() {
  const { timeCorrections } = useClockingStore();
  const { refreshMyCorrections } = useTimeCorrectionActions();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshMyCorrections().then((result) => {
      setError(result.ok ? null : (result.error || 'Could not load correction requests.'));
    });
  }, [refreshMyCorrections]);

  const ordered = useMemo(
    () => [...timeCorrections].sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt)),
    [timeCorrections],
  );

  return (
    <Screen>
      <Text style={styles.title}>My Correction Requests</Text>
      {error ? <StatusBanner tone="error" message={error} /> : null}

      <FlatList
        data={ordered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No correction requests yet.</Text>}
        renderItem={({ item }) => {
          const statusTone = item.status === 'approved'
            ? styles.badgeApproved
            : item.status === 'rejected'
              ? styles.badgeRejected
              : styles.badgePending;

          const requestedSummary = [
            item.requestedClockInAt ? `Start: ${new Date(item.requestedClockInAt).toLocaleString()}` : null,
            item.requestedClockOutAt ? `End: ${new Date(item.requestedClockOutAt).toLocaleString()}` : null,
            item.requestedJobId ? `Job: ${item.requestedJobId}` : null,
            item.requestedActivityType ? `Activity: ${item.requestedActivityType.replace('_', ' ')}` : null,
          ].filter(Boolean).join(' • ') || 'Details in request note';

          return (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.dateText}>{new Date(item.submittedAt).toLocaleDateString()}</Text>
                <View style={[styles.badge, statusTone]}>
                  <Text style={styles.badgeLabel}>{item.status[0].toUpperCase() + item.status.slice(1)}</Text>
                </View>
              </View>
              <Text style={styles.typeText}>{getCorrectionTypeLabel(item.requestType)}</Text>
              <Text style={styles.summaryText}>{requestedSummary}</Text>
              <Text style={styles.reasonText}>{item.reason}</Text>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  listContent: {
    gap: 10,
    paddingBottom: 20,
  },
  empty: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 6,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  typeText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  summaryText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  reasonText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgePending: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  badgeApproved: {
    borderColor: colors.successBorder,
    backgroundColor: colors.successBackground,
  },
  badgeRejected: {
    borderColor: colors.error,
    backgroundColor: colors.surfaceMuted,
  },
  badgeLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
});
