import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { OfflineNotice } from '@/components/OfflineNotice';
import { StatusBanner } from '@/components/StatusBanner';
import { useClockingActions } from '@/hooks/useClockingActions';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { timeEntries } = useClockingStore();
  const { refreshWorkContext } = useClockingActions();
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void refreshWorkContext().then((result) => {
      if (!mounted) return;
      setLoadError(result.ok ? null : result.error || 'Could not load assigned jobs and shifts.');
    });

    return () => {
      mounted = false;
    };
  }, [refreshWorkContext]);

  const activeShift = useMemo(() => {
    if (!user?.employeeId) return null;
    return timeEntries.find((entry) => entry.employeeId === user.employeeId && entry.status === 'clocked_in') || null;
  }, [timeEntries, user?.employeeId]);

  const dominantLabel = activeShift ? 'Clock Out' : 'Clock In';

  function onDominantPress() {
    if (activeShift) {
      router.push('/clock-out');
      return;
    }
    router.push('/clock-in');
  }

  return (
    <Screen>
      <OfflineNotice />
      <View style={styles.panel}>
        <Text style={styles.greeting}>Hi {user?.name || 'Crew Member'}</Text>
        <Text style={styles.label}>Current status</Text>
        <Text style={styles.value}>{activeShift ? 'Clocked In' : 'Clocked Out'}</Text>
        <Text style={styles.help}>Current job and shift details are shown in Active Shift.</Text>
      </View>

      {loadError ? <StatusBanner tone="error" message={loadError} /> : null}

      <PrimaryActionButton label={dominantLabel} onPress={onDominantPress} />
      <PrimaryActionButton label="View Active Shift" onPress={() => router.push('/active-shift')} />
      <PrimaryActionButton label="Time History" onPress={() => router.push('/time-history')} />
      <PrimaryActionButton label="Settings" onPress={() => router.push('/settings')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 14,
    backgroundColor: '#111827',
    padding: 16,
    gap: 8,
  },
  greeting: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  label: {
    color: '#94A3B8',
    fontSize: 14,
    textTransform: 'uppercase',
  },
  value: {
    color: '#F8FAFC',
    fontSize: 30,
    fontWeight: '800',
  },
  help: {
    color: '#CBD5E1',
    fontSize: 15,
  },
});
