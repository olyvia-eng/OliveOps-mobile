import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useClockingActions } from '@/hooks/useClockingActions';
import { useTrainingActions } from '@/hooks/useTrainingActions';
import { replayServiceVisitOutbox } from '@/services/serviceVisitOutbox';
import { replaySnowOutbox } from '@/services/snowOperationsOutbox';
import { useAuthStore } from '@/store/authStore';

export function AppLifecycleSync() {
  const { accessToken, status, user } = useAuthStore();
  const { refreshWorkContext } = useClockingActions();
  const { refreshAssignments } = useTrainingActions();
  const previousStateRef = useRef<AppStateStatus>(AppState.currentState);
  const identityKey = user?.employeeId ? `${user.businessId}:${user.id}:${user.employeeId}` : null;

  useEffect(() => {
    if (status !== 'authenticated' || !identityKey) return;
    void replayServiceVisitOutbox(identityKey, accessToken);
    void replaySnowOutbox(identityKey, accessToken);
    return NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void replayServiceVisitOutbox(identityKey, accessToken);
        void replaySnowOutbox(identityKey, accessToken);
      }
    });
  }, [accessToken, identityKey, status]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackgrounded = previousStateRef.current === 'background'
        || previousStateRef.current === 'inactive';
      previousStateRef.current = nextState;

      if (nextState === 'active' && wasBackgrounded && status === 'authenticated') {
        void refreshWorkContext();
        void refreshAssignments();
        if (identityKey) void replayServiceVisitOutbox(identityKey, accessToken);
        if (identityKey) void replaySnowOutbox(identityKey, accessToken);
      }
    });

    return () => subscription.remove();
  }, [accessToken, identityKey, refreshAssignments, refreshWorkContext, status]);

  return null;
}