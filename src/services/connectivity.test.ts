import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    fetch: vi.fn(),
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
