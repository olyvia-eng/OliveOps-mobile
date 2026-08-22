import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, jest } from '@jest/globals';

let mockOfflineClock: any;

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/store/offlineClockContext', () => ({
  useOptionalOfflineClockStore: () => mockOfflineClock,
  getOfflineConflictMessage: () => 'Current shift conflict.',
}));
jest.mock('@/components/StatusBanner', () => ({
  StatusBanner: ({ message, tone }: any) => require('react').createElement('status-banner', { message, tone }),
}));
jest.mock('@/components/SecondaryButton', () => ({
  SecondaryButton: ({ label, onPress }: any) => require('react').createElement('secondary-button', { label, onPress }),
}));

import { OfflineClockStatus } from './OfflineClockStatus';

describe('OfflineClockStatus', () => {
  it('shows historical attention separately from pending queue health', async () => {
    mockOfflineClock = {
      effectiveState: {
        currentShiftConflict: null,
        needsAttentionCount: 1,
        pendingCount: 2,
      },
      syncNow: jest.fn(),
    };

    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<OfflineClockStatus showHistoricalAttention />);
    });
    const messages = tree.root.findAllByType('status-banner').map((node) => node.props.message);
    expect(messages).toEqual(['1 time change needs attention.', '2 changes are waiting to sync.']);
    expect(messages).not.toContain('Current shift conflict.');
    expect(tree.root.findByType('secondary-button').props.label).toBe('Review');
  });

  it('shows the conflict message only when the effective shift is affected', async () => {
    mockOfflineClock = {
      effectiveState: {
        currentShiftConflict: { lastErrorCategory: 'offline_shift_state_conflict' },
        needsAttentionCount: 1,
        pendingCount: 0,
      },
      syncNow: jest.fn(),
    };

    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<OfflineClockStatus showHistoricalAttention />);
    });
    expect(tree.root.findByType('status-banner').props.message).toBe('Current shift conflict.');
    expect(tree.root.findByType('secondary-button').props.label).toBe('Request Time Correction');
  });
});