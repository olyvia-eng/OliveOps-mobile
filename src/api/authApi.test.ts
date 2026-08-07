import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSession, login, logout } from '@/api/authApi';
import { ApiError } from '@/types/errors';

vi.mock('@/config/env', () => ({
  ENV: { apiBaseUrl: 'http://localhost:3000' },
}));

function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as any;
}

describe('authApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('handles successful login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, {
      ok: true,
      user: { id: 'u1', businessId: 'biz-1', name: 'Alex', email: 'a@x.com', role: 'crew_member', businessName: 'OliveOps', employeeId: 'emp-1' },
    })));

    const result = await login('a@x.com', 'pw');
    expect(result.ok).toBe(true);
    expect(result.user?.id).toBe('u1');
  });

  it('returns invalid login as ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(401, { ok: false, error: 'Invalid email or password.' })));
    await expect(login('a@x.com', 'bad')).rejects.toBeInstanceOf(ApiError);
  });

  it('supports session restoration when endpoint is valid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, {
      ok: true,
      user: { id: 'u1', businessId: 'biz-1', name: 'Alex', email: 'a@x.com', role: 'crew_member', businessName: 'OliveOps', employeeId: 'emp-1' },
    })));

    const result = await getSession('token-1');
    expect(result.user?.employeeId).toBe('emp-1');
  });

  it('treats expired session as unauthorized', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(401, { ok: false, error: 'Unauthorized' })));
    await expect(getSession('expired')).rejects.toBeInstanceOf(ApiError);
  });

  it('supports logout success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, { ok: true })));
    await expect(logout('token-1')).resolves.toEqual({ ok: true });
  });
});
