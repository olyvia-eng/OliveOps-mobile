import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, jest } from '@jest/globals';

const mockRefreshMyCorrections = jest.fn().mockResolvedValue({ ok: true });

const mockUseTimeCorrectionActions = jest.fn(() => ({
  refreshMyCorrections: mockRefreshMyCorrections,
}));

const mockUseClockingStore = jest.fn(() => ({
  timeCorrections: [
    {
      id: 'corr-1',
      employeeId: 'emp-1',
      requestType: 'wrong_time',
      status: 'pending',
      reason: 'Needed fix',
      submittedByUserId: 'u-1',
      submittedAt: '2026-08-07T10:00:00.000Z',
      createdAt: '2026-08-07T10:00:00.000Z',
      updatedAt: '2026-08-07T10:00:00.000Z',
    },
    {
      id: 'corr-2',
      employeeId: 'emp-1',
      requestType: 'wrong_activity',
      status: 'approved',
      reason: 'Updated',
      submittedByUserId: 'u-1',
      submittedAt: '2026-08-06T10:00:00.000Z',
      createdAt: '2026-08-06T10:00:00.000Z',
      updatedAt: '2026-08-06T10:00:00.000Z',
    },
    {
      id: 'corr-3',
      employeeId: 'emp-1',
      requestType: 'other',
      status: 'rejected',
      reason: 'Denied',
      submittedByUserId: 'u-1',
      submittedAt: '2026-08-05T10:00:00.000Z',
      createdAt: '2026-08-05T10:00:00.000Z',
      updatedAt: '2026-08-05T10:00:00.000Z',
    },
  ],
}));

jest.mock('@/hooks/useTimeCorrectionActions', () => ({
  useTimeCorrectionActions: () => mockUseTimeCorrectionActions(),
}));

jest.mock('@/store/clockingStore', () => ({
  useClockingStore: () => mockUseClockingStore(),
}));

jest.mock('@/components/Screen', () => ({
  Screen: ({ children }: any) => require('react').createElement('screen', {}, children),
}));

jest.mock('@/components/StatusBanner', () => ({
  StatusBanner: ({ message }: any) => require('react').createElement('status-banner', { message }),
}));

jest.mock('react-native', () => {
  const React = require('react');
  return {
    StyleSheet: { create: (value: unknown) => value },
    View: ({ children }: any) => React.createElement('view', {}, children),
    Text: ({ children }: any) => React.createElement('text', {}, children),
    FlatList: ({ data, ListEmptyComponent, renderItem }: any) => {
      if (!Array.isArray(data) || data.length === 0) {
        return React.createElement('flat-list', {}, ListEmptyComponent || null);
      }
      return React.createElement('flat-list', {}, data.map((item: any, index: number) => (
        React.createElement(React.Fragment, { key: item.id || `item-${index}` }, renderItem({ item }))
      )));
    },
  };
});

import MyCorrectionRequestsScreen from '../../app/my-correction-requests';

describe('MyCorrectionRequestsScreen', () => {
  it('shows request statuses and does not render approval controls for employees', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(MyCorrectionRequestsScreen));
    });

    const labels = tree.root.findAllByType('text').map((node: any) => String(node.props.children));
    expect(labels).toContain('Pending');
    expect(labels).toContain('Approved');
    expect(labels).toContain('Rejected');
    expect(labels).not.toContain('Approve');
    expect(labels).not.toContain('Reject');

    expect(mockRefreshMyCorrections).toHaveBeenCalledTimes(1);
  });
});
