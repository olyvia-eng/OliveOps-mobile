import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SQLite from 'expo-sqlite';
import { queueSnowBreadcrumbPoints } from '@/services/snowOperationsOutbox';
import type { SnowBreadcrumbPoint, SnowCommandContext, SnowGpsEvidence } from '@/types/snowOperations';

const TASK_NAME = 'oliveops-snow-background-location';
const DATABASE_NAME = 'oliveops-offline-clock.db';

interface TrackingContext {
  identityKey: string;
  context: SnowCommandContext;
  nextSequence: number;
}

async function trackingDatabase() {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync(`CREATE TABLE IF NOT EXISTS snow_tracking_context (
    singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
    context_json TEXT NOT NULL
  );`);
  return db;
}

async function readTrackingContext() {
  const db = await trackingDatabase();
  const row = await db.getFirstAsync<{ context_json: string }>('SELECT context_json FROM snow_tracking_context WHERE singleton = 1');
  return row ? JSON.parse(row.context_json) as TrackingContext : null;
}

async function writeTrackingContext(value: TrackingContext | null) {
  const db = await trackingDatabase();
  if (!value) {
    await db.runAsync('DELETE FROM snow_tracking_context WHERE singleton = 1');
    return;
  }
  await db.runAsync(
    `INSERT INTO snow_tracking_context (singleton, context_json) VALUES (1, ?)
     ON CONFLICT(singleton) DO UPDATE SET context_json = excluded.context_json`,
    JSON.stringify(value),
  );
}

function pointFromLocation(location: Location.LocationObject, sequence: number): SnowBreadcrumbPoint {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters: location.coords.accuracy ?? 0,
    deviceCapturedAt: new Date(location.timestamp).toISOString(),
    sequence,
  };
}

TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error || !data) return;
  const tracking = await readTrackingContext();
  if (!tracking) return;
  const locations = (data as { locations?: Location.LocationObject[] }).locations ?? [];
  const points = locations.map((location, index) => pointFromLocation(location, tracking.nextSequence + index));
  if (!points.length) return;
  await queueSnowBreadcrumbPoints({ identityKey: tracking.identityKey, context: tracking.context, points });
  await writeTrackingContext({ ...tracking, nextSequence: tracking.nextSequence + points.length });
});

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
    const location = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 12_000)),
    ]);
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

export async function startSnowBackgroundTracking(identityKey: string, context: SnowCommandContext) {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) return { ok: false as const, reason: 'permission_denied' };
  const background = await Location.requestBackgroundPermissionsAsync();
  if (!background.granted) return { ok: false as const, reason: 'background_permission_denied' };
  await writeTrackingContext({ identityKey, context, nextSequence: 1 });
  if (!await Location.hasStartedLocationUpdatesAsync(TASK_NAME)) {
    await Location.startLocationUpdatesAsync(TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 45_000,
      distanceInterval: 15,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Snow service in progress',
        notificationBody: 'OliveOps is recording route service location.',
      },
    });
  }
  return { ok: true as const };
}

export async function stopSnowBackgroundTracking() {
  if (await Location.hasStartedLocationUpdatesAsync(TASK_NAME)) await Location.stopLocationUpdatesAsync(TASK_NAME);
  await writeTrackingContext(null);
}