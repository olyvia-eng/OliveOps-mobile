import { Stack } from 'expo-router';

const diagnosticStartup = process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP === 'true';
const NormalRootLayout = diagnosticStartup
  ? null
  : require('@/app/NormalRootLayout').default;

export default function RootLayout() {
  if (diagnosticStartup) {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  return <NormalRootLayout />;
}
