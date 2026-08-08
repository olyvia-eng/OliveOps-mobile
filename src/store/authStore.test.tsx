import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ApiError } from '@/types/errors';

const mockGetSession = jest.fn();
const mockReadStoredSession = jest.fn();
const mockClearStoredSession = jest.fn();

jest.mock('@/api/authApi', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  login: jest.fn(),
  logout: jest.fn(),
}));

jest.mock('@/services/sessionStorage', () => ({
  readStoredSession: () => mockReadStoredSession(),
  clearStoredSession: () => mockClearStoredSession(),
  writeStoredSession: jest.fn(),
}));

import { AuthProvider, useAuthStore } from '@/store/authStore';

let currentAuth: ReturnType<typeof useAuthStore>;

function AuthProbe() {
  currentAuth = useAuthStore();
  return React.createElement('auth-probe', {
    status: currentAuth.status,
    warning: currentAuth.warning,
    accessToken: currentAuth.accessToken,
    userId: currentAuth.user?.id,
  });
}

describe('AuthProvider bootstrap', () => {
  let tree: ReactTestRenderer;

  beforeEach(async () => {
    mockGetSession.mockReset();
    mockReadStoredSession.mockReset();
    mockClearStoredSession.mockReset();
    mockClearStoredSession.mockResolvedValue(undefined);

    await act(async () => {
      tree = create(
        React.createElement(AuthProvider, null, React.createElement(AuthProbe))
      );
    });
  });

  it('routes to unauthenticated without a stored token', async () => {
    mockReadStoredSession.mockResolvedValue({});

    await act(async () => {
      await currentAuth.bootstrap();
    });

    expect(tree.root.findByType('auth-probe').props.status).toBe('unauthenticated');
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it('restores a valid stored session', async () => {
    mockReadStoredSession.mockResolvedValue({ accessToken: 'token-1' });
    mockGetSession.mockResolvedValue({
      user: { id: 'user-1', email: 'crew@oliveops.ca' },
      capabilities: { paidDriveTime: true },
    });

    await act(async () => {
      await currentAuth.bootstrap();
    });

    const probe = tree.root.findByType('auth-probe');
    expect(probe.props.status).toBe('authenticated');
    expect(probe.props.userId).toBe('user-1');
  });

  it('clears a confirmed expired session and routes to login safely', async () => {
    mockReadStoredSession.mockResolvedValue({ accessToken: 'expired-token' });
    mockGetSession.mockRejectedValue(new ApiError('Unauthorized', 401));

    await act(async () => {
      await currentAuth.bootstrap();
    });

    const probe = tree.root.findByType('auth-probe');
    expect(probe.props.status).toBe('unauthenticated');
    expect(probe.props.accessToken).toBeUndefined();
    expect(probe.props.warning).toBe('Session expired. Please log in again.');
    expect(mockClearStoredSession).toHaveBeenCalledTimes(1);
  });

  it('preserves credentials and exposes retry after a transient verification failure', async () => {
    mockReadStoredSession.mockResolvedValue({ accessToken: 'token-1' });
    mockGetSession.mockRejectedValue(new ApiError('Service unavailable', 503));

    await act(async () => {
      await currentAuth.bootstrap();
    });

    const probe = tree.root.findByType('auth-probe');
    expect(probe.props.status).toBe('error');
    expect(probe.props.accessToken).toBe('token-1');
    expect(probe.props.warning).toContain('verify your session');
    expect(mockClearStoredSession).not.toHaveBeenCalled();
  });

  it('restores the session when retry succeeds after a transient failure', async () => {
    mockReadStoredSession.mockResolvedValue({ accessToken: 'token-1' });
    mockGetSession
      .mockRejectedValueOnce(new ApiError('Service unavailable', 503))
      .mockResolvedValueOnce({
        user: { id: 'user-1', email: 'crew@oliveops.ca' },
        capabilities: { paidDriveTime: false },
      });

    await act(async () => {
      await currentAuth.bootstrap();
    });
    expect(tree.root.findByType('auth-probe').props.status).toBe('error');

    await act(async () => {
      await currentAuth.bootstrap();
    });

    const probe = tree.root.findByType('auth-probe');
    expect(probe.props.status).toBe('authenticated');
    expect(probe.props.userId).toBe('user-1');
    expect(mockClearStoredSession).not.toHaveBeenCalled();
  });

  it('leaves checking state when secure storage cannot be read', async () => {
    mockReadStoredSession.mockRejectedValue(new Error('Keychain unavailable'));

    await act(async () => {
      await currentAuth.bootstrap();
    });

    const probe = tree.root.findByType('auth-probe');
    expect(probe.props.status).toBe('error');
    expect(probe.props.warning).toContain('secure session');
  });
});