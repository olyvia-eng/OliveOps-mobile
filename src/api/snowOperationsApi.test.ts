import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { completeSnowRoute, loadMyActiveSnowRoute, loadSnowServiceTypes, runSnowFieldCommand, startSnowRoute } from '@/api/snowOperationsApi';
import { ApiError } from '@/types/errors';

jest.mock('@/config/env', () => ({ ENV: { apiBaseUrl: 'http://localhost:3000' } }));

function mockResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: jest.fn().mockResolvedValue(body) } as any;
}

describe('snowOperationsApi contract', () => {
  beforeEach(() => jest.restoreAllMocks());

  it('loads the assigned route and configured service types outside bootstrap', async () => {
    (global as any).fetch = jest.fn()
      .mockResolvedValueOnce(mockResponse(200, { ok: true, event: null, route: null, stops: [] }))
      .mockResolvedValueOnce(mockResponse(200, { ok: true, serviceTypes: [] }));

    await loadMyActiveSnowRoute('token-1');
    await loadSnowServiceTypes('token-1');

    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/api/snow-operations?action=my-active-route');
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('/api/snow-operations?action=service-types');
  });

  it('scopes route commands in the query and keeps the stable submission ID in the body', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue(mockResponse(200, { ok: true, route: { id: 'route-1' } }));

    await startSnowRoute({ eventId: 'event-1', routeId: 'route-1' }, { clientSubmissionId: 'start-route:device-1' }, 'token-1');
    await completeSnowRoute({ eventId: 'event-1', routeId: 'route-1' }, { clientSubmissionId: 'complete-route:device-1' }, 'token-1');

    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('action=start-route&eventId=event-1&routeId=route-1');
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string)).toEqual({ clientSubmissionId: 'start-route:device-1' });
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('action=complete-route&eventId=event-1&routeId=route-1');
  });

  it('sends occurrence-scoped breadcrumbs in batches with absolute device timestamps', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue(mockResponse(201, { ok: true, replayed: true, batch: { id: 'breadcrumbs:device-1' } }));
    const points = [{ latitude: 43.1, longitude: -79.2, accuracyMeters: 8, deviceCapturedAt: '2026-09-08T00:00:00.000Z', sequence: 1 }];

    const response = await runSnowFieldCommand('breadcrumbs', {
      eventId: 'event-1', routeId: 'route-1', stopId: 'stop-1', occurrenceId: 'occurrence-1',
    }, { clientSubmissionId: 'breadcrumbs:device-1', points }, 'token-1');

    expect(response.replayed).toBe(true);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('stopId=stop-1&occurrenceId=occurrence-1');
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string)).toEqual({ clientSubmissionId: 'breadcrumbs:device-1', points });
  });

  it('preserves Snow conflict details for durable replay handling', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue(mockResponse(409, { ok: false, code: 'SNOW_REVISION_CONFLICT', error: 'Snow Operations data changed since it was opened.' }));

    await expect(runSnowFieldCommand('arrival', {
      eventId: 'event-1', routeId: 'route-1', stopId: 'stop-1',
    }, { clientSubmissionId: 'arrival:device-1', gpsUnavailableReason: 'permission_denied', deviceCapturedAt: '2026-09-08T00:00:00.000Z' }))
      .rejects.toMatchObject<ApiError>({ status: 409, code: 'SNOW_REVISION_CONFLICT' });
  });
});