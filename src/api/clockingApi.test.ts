import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { clockIn, clockOut, loadActiveUnbillableCategories, loadBootstrap } from '@/api/clockingApi';
import { ApiError } from '@/types/errors';

jest.mock('@/config/env', () => ({
  ENV: { apiBaseUrl: 'http://localhost:3000' },
}));

function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as any;
}

describe('clockingApi', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('loads assigned jobs and scoped entries', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue(
      mockResponse(200, {
        ok: true,
        jobs: [{ id: 'j1', title: 'Job 1', status: 'scheduled', assignedEmployeeIds: ['emp-1'] }],
        timeEntries: [{ id: 't1', employeeId: 'emp-1', workType: 'job', clockIn: '2026-08-06T10:00:00.000Z', breakMinutes: 0, notes: '', status: 'clocked_in' }],
      })
    );

    const payload = await loadBootstrap('token-1');
    expect(payload.jobs?.length).toBe(1);
    expect(payload.timeEntries?.[0]?.employeeId).toBe('emp-1');
  });

  it('shares one in-flight bootstrap request for simultaneous callers', async () => {
    let resolveFetch!: (response: any) => void;
    const pendingFetch = new Promise<any>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = jest.fn().mockReturnValue(pendingFetch);
    (global as any).fetch = fetchMock;

    const first = loadBootstrap('token-1');
    const second = loadBootstrap('token-1');
    const third = loadBootstrap('token-1');

    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(mockResponse(200, { ok: true, jobs: [] }));
    await expect(Promise.all([first, second, third])).resolves.toEqual([
      { ok: true, jobs: [] },
      { ok: true, jobs: [] },
      { ok: true, jobs: [] },
    ]);

    await loadBootstrap('token-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('clears a failed bootstrap request and keeps sessions isolated', async () => {
    let rejectFetch!: (error: Error) => void;
    const pendingFetch = new Promise<any>((_resolve, reject) => {
      rejectFetch = reject;
    });
    const fetchMock = jest.fn()
      .mockReturnValueOnce(pendingFetch)
      .mockResolvedValue(mockResponse(200, { ok: true, jobs: [] }));
    (global as any).fetch = fetchMock;

    const first = loadBootstrap('token-1');
    const shared = loadBootstrap('token-1');
    const otherSession = loadBootstrap('token-2');

    expect(first).toBe(shared);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(otherSession).resolves.toEqual({ ok: true, jobs: [] });

    rejectFetch(new Error('network unavailable'));
    await expect(first).rejects.toThrow('network unavailable');
    await expect(shared).rejects.toThrow('network unavailable');

    await loadBootstrap('token-1');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('submits clock-in successfully', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue(
      mockResponse(200, {
        ok: true,
        timeEntry: {
          id: 'entry-1',
          employeeId: 'emp-1',
          workType: 'job',
          jobIds: ['j1'],
          clockIn: '2026-08-06T10:00:00.000Z',
          breakMinutes: 0,
          notes: '',
          status: 'clocked_in',
        },
      })
    );

    const payload = await clockIn({
      employeeId: 'emp-1',
      workType: 'job',
      jobIds: ['j1'],
      requestId: 'req-1',
      idempotencyKey: 'key-1',
    }, 'token-1');

    expect(payload.ok).toBe(true);
    expect(payload.timeEntry.status).toBe('clocked_in');
  });

  it('submits non-billable clock-in with unbillable category ID', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      mockResponse(200, {
        ok: true,
        timeEntry: {
          id: 'entry-2',
          employeeId: 'emp-1',
          workType: 'non_billable',
          unbillableCategoryId: 'cat-training',
          unbillableCategoryName: 'Training',
          jobIds: [],
          clockIn: '2026-08-06T10:00:00.000Z',
          breakMinutes: 0,
          notes: '',
          status: 'clocked_in',
        },
      })
    );
    (global as any).fetch = fetchMock;

    const payload = await clockIn({
      employeeId: 'emp-1',
      workType: 'non_billable',
      jobIds: [],
      unbillableCategoryId: 'cat-training',
      requestId: 'req-4',
      idempotencyKey: 'key-4',
    }, 'token-1');

    expect(payload.ok).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.unbillableCategoryId).toBe('cat-training');
  });

  it('loads active unbillable categories', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue(
      mockResponse(200, {
        ok: true,
        items: [
          {
            id: 'cat-training',
            name: 'Training',
            description: '',
            sortOrder: 0,
            active: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      })
    );

    const payload = await loadActiveUnbillableCategories('token-1');
    expect(payload.items[0].id).toBe('cat-training');
    expect(payload.items[0].name).toBe('Training');
  });

  it('submits clock-out successfully', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue(
      mockResponse(200, {
        ok: true,
        timeEntry: {
          id: 'entry-1',
          employeeId: 'emp-1',
          workType: 'job',
          jobIds: ['j1'],
          clockIn: '2026-08-06T10:00:00.000Z',
          clockOut: '2026-08-06T14:00:00.000Z',
          breakMinutes: 0,
          notes: 'done',
          status: 'clocked_out',
        },
      })
    );

    const payload = await clockOut({
      entryId: 'entry-1',
      breakMinutes: 0,
      notes: 'done',
      requestId: 'req-2',
      idempotencyKey: 'key-2',
    }, 'token-1');

    expect(payload.ok).toBe(true);
    expect(payload.timeEntry?.status).toBe('clocked_out');
  });

  it('throws unauthorized/forbidden API errors', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue(mockResponse(403, { ok: false, error: 'Forbidden' }));
    await expect(loadBootstrap('token-1')).rejects.toBeInstanceOf(ApiError);
  });

  it('throws API failure for clock-in', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue(mockResponse(500, { ok: false, error: 'Clock-in failed' }));

    await expect(clockIn({
      employeeId: 'emp-1',
      workType: 'job',
      jobIds: ['j1'],
      requestId: 'req-3',
      idempotencyKey: 'key-3',
    })).rejects.toBeInstanceOf(ApiError);
  });
});
