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

function command(id: string, status: string, localShiftId = 'shift-1', occurredAt = '2026-08-23T10:00:00.000Z') {
  return { id, status, localShiftId, clientOccurredAt: occurredAt, queuedAt: occurredAt };
}

describe('OfflineClockStatus', () => {
  it('shows historical attention separately from pending queue health', async () => {
    mockOfflineClock = {
      commands: [command('old-command', 'needs_attention')],
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
    expect(messages).toEqual(['1 time change needs attention. 2 independent changes are waiting to sync.']);
    expect(messages).not.toContain('Current shift conflict.');
    expect(tree.root.findByType('secondary-button').props.label).toBe('Review');
  });

  it('shows the conflict message only when the effective shift is affected', async () => {
    mockOfflineClock = {
      commands: [command('failed-out', 'needs_attention')],
      effectiveState: {
        currentShiftConflict: { id: 'failed-out', lastErrorCategory: 'offline_shift_state_conflict' },
        needsAttentionCount: 1,
        pendingCount: 0,
      },
      syncNow: jest.fn(),
    };

    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<OfflineClockStatus showHistoricalAttention />);
    });
    expect(tree.root.findByType('status-banner').props.message).toBe('1 time change needs attention.');
    expect(tree.root.findByType('secondary-button').props.label).toBe('Review');
  });

  it('shows one root conflict and its blocked dependents in one status area', async () => {
    mockOfflineClock = {
      commands: [
        command('failed-switch', 'needs_attention'),
        command('blocked-switch', 'pending', 'shift-1', '2026-08-23T10:05:00.000Z'),
        command('blocked-out', 'pending', 'shift-1', '2026-08-23T10:10:00.000Z'),
      ],
      effectiveState: {
        currentShiftConflict: null,
        needsAttentionCount: 1,
        pendingCount: 0,
        blockedCount: 2,
        correctionRequestedCount: 0,
      },
      syncNow: jest.fn(),
    };

    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<OfflineClockStatus showHistoricalAttention />);
    });

    expect(tree.root.findAllByType('status-banner')).toHaveLength(1);
    expect(tree.root.findByType('status-banner').props.message)
      .toBe('1 time change needs attention. 2 later changes are waiting for resolution.');
  });
});