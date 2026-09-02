import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ApiError } from '@/types/errors';

const mockFetchWithTimeout = jest.fn();
const mockNotifySessionExpired = jest.fn();

jest.mock('@/config/env', () => ({ ENV: { apiBaseUrl: 'https://example.test' } }));
jest.mock('@/services/fetchWithTimeout', () => ({
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
}));
jest.mock('@/services/sessionExpiry', () => ({
  notifySessionExpired: () => mockNotifySessionExpired(),
}));

import { apiRequest } from './client';

function response(status: number, payload: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

describe('apiRequest errors', () => {
  beforeEach(() => {
    mockFetchWithTimeout.mockReset();
    mockNotifySessionExpired.mockReset();
  });

  it('preserves the parsed backend payload on ApiError', async () => {
    const authoritative = { id: 'request-1', status: 'approved' };
    mockFetchWithTimeout.mockResolvedValue(response(409, {
      ok: false, error: 'Time-off request is no longer pending.', request: authoritative,
    }));

    await expect(apiRequest('/api/time-off-requests?action=cancel&id=request-1', {
      method: 'PATCH', accessToken: 'token-a',
    })).rejects.toMatchObject<ApiError>({
      status: 409,
      data: expect.objectContaining({ request: authoritative }),
    });
    expect(mockNotifySessionExpired).not.toHaveBeenCalled();
  });

  it('still invalidates the session for authenticated 401 responses', async () => {
    mockFetchWithTimeout.mockResolvedValue(response(401, { ok: false, error: 'Unauthorized' }));
    await expect(apiRequest('/api/time-off-requests?action=mine', { accessToken: 'token-a' })).rejects.toBeInstanceOf(ApiError);
    expect(mockNotifySessionExpired).toHaveBeenCalledTimes(1);
  });

  it('disables caching for authenticated GET requests', async () => {
    mockFetchWithTimeout.mockResolvedValue(response(200, { ok: true }));

    await apiRequest('/api/clocking?action=pending-clock-out', { accessToken: 'token-a' });

    const [, requestInit] = mockFetchWithTimeout.mock.calls[0] as [string, RequestInit];
    const headers = requestInit.headers as Headers;
    expect(requestInit.cache).toBe('no-store');
    expect(headers.get('Authorization')).toBe('Bearer token-a');
    expect(headers.get('Cache-Control')).toBe('no-store, no-cache, max-age=0');
    expect(headers.get('Pragma')).toBe('no-cache');
    expect(headers.get('Expires')).toBe('0');
  });

  it('rejects a 304 response as a controlled cache error', async () => {
    mockFetchWithTimeout.mockResolvedValue(response(304, null));

    await expect(apiRequest('/api/clocking?action=pending-clock-out', { accessToken: 'token-a' }))
      .rejects.toMatchObject<ApiError>({ status: 304, code: 'API_RESPONSE_NOT_MODIFIED' });
  });

  it('rejects an empty successful response as invalid JSON', async () => {
    mockFetchWithTimeout.mockResolvedValue(response(200, null));

    await expect(apiRequest('/api/clocking?action=pending-clock-out', { accessToken: 'token-a' }))
      .rejects.toMatchObject<ApiError>({ status: 200, code: 'API_RESPONSE_INVALID_JSON' });
  });
});
