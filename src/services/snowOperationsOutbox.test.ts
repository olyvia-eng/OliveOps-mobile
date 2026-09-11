import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockRows = new Map<string, string>();
const mockRunFieldCommand = jest.fn();
const mockStartRoute = jest.fn();
const mockCompleteRoute = jest.fn();

jest.mock('@/api/snowOperationsApi', () => ({
  runSnowFieldCommand: (...args: unknown[]) => mockRunFieldCommand(...args),
  startSnowRoute: (...args: unknown[]) => mockStartRoute(...args),
  completeSnowRoute: (...args: unknown[]) => mockCompleteRoute(...args),
}));
jest.mock('@/api/storageApi', () => ({
  prepareUpload: jest.fn(), completeUpload: jest.fn(), deleteUploadedFile: jest.fn(), uploadUriToS3: jest.fn(),
}));
jest.mock('expo-image-manipulator', () => ({ manipulateAsync: jest.fn(), SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('expo-file-system', () => ({
  Directory: class { exists = true; create = jest.fn(); },
  File: class { exists = false; size = 0; uri = ''; copy = jest.fn(); delete = jest.fn(); },
  Paths: { document: 'file:///documents' },
}));
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => ({
    execAsync: jest.fn(async () => undefined),
    getAllAsync: jest.fn(async (_sql: string, identityKey: string) => [...mockRows.values()]
      .map((operation_json) => ({ operation_json }))
      .filter(({ operation_json }) => JSON.parse(operation_json).identityKey === identityKey)
      .sort((left, right) => left.operation_json.localeCompare(right.operation_json))),
    runAsync: jest.fn(async (sql: string, ...args: unknown[]) => {
      if (sql.includes('INSERT INTO snow_operations_outbox')) mockRows.set(String(args[0]), String(args[4]));
      if (sql.includes('DELETE FROM snow_operations_outbox')) mockRows.delete(String(args[0]));
      return { changes: 1 };
    }),
  })),
}));

import { loadSnowOutbox, queueSnowBreadcrumbPoints, queueSnowCommand, replaySnowOutbox, resetSnowOutboxForTests } from '@/services/snowOperationsOutbox';

describe('snowOperationsOutbox', () => {
  beforeEach(() => {
    mockRows.clear();
    resetSnowOutboxForTests();
    mockRunFieldCommand.mockReset().mockResolvedValue({ ok: true });
    mockStartRoute.mockReset().mockResolvedValue({ ok: true });
    mockCompleteRoute.mockReset().mockResolvedValue({ ok: true });
  });

  it('replays a field command with its original stable submission ID', async () => {
    await queueSnowCommand({
      identityKey: 'biz:user:employee',
      action: 'arrival',
      context: { eventId: 'event-1', routeId: 'route-1', stopId: 'stop-1' },
      payload: { clientSubmissionId: 'arrival:device-1', gpsUnavailableReason: 'permission_denied' },
    });

    await replaySnowOutbox('biz:user:employee', 'token-1');

    expect(mockRunFieldCommand).toHaveBeenCalledWith(
      'arrival',
      { eventId: 'event-1', routeId: 'route-1', stopId: 'stop-1' },
      { clientSubmissionId: 'arrival:device-1', gpsUnavailableReason: 'permission_denied' },
      'token-1',
    );
    expect(await loadSnowOutbox('biz:user:employee')).toEqual([]);
  });

  it('splits background breadcrumbs into batches of no more than 100 points', async () => {
    const points = Array.from({ length: 205 }, (_, index) => ({
      latitude: 43 + index / 1000,
      longitude: -79,
      accuracyMeters: 10,
      deviceCapturedAt: '2026-09-08T00:00:00.000Z',
      sequence: index + 1,
    }));

    await queueSnowBreadcrumbPoints({
      identityKey: 'biz:user:employee',
      context: { eventId: 'event-1', routeId: 'route-1', stopId: 'stop-1', occurrenceId: 'occurrence-1' },
      points,
    });

    const queued = await loadSnowOutbox('biz:user:employee');
    expect(queued).toHaveLength(3);
    expect(queued.map((item) => item.payload.points?.length).sort((left, right) => Number(left) - Number(right))).toEqual([5, 100, 100]);
    expect(queued.flatMap((item) => item.payload.points ?? []).map((point) => point.sequence).sort((left, right) => left - right)).toEqual(Array.from({ length: 205 }, (_, index) => index + 1));
    expect(new Set(queued.map((item) => item.payload.clientSubmissionId)).size).toBe(3);
  });
});
