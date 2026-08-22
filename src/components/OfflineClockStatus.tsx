import { router } from 'expo-router';
import { SecondaryButton } from '@/components/SecondaryButton';
import { StatusBanner } from '@/components/StatusBanner';
import { getOfflineConflictMessage, useOptionalOfflineClockStore } from '@/store/offlineClockContext';

export function OfflineClockStatus({ showHistoricalAttention = false }: { showHistoricalAttention?: boolean }) {
  const offlineClock = useOptionalOfflineClockStore();
  if (!offlineClock) return null;

  const { currentShiftConflict, needsAttentionCount, pendingCount } = offlineClock.effectiveState;
  const historicalAttentionCount = needsAttentionCount - (currentShiftConflict ? 1 : 0);

  if (currentShiftConflict) {
    return (
      <>
        <StatusBanner tone="error" message={getOfflineConflictMessage(currentShiftConflict.lastErrorCategory)} />
        <SecondaryButton
          label="Request Time Correction"
          onPress={() => router.push('/request-time-correction')}
        />
      </>
    );
  }

  if (showHistoricalAttention && historicalAttentionCount > 0) {
    return (
      <>
        <StatusBanner
          tone="error"
          message={`${historicalAttentionCount} time ${historicalAttentionCount === 1 ? 'change needs' : 'changes need'} attention.`}
        />
        <SecondaryButton label="Review" onPress={() => router.push('/request-time-correction')} />
        {pendingCount > 0 ? (
          <StatusBanner
            tone="offline"
            message={`${pendingCount} ${pendingCount === 1 ? 'change is' : 'changes are'} waiting to sync.`}
          />
        ) : null}
      </>
    );
  }

  if (pendingCount === 0) return null;
  return (
    <>
      <StatusBanner
        tone="offline"
        message={`${pendingCount} ${pendingCount === 1 ? 'change is' : 'changes are'} waiting to sync.`}
      />
      <SecondaryButton label="Sync Now" onPress={() => { void offlineClock.syncNow(); }} />
    </>
  );
}