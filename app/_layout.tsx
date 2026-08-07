import { Stack } from 'expo-router';
import { AuthProvider } from '@/store/authStore';
import { ClockingProvider } from '@/store/clockingStore';

export default function RootLayout() {
  return (
    <AuthProvider>
      <ClockingProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#0F172A' },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: '#0B172A' },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: 'Employee Login' }} />
          <Stack.Screen name="home" options={{ title: 'Home' }} />
          <Stack.Screen name="clock-in" options={{ title: 'Clock In' }} />
          <Stack.Screen name="active-shift" options={{ title: 'Active Shift' }} />
          <Stack.Screen name="clock-out" options={{ title: 'Clock Out' }} />
          <Stack.Screen name="time-history" options={{ title: 'Time History' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        </Stack>
      </ClockingProvider>
    </AuthProvider>
  );
}
