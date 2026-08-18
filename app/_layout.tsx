import { useEffect, useRef } from 'react';
import { AppState, Pressable, StyleSheet, Text, type AppStateStatus } from 'react-native';
import { router, Stack } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { useClockingActions } from '@/hooks/useClockingActions';
import { useAuthStore } from '@/store/authStore';
import { AuthProvider } from '@/store/authStore';
import { ClockingProvider } from '@/store/clockingStore';
import { colors } from '@/theme/colors';

function CompactBackButton() {
  if (!router.canGoBack()) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={4}
      onPress={() => router.back()}
      style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
    >
      <Text style={styles.backChevron}>‹</Text>
    </Pressable>
  );
}

function secondaryScreenOptions(title: string) {
  return {
    title,
    headerBackVisible: false,
    headerLeft: () => <CompactBackButton />,
  };
}

function AppLifecycleSync() {
  const { status } = useAuthStore();
  const { refreshWorkContext } = useClockingActions();
  const previousStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackgrounded = previousStateRef.current === 'background'
        || previousStateRef.current === 'inactive';
      previousStateRef.current = nextState;

      if (nextState === 'active' && wasBackgrounded && status === 'authenticated') {
        void refreshWorkContext();
      }
    });

    return () => subscription.remove();
  }, [refreshWorkContext, status]);

  return null;
}

function RootLayout() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <ClockingProvider>
          <AppLifecycleSync />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.textPrimary,
              headerTitleStyle: { fontSize: 17, fontWeight: '700' },
              headerBackButtonDisplayMode: 'minimal',
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="home" options={{ title: 'Home', headerBackVisible: false, gestureEnabled: false }} />
            <Stack.Screen name="clock-in" options={secondaryScreenOptions('Clock In')} />
            <Stack.Screen name="switch-activity" options={secondaryScreenOptions('Switch Activity')} />
            <Stack.Screen name="active-shift" options={secondaryScreenOptions('Active Shift')} />
            <Stack.Screen name="clock-out" options={secondaryScreenOptions('Clock Out')} />
            <Stack.Screen name="time-history" options={secondaryScreenOptions('Time History')} />
            <Stack.Screen name="request-time-correction" options={secondaryScreenOptions('Request Time Correction')} />
            <Stack.Screen name="my-correction-requests" options={secondaryScreenOptions('Correction Requests')} />
            <Stack.Screen name="settings" options={secondaryScreenOptions('Settings')} />
          </Stack>
        </ClockingProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  backButton: {
    width: 44,
    height: 44,
    marginLeft: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: { opacity: 0.5 },
  backChevron: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 30,
  },
});
