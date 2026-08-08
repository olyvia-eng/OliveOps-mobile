import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockBootstrap = jest.fn();
const mockUseSessionBootstrap = jest.fn();
let mockStatus: 'checking' | 'authenticated' | 'unauthenticated' | 'error' = 'checking';
let mockWarning: string | undefined;

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => require('react').createElement('redirect', { href }),
}));

jest.mock('@/hooks/useSessionBootstrap', () => ({
  useSessionBootstrap: () => mockUseSessionBootstrap(),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    bootstrap: mockBootstrap,
    status: mockStatus,
    warning: mockWarning,
  }),
}));

jest.mock('@/components/Screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) =>
    require('react').createElement('screen', null, children),
}));

jest.mock('@/components/LoadingState', () => ({
  LoadingState: ({ label }: { label: string }) =>
    require('react').createElement('loading-state', { label }),
}));

jest.mock('@/components/StatusBanner', () => ({
  StatusBanner: ({ message }: { message: string }) =>
    require('react').createElement('status-banner', { message }),
}));

jest.mock('@/components/PrimaryActionButton', () => ({
  PrimaryActionButton: ({ label, onPress }: { label: string; onPress: () => void }) =>
    require('react').createElement('primary-button', { label, onPress }),
}));

import IndexScreen from '../../app/index';

describe('IndexScreen', () => {
  beforeEach(() => {
    mockStatus = 'checking';
    mockWarning = undefined;
    mockBootstrap.mockReset();
    mockUseSessionBootstrap.mockClear();
  });

  it('keeps routing blocked while secure session restore is checking', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(IndexScreen));
    });

    expect(tree.root.findByType('loading-state').props.label).toBe('Checking secure session...');
    expect(tree.root.findAllByType('redirect')).toHaveLength(0);
  });

  it('shows a safe retry action after transient verification failure', async () => {
    mockStatus = 'error';
    mockWarning = 'Unable to verify this session safely.';

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(IndexScreen));
    });

    expect(tree.root.findByType('status-banner').props.message).toBe(mockWarning);
    await act(async () => {
      tree.root.findByType('primary-button').props.onPress();
    });
    expect(mockBootstrap).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType('redirect')).toHaveLength(0);
  });

  it.each([
    ['authenticated', '/home'],
    ['unauthenticated', '/login'],
  ] as const)('redirects %s sessions to %s', async (status, destination) => {
    mockStatus = status;

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(IndexScreen));
    });

    expect(tree.root.findByType('redirect').props.href).toBe(destination);
  });
});