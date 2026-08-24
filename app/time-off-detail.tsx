import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenHeader, StatusBadge } from '@/components/MobilePrimitives';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { Screen } from '@/components/Screen';
import { SecondaryButton } from '@/components/SecondaryButton';
import { StatusBanner } from '@/components/StatusBanner';
import { formatTimeOffDateRange, getTimeOffStatusLabel, getTimeOffTypeLabel, statusBadgeTone } from '@/features/timeOff/presentation';
import { useTimeOffActions } from '@/hooks/useTimeOffActions';
import { useTimeOffStore } from '@/store/timeOffStore';
import { colors, radii, spacing, typography } from '@/theme/colors';

function formatTimestamp(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function TimeOffDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const requestId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { requests, details } = useTimeOffStore();
  const { loadDetail, cancel, loadingDetail, cancellingId } = useTimeOffActions();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const request = requestId ? details[requestId] ?? requests.find((item) => item.id === requestId) : undefined;

  async function refresh() {
    if (!requestId) return;
    const result = await loadDetail(requestId);
    setError(result.ok ? null : result.error ?? 'Could not load this request.');
  }

  useEffect(() => { void refresh(); }, [requestId]);

  function confirmCancel() {
    if (!requestId) return;
    Alert.alert(
      'Cancel time-off request?',
      'This request will remain in your history as cancelled.',
      [
        { text: 'Keep Request', style: 'cancel' },
        {
          text: 'Cancel Request', style: 'destructive', onPress: () => {
            void cancel(requestId).then((result) => {
              if (result.ok) {
                setError(null);
                setNotice('Time-off request cancelled.');
              } else if (result.statusChanged) {
                setError(null);
                setNotice(result.error ?? 'This request changed before it could be cancelled.');
              } else {
                setError(result.error ?? 'Could not cancel this request.');
              }
            });
          },
        },
      ],
    );
  }

  return (
    <Screen testID="time-off-detail-screen">
      <ScreenHeader title="Time Off Details" subtitle="Review your submitted request" />
      {!request && loadingDetail ? <LoadingState label="Loading request..." /> : null}
      {!request && error ? <ErrorState message={error} onRetry={() => { void refresh(); }} /> : null}
      {!request && !error && !loadingDetail ? <ErrorState message="Time-off request not found." /> : null}
      {request ? (
        <>
          {error ? <StatusBanner tone="error" message={error} /> : null}
          {notice ? <StatusBanner tone="info" message={notice} /> : null}
          <View style={styles.heading}>
            <View style={styles.headingText}>
              <Text style={styles.type}>{getTimeOffTypeLabel(request.requestType)}</Text>
              <Text style={styles.dates}>{formatTimeOffDateRange(request.startDate, request.endDate, true)}</Text>
            </View>
            <StatusBadge label={getTimeOffStatusLabel(request.status)} tone={statusBadgeTone(request.status)} />
          </View>
          <View style={styles.details}>
            <Detail label="Start Date" value={request.startDate} />
            <Detail label="End Date" value={request.endDate} />
            <Detail label="Your Note" value={request.employeeNote || 'No note provided'} />
            <Detail label="Submitted" value={formatTimestamp(request.submittedAt)} />
            {request.reviewedAt ? <Detail label="Reviewed" value={formatTimestamp(request.reviewedAt)} /> : null}
            {request.reviewNote ? <Detail label="Manager Note" value={request.reviewNote} /> : null}
            {request.cancelledAt ? <Detail label="Cancelled" value={formatTimestamp(request.cancelledAt)} /> : null}
          </View>
          {request.status === 'pending' ? (
            <SecondaryButton
              label={cancellingId === request.id ? 'Cancelling...' : 'Cancel Request'}
              destructive
              disabled={cancellingId === request.id}
              onPress={confirmCancel}
            />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  headingText: { flex: 1, gap: spacing.xs },
  type: { color: colors.textPrimary, fontSize: typography.title, fontWeight: typography.bold },
  dates: { color: colors.textSecondary, fontSize: typography.body },
  details: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radii.md, backgroundColor: colors.surface, overflow: 'hidden' },
  detailRow: { padding: spacing.md, gap: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  label: { color: colors.textSecondary, fontSize: typography.caption, fontWeight: typography.semibold, textTransform: 'uppercase' },
  value: { color: colors.textPrimary, fontSize: typography.body },
});
