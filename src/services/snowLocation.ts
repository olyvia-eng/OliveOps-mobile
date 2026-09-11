import * as Location from 'expo-location';
import type { SnowGpsEvidence } from '@/types/snowOperations';

async function getCurrentPositionWithTimeout() {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), 12_000);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function captureSnowPosition(): Promise<{
  gps?: SnowGpsEvidence;
  gpsUnavailableReason?: string;
  deviceCapturedAt: string;
}> {
  const deviceCapturedAt = new Date().toISOString();
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) return { gpsUnavailableReason: 'location_services_disabled', deviceCapturedAt };
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return { gpsUnavailableReason: 'permission_denied', deviceCapturedAt };
  try {
    const location = await getCurrentPositionWithTimeout();
    if (!location) return { gpsUnavailableReason: 'timeout', deviceCapturedAt };
    return {
      gps: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracyMeters: location.coords.accuracy ?? 0,
      },
      deviceCapturedAt: new Date(location.timestamp).toISOString(),
    };
  } catch {
    return { gpsUnavailableReason: 'position_unavailable', deviceCapturedAt };
  }
}
