import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { StatusBanner } from '@/components/StatusBanner';
import { connectivityStatus, type ConnectivityStatus } from '@/services/connectivity';

export function OfflineNotice() {
  const [status, setStatus] = useState<ConnectivityStatus>('unknown');

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      setStatus(connectivityStatus(state));
    });

    return () => sub();
  }, []);

  if (status !== 'offline') return null;
  return <StatusBanner tone="offline" message="No internet connection. Requests will not be submitted until online." />;
}
