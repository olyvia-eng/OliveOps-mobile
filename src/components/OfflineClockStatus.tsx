import { router } from 'expo-router';
import { SecondaryButton } from '@/components/SecondaryButton';
import { StatusBanner } from '@/components/StatusBanner';
import { analyzeCommandDependencies } from '@/features/offlineClocking/model';
import { useOptionalOfflineClockStore } from '@/store/offlineClockContext';

export function OfflineClockStatus({ showHistoricalAttention = false }: { showHistoricalAttention?: boolean }) {
  const offlineClock = useOptionalOfflineClockStore();
  if (!offlineClock) return null;

  const {
    blockedCount = 0,
    correctionRequestedCount = 0,
    currentShiftConflict,
    needsAttentionCount,
    pendingCount,
  } = offlineClock.effectiveState;
  const dependencies = analyzeCommandDependencies(offlineClock.commands ?? []);
  const reviewCommand = currentShiftConflict ?? dependencies.actionable[0] ?? dependencies.correctionRequested[0];

  if (needsAttentionCount > 0 && (currentShiftConflict || showHistoricalAttention)) {
    const waitingMessage = blockedCount > 0
      ? ` ${blockedCount} later ${blockedCount === 1 ? 'change is' : 'changes are'} waiting for resolution.`
      : '';
    const independentMessage = pendingCount > 0
      ? ` ${pendingCount} independent ${pendingCount === 1 ? 'change is' : 'changes are'} waiting to sync.`
      : '';
    return (
      <>
        <StatusBanner
          tone="error"
          message={`${needsAttentionCount} time ${needsAttentionCount === 1 ? 'change needs' : 'changes need'} attention.${waitingMessage}${independentMessage}`}
        />
        <SecondaryButton
          label="Review"
          onPress={() => router.push({ pathname: '/offline-time-change', params: { commandId: reviewCommand?.id } })}
        />
      </>
    );
  }

  if (showHistoricalAttention && correctionRequestedCount > 0) {
    return (
      <>
        <StatusBanner
          tone="info"
          message={`Correction requested.${blockedCount > 0 ? ` ${blockedCount} later ${blockedCount === 1 ? 'change is' : 'changes are'} waiting for resolution.` : ''}`}
        />
        <SecondaryButton
          label="Review"
          onPress={() => router.push({ pathname: '/offline-time-change', params: { commandId: reviewCommand?.id } })}
        />
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