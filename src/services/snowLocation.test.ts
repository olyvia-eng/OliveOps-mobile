import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockHasServicesEnabled = jest.fn<() => Promise<boolean>>();
const mockRequestForegroundPermissions = jest.fn<() => Promise<{ granted: boolean }>>();
const mockGetCurrentPosition = jest.fn<() => Promise<{
  coords: { latitude: number; longitude: number; accuracy: number | null };
  timestamp: number;
}>>();

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  hasServicesEnabledAsync: () => mockHasServicesEnabled(),
  requestForegroundPermissionsAsync: () => mockRequestForegroundPermissions(),
  getCurrentPositionAsync: () => mockGetCurrentPosition(),
}));

import { captureSnowPosition } from './snowLocation';

describe('captureSnowPosition', () => {
  beforeEach(() => {
    mockHasServicesEnabled.mockReset().mockResolvedValue(true);
    mockRequestForegroundPermissions.mockReset().mockResolvedValue({ granted: true });
    mockGetCurrentPosition.mockReset().mockResolvedValue({
      coords: { latitude: 43.6532, longitude: -79.3832, accuracy: 6 },
      timestamp: Date.parse('2026-09-11T14:30:00.000Z'),
    });
  });

  it('captures one position after foreground permission is granted', async () => {
    await expect(captureSnowPosition()).resolves.toEqual({
      gps: { latitude: 43.6532, longitude: -79.3832, accuracyMeters: 6 },
      deviceCapturedAt: '2026-09-11T14:30:00.000Z',
    });

    expect(mockRequestForegroundPermissions).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('does not request a position when foreground permission is denied', async () => {
    mockRequestForegroundPermissions.mockResolvedValue({ granted: false });

    await expect(captureSnowPosition()).resolves.toMatchObject({
      gpsUnavailableReason: 'permission_denied',
    });
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
  });
});