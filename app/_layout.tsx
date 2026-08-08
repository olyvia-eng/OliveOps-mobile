import { Stack } from 'expo-router';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { AuthProvider } from '@/store/authStore';
import { ClockingProvider } from '@/store/clockingStore';
import { colors } from '@/theme/colors';

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <ClockingProvider>
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
