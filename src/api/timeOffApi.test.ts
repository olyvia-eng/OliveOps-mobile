import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockApiRequest = jest.fn();
jest.mock('@/api/client', () => ({ apiRequest: (...args: unknown[]) => mockApiRequest(...args) }));

import {
  cancelMyTimeOffRequest,
  createMyTimeOffRequest,
  getMyTimeOffRequest,
  listMyTimeOffRequests,
} from './timeOffApi';

describe('timeOffApi', () => {
  beforeEach(() => mockApiRequest.mockReset().mockResolvedValue({ ok: true }));

  it('uses the employee-scoped backend contracts', async () => {
    const payload = {
      requestType: 'vacation' as const,
      startDate: '2026-08-28',
      endDate: '2026-08-30',
      employeeNote: 'Family trip',
      idempotencyKey: 'time-off-key-1',
    };
    await createMyTimeOffRequest(payload, 'token-1');
    await listMyTimeOffRequests('token-1');
    await getMyTimeOffRequest('request/1', 'token-1');
    await cancelMyTimeOffRequest('request/1', 'token-1');

    expect(mockApiRequest).toHaveBeenNthCalledWith(1, '/api/time-off-requests?action=create', {
      method: 'POST', body: JSON.stringify(payload), accessToken: 'token-1',
    });
    expect(JSON.parse(mockApiRequest.mock.calls[0][1].body)).not.toEqual(expect.objectContaining({
      businessId: expect.anything(), employeeId: expect.anything(), status: expect.anything(),
    }));
    expect(mockApiRequest).toHaveBeenNthCalledWith(2, '/api/time-off-requests?action=mine', { accessToken: 'token-1' });
    expect(mockApiRequest).toHaveBeenNthCalledWith(3, '/api/time-off-requests?action=detail&id=request%2F1', { accessToken: 'token-1' });
    expect(mockApiRequest).toHaveBeenNthCalledWith(4, '/api/time-off-requests?action=cancel&id=request%2F1', {
      method: 'PATCH', accessToken: 'token-1',
    });
  });
});