import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { StatusBanner } from '@/components/StatusBanner';

export function OfflineNotice() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      setOffline(!(state.isConnected && state.isInternetReachable !== false));
    });

    return () => sub();
  }, []);

  if (!offline) return null;
  return <StatusBanner tone="offline" message="No internet connection. Requests will not be submitted until online." />;
}
