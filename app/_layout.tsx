import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { useClockingActions } from '@/hooks/useClockingActions';
import { useAuthStore } from '@/store/authStore';
import { AuthProvider } from '@/store/authStore';
import { ClockingProvider } from '@/store/clockingStore';
import { colors } from '@/theme/colors';

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
              headerTitleStyle: { fontWeight: '700' },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="home" options={{ title: 'Home' }} />
            <Stack.Screen name="clock-in" options={{ title: 'Clock In' }} />
            <Stack.Screen name="switch-activity" options={{ title: 'Switch Activity' }} />
            <Stack.Screen name="active-shift" options={{ title: 'Active Shift' }} />
            <Stack.Screen name="clock-out" options={{ title: 'Clock Out' }} />
            <Stack.Screen name="time-history" options={{ title: 'Time History' }} />
            <Stack.Screen name="request-time-correction" options={{ title: 'Request Time Correction' }} />
            <Stack.Screen name="my-correction-requests" options={{ title: 'My Correction Requests' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          </Stack>
        </ClockingProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);
