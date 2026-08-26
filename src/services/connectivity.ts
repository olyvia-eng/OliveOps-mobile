import NetInfo from '@react-native-community/netinfo';

export type ConnectivityStatus = 'unknown' | 'online' | 'offline';

export function connectivityStatus(state: {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}): ConnectivityStatus {
  if (state.isConnected === false || state.isInternetReachable === false) return 'offline';
  if (state.isConnected === true) return 'online';
  return 'unknown';
}

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return connectivityStatus(state) === 'online';
}
