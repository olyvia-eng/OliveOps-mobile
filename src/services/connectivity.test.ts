import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(),
  },
}));

import NetInfo from '@react-native-community/netinfo';
import { isOnline } from '@/services/connectivity';

describe('connectivity', () => {
  it('returns false when connectivity is lost', async () => {
    (NetInfo.fetch as any).mockResolvedValue({ isConnected: false, isInternetReachable: false });
    await expect(isOnline()).resolves.toBe(false);
  });

  it('returns true when device is online', async () => {
    (NetInfo.fetch as any).mockResolvedValue({ isConnected: true, isInternetReachable: true });
    await expect(isOnline()).resolves.toBe(true);
  });
});
