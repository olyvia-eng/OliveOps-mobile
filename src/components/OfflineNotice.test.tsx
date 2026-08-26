import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

let netInfoListener: ((state: { isConnected?: boolean | null; isInternetReachable?: boolean | null }) => void) | null = null;

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn((listener) => {
      netInfoListener = listener;
      return jest.fn();
    }),
  },
}));
jest.mock('@/components/StatusBanner', () => ({
  StatusBanner: ({ message, tone }: any) => require('react').createElement('status-banner', { message, tone }),
}));

import { OfflineNotice } from './OfflineNotice';

describe('OfflineNotice', () => {
  beforeEach(() => {
    netInfoListener = null;
  });

  it.each([
    ['connected with reachability unknown', { isConnected: true, isInternetReachable: null }],
    ['confirmed online', { isConnected: true, isInternetReachable: true }],
  ] as const)('shows no banner when %s', async (_label, state) => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<OfflineNotice />); });
    expect(tree.root.findAllByType('status-banner')).toHaveLength(0);

    await act(async () => netInfoListener?.(state));
    expect(tree.root.findAllByType('status-banner')).toHaveLength(0);
  });

  it.each([
    ['isConnected is false', { isConnected: false, isInternetReachable: null }],
    ['internet is confirmed unreachable', { isConnected: true, isInternetReachable: false }],
  ] as const)('shows the offline banner when %s', async (_label, state) => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<OfflineNotice />); });
    expect(tree.root.findAllByType('status-banner')).toHaveLength(0);

    await act(async () => netInfoListener?.(state));
    expect(tree.root.findByType('status-banner').props).toEqual(expect.objectContaining({
      tone: 'offline',
      message: 'No internet connection. Requests will not be submitted until online.',
    }));
  });
});