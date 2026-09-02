import { useEffect, useRef } from 'react';
import { AppState, StyleSheet, View, type AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import { EmptyState, ListRow, ScreenHeader, SectionHeader, StatusBadge } from '@/components/MobilePrimitives';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { formatTimeOffDateRange, getTimeOffStatusLabel, getTimeOffTypeLabel, statusBadgeTone } from '@/features/timeOff/presentation';
import { useTimeOffActions } from '@/hooks/useTimeOffActions';
import { useTimeOffStore } from '@/store/timeOffStore';
import { spacing } from '@/theme/colors';

export default function TimeOffScreen() {
  const { requests, loaded, listError, flashMessage, setFlashMessage } = useTimeOffStore();
  const { refresh, loadingList } = useTimeOffActions();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const wasAway = appStateRef.current === 'background' || appStateRef.current === 'inactive';
      appStateRef.current = next;
      if (next === 'active' && wasAway) void refresh();
    });
    return () => subscription.remove();

  }, [refresh]);

  return (
    <Screen testID="time-off-screen">
      <ScreenHeader title="Time Off" subtitle="Submit and track your requests" />
      {flashMessage ? <StatusBanner tone="success" message={flashMessage} /> : null}
      <PrimaryActionButton
        label="+ Request Time Off"
        onPress={() => {
          setFlashMessage(null);
          router.push('/request-time-off');
        }}
      />
      <SectionHeader title="My Requests" />

      {!loaded && loadingList ? <LoadingState label="Loading time-off requests..." /> : null}
      {!loaded && !loadingList && listError ? (
        <ErrorState message={listError} onRetry={() => { void refresh(); }} />
      ) : null}
      {loaded && listError ? <StatusBanner tone="error" message={listError} /> : null}
      {loaded && requests.length === 0 ? (
        <EmptyState
          title="No time-off requests yet"
          message="Your submitted requests will appear here."
          action={<PrimaryActionButton label="Request Time Off" onPress={() => router.push('/request-time-off')} />}
        />
      ) : null}
      {requests.length > 0 ? (
        <View style={styles.list}>
          {requests.map((request) => (
            <ListRow
              key={request.id}
              testID={`time-off-row-${request.id}`}
              title={getTimeOffTypeLabel(request.requestType)}
              subtitle={formatTimeOffDateRange(request.startDate, request.endDate)}
              detail={getTimeOffStatusLabel(request.status)}
              leading={<StatusBadge label={getTimeOffStatusLabel(request.status)} tone={statusBadgeTone(request.status)} />}
              onPress={() => router.push({ pathname: '/time-off-detail', params: { id: request.id } })}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { gap: spacing.xs } });

