import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { EmptyState, ScreenHeader, StatusBadge } from '@/components/MobilePrimitives';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { getCorrectionTypeLabel } from '@/features/clocking/presentation';
import { useTimeCorrectionActions } from '@/hooks/useTimeCorrectionActions';
import { useClockingStore } from '@/store/clockingStore';
import { colors } from '@/theme/colors';
import { formatBusinessDate, formatBusinessDateTime } from '@/utils/businessTime';

export default function MyCorrectionRequestsScreen() {
  const { businessTimeZone, timeCorrections } = useClockingStore();
  const { loading, refreshMyCorrections } = useTimeCorrectionActions();
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
      <ScreenHeader title="Correction Requests" subtitle="Track requested changes to your time" />
      {error ? <StatusBanner tone="error" message={error} /> : null}
      {error ? <PrimaryActionButton label="Retry" disabled={loading} onPress={() => { void refreshMyCorrections(); }} /> : null}

      <FlatList
        data={ordered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState title="No correction requests" message="Requests you submit will appear here." />}
        renderItem={({ item }) => {
          const requestedSummary = [
            item.requestedClockInAt ? `Start: ${formatBusinessDateTime(new Date(item.requestedClockInAt), businessTimeZone)}` : null,
            item.requestedClockOutAt ? `End: ${formatBusinessDateTime(new Date(item.requestedClockOutAt), businessTimeZone)}` : null,
            item.requestedJobId ? `Job: ${item.requestedJobId}` : null,
            item.requestedActivityType ? `Activity: ${item.requestedActivityType.replace('_', ' ')}` : null,
          ].filter(Boolean).join(' • ') || 'Details in request note';

          return (
            <View style={styles.requestRow}>
              <View style={styles.rowBetween}>
                <Text style={styles.typeText}>{getCorrectionTypeLabel(item.requestType)}</Text>
                <StatusBadge
                  label={item.status[0].toUpperCase() + item.status.slice(1)}
                  tone={item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'error' : 'neutral'}
                />
              </View>
              <Text style={styles.summaryText}>{requestedSummary}</Text>
              <Text style={styles.reasonText}>{item.reason}</Text>
              <Text style={styles.dateText}>Submitted {formatBusinessDate(new Date(item.submittedAt), businessTimeZone)}</Text>
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
    gap: 0,
    paddingBottom: 20,
  },
  requestRow: { borderTopWidth: 1, borderTopColor: colors.divider, paddingVertical: 14, gap: 5 },
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
