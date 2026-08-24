import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ApiError } from '@/types/errors';

const mockCreate = jest.fn();
const mockList = jest.fn();
const mockDetail = jest.fn();
const mockCancel = jest.fn();
const mockIsOnline = jest.fn();
let mockAuth: any;

jest.mock('@/api/timeOffApi', () => ({
  createMyTimeOffRequest: (...args: unknown[]) => mockCreate(...args),
  listMyTimeOffRequests: (...args: unknown[]) => mockList(...args),
  getMyTimeOffRequest: (...args: unknown[]) => mockDetail(...args),
  cancelMyTimeOffRequest: (...args: unknown[]) => mockCancel(...args),
}));
jest.mock('@/services/connectivity', () => ({ isOnline: () => mockIsOnline() }));
jest.mock('@/services/requestGuards', () => {
  const inFlight = new Set<string>();
  return {
    beginRequest: (key: string) => inFlight.has(key) ? false : (inFlight.add(key), true),
    endRequest: (key: string) => inFlight.delete(key),
    createRequestMeta: () => ({ requestId: 'request-1', idempotencyKey: 'time-off-stable-key' }),
  };
});
jest.mock('@/store/authStore', () => ({ useAuthStore: () => mockAuth }));

import { useTimeOffActions } from './useTimeOffActions';
import { TimeOffProvider, useTimeOffStore, type TimeOffDraft } from '@/store/timeOffStore';

let actions: ReturnType<typeof useTimeOffActions>;
let store: ReturnType<typeof useTimeOffStore>;

function Probe() {
  actions = useTimeOffActions();
  store = useTimeOffStore();
  return React.createElement('time-off-probe', {
    count: store.requests.length,
    loaded: store.loaded,
    draft: store.draft,
  });
}

const draft: TimeOffDraft = {
  requestType: 'vacation', startDate: '2026-08-28', endDate: '2026-08-30', employeeNote: 'Family trip',
};

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: 'time-off-1', requestType: 'vacation', startDate: '2026-08-28', endDate: '2026-08-30',
    employeeNote: 'Family trip', status: 'pending', submittedAt: '2026-08-24T12:00:00.000Z',
    createdAt: '2026-08-24T12:00:00.000Z', updatedAt: '2026-08-24T12:00:00.000Z', ...overrides,
  };
}

describe('useTimeOffActions', () => {
  let tree: ReactTestRenderer;

  beforeEach(async () => {
    mockAuth = {
      accessToken: 'token-a', status: 'authenticated',
      user: { id: 'user-a', businessId: 'biz-a', employeeId: 'emp-a' },
    };
    mockCreate.mockReset();
    mockList.mockReset().mockResolvedValue({ ok: true, items: [] });
    mockDetail.mockReset();
    mockCancel.mockReset();
    mockIsOnline.mockReset().mockResolvedValue(true);
    await act(async () => {
      tree = create(<TimeOffProvider><Probe /></TimeOffProvider>);
    });
  });

  afterEach(async () => {
    await act(async () => tree.unmount());
  });

  it('loads newest canonical requests', async () => {
    mockList.mockResolvedValue({ ok: true, items: [
      request({ id: 'older', submittedAt: '2026-08-20T12:00:00.000Z' }),
      request({ id: 'newer', submittedAt: '2026-08-24T12:00:00.000Z' }),
    ] });
    await act(async () => { await actions.refresh(); });
    expect(store.requests.map((item) => item.id)).toEqual(['newer', 'older']);
    expect(store.loaded).toBe(true);
  });

  it('allows only one simultaneous creation mutation', async () => {
    let resolveCreate!: (value: unknown) => void;
    mockCreate.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
    let first!: ReturnType<typeof actions.create>;
    let second!: Awaited<ReturnType<typeof actions.create>>;
    await act(async () => {
      first = actions.create(draft);
      second = await actions.create(draft);
    });
    expect(second).toEqual({ ok: false, error: 'This request is already being submitted.' });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    resolveCreate({ ok: true, request: request() });
    await act(async () => { await first; });
  });

  it('reuses the same idempotency key after an uncertain timeout', async () => {
    mockCreate
      .mockRejectedValueOnce(new ApiError('Request timed out.', 408, 'REQUEST_TIMEOUT'))
      .mockResolvedValueOnce({ ok: true, request: request() });
    await act(async () => { await actions.create(draft); });
    await act(async () => { await actions.create(draft); });
    expect(mockCreate.mock.calls[0][0].idempotencyKey).toBe('time-off-stable-key');
    expect(mockCreate.mock.calls[1][0].idempotencyKey).toBe('time-off-stable-key');
  });

  it('preserves the form while offline and handles idempotency conflict safely', async () => {
    await act(async () => store.setDraft(draft));
    mockIsOnline.mockResolvedValueOnce(false);
    let offlineResult: any;
    await act(async () => { offlineResult = await actions.create(draft); });
    expect(offlineResult.error).toBe('You’re offline. Connect to the internet to submit this request.');
    expect(store.draft).toEqual(draft);
    expect(mockCreate).not.toHaveBeenCalled();

    mockIsOnline.mockResolvedValue(true);
    mockCreate.mockRejectedValue(new ApiError('time_off_idempotency_conflict', 409, 'time_off_idempotency_conflict'));
    let conflict: any;
    await act(async () => { conflict = await actions.create(draft); });
    expect(conflict.conflict).toBe(true);
    expect(store.draft).toEqual(draft);
  });

  it('keeps canonical creation success when list refresh fails', async () => {
    mockCreate.mockResolvedValue({ ok: true, request: request() });
    mockList.mockRejectedValue(new TypeError('network'));
    let result: any;
    await act(async () => { result = await actions.create(draft); });
    expect(result.ok).toBe(true);
    expect(result.warning).toBe('Request submitted. The list could not be refreshed.');
    expect(store.requests[0].id).toBe('time-off-1');
  });

  it('replaces stale pending state with authoritative cancel conflict state', async () => {
    await act(async () => store.upsertRequest(request()));
    const approved = request({ status: 'approved', reviewedAt: '2026-08-24T13:00:00.000Z' });
    mockCancel.mockRejectedValue(new ApiError(
      'Time-off request is no longer pending.', 409, undefined, undefined, { ok: false, request: approved },
    ));
    let result: any;
    await act(async () => { result = await actions.cancel('time-off-1'); });
    expect(result.statusChanged).toBe(true);
    expect(store.requests[0].status).toBe('approved');
  });

  it('clears on logout and rejects a stale prior-user response', async () => {
    let resolveList!: (value: unknown) => void;
    mockList.mockReturnValue(new Promise((resolve) => { resolveList = resolve; }));
    let pendingRefresh!: ReturnType<typeof actions.refresh>;
    await act(async () => { pendingRefresh = actions.refresh(); });
    mockAuth = { accessToken: undefined, status: 'unauthenticated', user: null };
    await act(async () => tree.update(<TimeOffProvider><Probe /></TimeOffProvider>));
    resolveList({ ok: true, items: [request()] });
    await act(async () => { await pendingRefresh; });
    expect(store.requests).toEqual([]);
    expect(store.loaded).toBe(false);
  });
});
