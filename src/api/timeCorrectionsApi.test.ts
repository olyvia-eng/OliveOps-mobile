import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createTimeCorrection, listEffectiveTimeEntries, listMyTimeCorrections } from '@/api/timeCorrectionsApi';

jest.mock('@/config/env', () => ({
  ENV: {
    apiBaseUrl: 'https://app.oliveops.ca',
  },
}));

function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as any;
}

describe('timeCorrectionsApi', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('submits correction request to backend create endpoint', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValue(
      mockResponse(200, { ok: true, correction: { id: 'corr-1' } }),
    );

    const response = await createTimeCorrection({
      timeEntryId: 'entry-1',
      requestType: 'wrong_time',
      reason: 'Wrong end time',
    }, 'token-1');

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.oliveops.ca/api/time-corrections?action=create',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('lists my correction requests from backend list endpoint', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValue(
      mockResponse(200, { ok: true, items: [] }),
    );

    await listMyTimeCorrections('token-1');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.oliveops.ca/api/time-corrections?action=list&mine=true',
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('loads effective entries from backend effective endpoint', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValue(
      mockResponse(200, { ok: true, items: [] }),
    );

    await listEffectiveTimeEntries('token-1');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.oliveops.ca/api/time-corrections?action=effective-time-entries',
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });
});
