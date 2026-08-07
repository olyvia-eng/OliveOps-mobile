import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSwitchActivity = jest.fn();
const mockRefresh = jest.fn().mockResolvedValue({ ok: true });

const mockUseClockingActions = jest.fn(() => ({
  switchActivity: mockSwitchActivity,
  loading: false,
  refreshWorkContext: mockRefresh,
}));

const mockUseAuthStore = jest.fn(() => ({
  user: {
    id: 'u-1',
    businessId: 'biz-1',
    name: 'Alex',
    email: 'a@x.com',
    role: 'crew_member',
    businessName: 'OliveOps',
    employeeId: 'emp-1',
  },
  capabilities: {
    paidDriveTime: true,
  },
}));

const mockUseClockingStore = jest.fn(() => ({
  jobs: [
    { id: 'job-1', title: 'Site A', status: 'scheduled', assignedEmployeeIds: ['emp-1'] },
  ],
  timeEntries: [
    {
      id: 'entry-1',
      employeeId: 'emp-1',
      workType: 'job',
      jobIds: ['job-1'],
      clockIn: '2026-08-07T10:00:00.000Z',
      breakMinutes: 0,
      notes: '',
      status: 'clocked_in',
    },
  ],
}));

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));

jest.mock('@/hooks/useClockingActions', () => ({
  useClockingActions: () => mockUseClockingActions(),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

jest.mock('@/store/clockingStore', () => ({
  useClockingStore: () => mockUseClockingStore(),
}));

jest.mock('@/services/requestGuards', () => ({
  createRequestMeta: () => ({ requestId: 'req-switch-1', idempotencyKey: 'key-switch-1' }),
}));

jest.mock('@/components/Screen', () => ({
  Screen: ({ children }: any) => require('react').createElement('screen', {}, children),
}));

jest.mock('@/components/OfflineNotice', () => ({
  OfflineNotice: () => require('react').createElement('offline-notice', {}),
}));

jest.mock('@/components/StatusBanner', () => ({
  StatusBanner: ({ message }: any) => require('react').createElement('status-banner', { message }),
}));

jest.mock('@/components/PrimaryActionButton', () => ({
  PrimaryActionButton: ({ label, disabled, onPress }: any) =>
    require('react').createElement('primary-button', { label, disabled: !!disabled, onPress }),
}));

jest.mock('react-native', () => {
  const React = require('react');
  return {
    StyleSheet: { create: (value: unknown) => value },
    View: ({ children }: any) => React.createElement('view', {}, children),
    Text: ({ children }: any) => React.createElement('text', {}, children),
    Pressable: ({ children, onPress, testID }: any) =>
      React.createElement('pressable', { onPress, testID }, typeof children === 'function' ? children({ pressed: false }) : children),
  };
});

import SwitchActivityScreen from '../../app/switch-activity';
import { router } from 'expo-router';

describe('SwitchActivityScreen', () => {
  beforeEach(() => {
    (router.replace as jest.Mock).mockReset();
    mockSwitchActivity.mockReset();
    mockRefresh.mockClear();
    mockSwitchActivity.mockResolvedValue({ ok: true });
  });

  it('submits unbillable switch with no category payload and no jobIds', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(SwitchActivityScreen));
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'switch-activity-option-non_billable' })[0].props.onPress();
    });

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Switch Activity');
    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(mockSwitchActivity).toHaveBeenCalledWith('non_billable', [], { requestId: 'req-switch-1', idempotencyKey: 'key-switch-1' });
    expect(router.replace).toHaveBeenCalledWith('/active-shift');
  });
});
