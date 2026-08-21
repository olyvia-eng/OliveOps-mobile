import { router } from 'expo-router';
import { SecondaryButton } from '@/components/SecondaryButton';
import { StatusBanner } from '@/components/StatusBanner';
import { getOfflineConflictMessage, useOptionalOfflineClockStore } from '@/store/offlineClockContext';

export function OfflineClockStatus() {
  const offlineClock = useOptionalOfflineClockStore();
  if (!offlineClock || offlineClock.effectiveState.syncStatus === 'synced') return null;

  if (offlineClock.effectiveState.syncStatus === 'needs_attention') {
    const blocked = offlineClock.commands.find((command) => command.status === 'needs_attention');
    return (
      <>
        <StatusBanner tone="error" message={getOfflineConflictMessage(blocked?.lastErrorCategory)} />
        <SecondaryButton
          label="Request Time Correction"
          onPress={() => router.push('/request-time-correction')}
        />
      </>
    );
  }

  const count = offlineClock.effectiveState.pendingCount;
  return (
    <>
      <StatusBanner
        tone="offline"
        message={`${count} clocking ${count === 1 ? 'change is' : 'changes are'} saved on this device and waiting to sync.`}
      />
      <SecondaryButton label="Sync Now" onPress={() => { void offlineClock.syncNow(); }} />
    </>
  );
}