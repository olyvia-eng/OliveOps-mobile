import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { loadMySopDetail, loadMySops } from '@/api/sopsApi';

jest.mock('@/config/env', () => ({ ENV: { apiBaseUrl: 'https://app.oliveops.ca' } }));

function response(body: unknown) {
  return { ok: true, status: 200, json: jest.fn().mockResolvedValue(body) } as any;
}

describe('sopsApi', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses only the employee read-only SOP actions', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce(response({ ok: true, sops: [] }))
      .mockResolvedValueOnce(response({ ok: true, sop: { sopId: 'sop/a' } }));

    await loadMySops('token-1');
    await loadMySopDetail('sop/a', 'token-1');

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://app.oliveops.ca/api/sops?action=my-list',
      'https://app.oliveops.ca/api/sops?action=my-detail&sopId=sop%2Fa',
    ]);
    expect(fetchMock.mock.calls.every(([, options]) => options.method === 'GET')).toBe(true);
  });
});