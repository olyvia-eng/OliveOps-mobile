import { useEffect, useRef } from 'react';
import { AppState, Pressable, StyleSheet, Text, View, type AppStateStatus } from 'react-native';
import { router, Stack } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { PrimaryNavigation } from '@/components/PrimaryNavigation';
import { useClockingActions } from '@/hooks/useClockingActions';
import { useTrainingActions } from '@/hooks/useTrainingActions';
import { useAuthStore } from '@/store/authStore';
import { AuthProvider } from '@/store/authStore';
import { ClockingProvider } from '@/store/clockingStore';
import { OfflineClockProvider } from '@/store/offlineClockStore';
import { FormsProvider } from '@/store/formsStore';
import { FormsWorkflowProvider } from '@/store/formsWorkflowStore';
import { PendingClockInProvider } from '@/store/pendingClockInStore';
import { PendingClockOutProvider } from '@/store/pendingClockOutStore';
import { TimeOffProvider } from '@/store/timeOffStore';
import { TrainingProvider } from '@/store/trainingStore';
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
  const { refreshAssignments } = useTrainingActions();
  const previousStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackgrounded = previousStateRef.current === 'background'
        || previousStateRef.current === 'inactive';
      previousStateRef.current = nextState;

      if (nextState === 'active' && wasBackgrounded && status === 'authenticated') {
        void refreshWorkContext();
        void refreshAssignments();
      }
    });

    return () => subscription.remove();
  }, [refreshAssignments, refreshWorkContext, status]);

  return null;
}

function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <AuthProvider>
        <TimeOffProvider>
          <FormsProvider>
            <FormsWorkflowProvider>
              <ClockingProvider>
                <TrainingProvider>
                  <OfflineClockProvider>
                    <PendingClockInProvider>
                      <PendingClockOutProvider>
                        <AppLifecycleSync />
                        <View style={styles.app}>
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
                            <Stack.Screen name="home" options={{ headerShown: false, gestureEnabled: false }} />
                            <Stack.Screen name="clock-in" options={secondaryScreenOptions('Clock In')} />
                            <Stack.Screen name="switch-activity" options={secondaryScreenOptions('Switch Activity')} />
                            <Stack.Screen name="active-shift" options={secondaryScreenOptions('Active Shift')} />
                            <Stack.Screen name="clock-out" options={secondaryScreenOptions('Clock Out')} />
                            <Stack.Screen name="edit-work-areas" options={secondaryScreenOptions('Edit Work Areas')} />
                            <Stack.Screen name="time-history" options={{ headerShown: false, gestureEnabled: false }} />
                            <Stack.Screen name="time-entry-detail" options={secondaryScreenOptions('Time Entry Detail')} />
                            <Stack.Screen name="request-time-correction" options={secondaryScreenOptions('Request Time Correction')} />
                            <Stack.Screen name="offline-time-change" options={secondaryScreenOptions('Time Change Needs Attention')} />
                            <Stack.Screen name="my-correction-requests" options={secondaryScreenOptions('Correction Requests')} />
                            <Stack.Screen name="forms" options={secondaryScreenOptions('Forms')} />
                            <Stack.Screen name="form" options={secondaryScreenOptions('Complete Form')} />
                            <Stack.Screen name="form-submission" options={secondaryScreenOptions('Completed Form')} />
                            <Stack.Screen name="employee-hub" options={{ headerShown: false, gestureEnabled: false }} />
                            <Stack.Screen name="training-detail" options={secondaryScreenOptions('Training')} />
                            <Stack.Screen name="time-off" options={secondaryScreenOptions('Time Off')} />
                            <Stack.Screen name="request-time-off" options={secondaryScreenOptions('Request Time Off')} />
                            <Stack.Screen name="time-off-detail" options={secondaryScreenOptions('Time Off Details')} />
                            <Stack.Screen name="settings" options={secondaryScreenOptions('Settings')} />
                            <Stack.Screen name="more" options={{ headerShown: false, gestureEnabled: false }} />
                          </Stack>
                          <PrimaryNavigation />
                        </View>
                      </PendingClockOutProvider>
                    </PendingClockInProvider>
                  </OfflineClockProvider>
                </TrainingProvider>
              </ClockingProvider>
            </FormsWorkflowProvider>
          </FormsProvider>
        </TimeOffProvider>
        </AuthProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  app: { flex: 1 },
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
