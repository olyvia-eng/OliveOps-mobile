import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(),
  },
}));

import NetInfo from '@react-native-community/netinfo';
import { connectivityStatus, isOnline } from '@/services/connectivity';

describe('connectivity', () => {
  it.each([
    [{}, 'unknown'],
    [{ isConnected: null, isInternetReachable: null }, 'unknown'],
    [{ isConnected: true, isInternetReachable: null }, 'online'],
    [{ isConnected: true, isInternetReachable: true }, 'online'],
    [{ isConnected: false, isInternetReachable: null }, 'offline'],
    [{ isConnected: true, isInternetReachable: false }, 'offline'],
  ] as const)('classifies connectivity state %#', (state, expected) => {
    expect(connectivityStatus(state)).toBe(expected);
  });

  it('returns false when connectivity is lost', async () => {
    (NetInfo.fetch as any).mockResolvedValue({ isConnected: false, isInternetReachable: false });
    await expect(isOnline()).resolves.toBe(false);
  });

  it('returns true when device is online', async () => {
    (NetInfo.fetch as any).mockResolvedValue({ isConnected: true, isInternetReachable: true });
    await expect(isOnline()).resolves.toBe(true);
  });
});
