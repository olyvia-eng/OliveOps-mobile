import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockClockIn = jest.fn();
const mockRefresh = jest.fn().mockResolvedValue({ ok: true });

const mockUseClockingActions = jest.fn(() => ({
  clockIn: mockClockIn,
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
  createRequestMeta: () => ({ requestId: 'req-1', idempotencyKey: 'key-1' }),
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
    Pressable: ({ children, onPress }: any) =>
      React.createElement('pressable', { onPress }, typeof children === 'function' ? children({ pressed: false }) : children),
  };
});

import ClockInScreen from '../../app/clock-in';
import { router } from 'expo-router';

describe('ClockInScreen', () => {
  beforeEach(() => {
    (router.replace as jest.Mock).mockReset();
    mockClockIn.mockReset();
    mockRefresh.mockClear();
    mockClockIn.mockResolvedValue({ ok: true });
  });

  it('shows offline notice and disables submit until a job is selected', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockInScreen));
    });

    const offline = tree.root.findAllByType('offline-notice');
    expect(offline.length).toBe(1);

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock In');
    expect(submitButton?.props.disabled).toBe(true);

    const jobPress = tree.root.findAllByProps({ testID: 'job-option-job-1' })[0];
    await act(async () => {
      jobPress.props.onPress();
    });

    const enabledSubmit = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock In');
    expect(enabledSubmit?.props.disabled).toBe(false);
  });

  it('submits selected job and navigates to active shift', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockInScreen));
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'job-option-job-1' })[0].props.onPress();
    });

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock In');
    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(mockClockIn).toHaveBeenCalledWith('emp-1', 'job', ['job-1'], { requestId: 'req-1', idempotencyKey: 'key-1' });
    expect(router.replace).toHaveBeenCalledWith('/active-shift');
  });

  it('shows retry action when clock-in fails', async () => {
    mockClockIn.mockResolvedValue({ ok: false, error: 'Offline. Reconnect and retry clock-in.' });

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockInScreen));
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'job-option-job-1' })[0].props.onPress();
    });

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock In');
    await act(async () => {
      await submitButton.props.onPress();
    });

    const retryButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Retry Clock In');
    expect(retryButton).toBeTruthy();
  });

  it('submits unbillable without jobIds or category payload', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockInScreen));
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'activity-option-non_billable' })[0].props.onPress();
    });

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock In');
    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(mockClockIn).toHaveBeenCalledWith('emp-1', 'non_billable', [], { requestId: 'req-1', idempotencyKey: 'key-1' });
  });
});
