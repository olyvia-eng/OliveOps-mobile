import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  mockClockIn: vi.fn(),
  mockRefresh: vi.fn().mockResolvedValue({ ok: true }),
}));

const mockUseClockingActions = vi.fn(() => ({
  clockIn: hoisted.mockClockIn,
  loading: false,
  refreshWorkContext: hoisted.mockRefresh,
}));

const mockUseAuthStore = vi.fn(() => ({
  user: {
    id: 'u-1',
    businessId: 'biz-1',
    name: 'Alex',
    email: 'a@x.com',
    role: 'crew_member',
    businessName: 'OliveOps',
    employeeId: 'emp-1',
  },
}));

const mockUseClockingStore = vi.fn(() => ({
  jobs: [
    { id: 'job-1', title: 'Site A', status: 'scheduled', assignedEmployeeIds: ['emp-1'] },
  ],
}));

vi.mock('expo-router', () => ({
  router: {
    replace: hoisted.replaceMock,
  },
}));

vi.mock('@/hooks/useClockingActions', () => ({
  useClockingActions: () => mockUseClockingActions(),
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

vi.mock('@/store/clockingStore', () => ({
  useClockingStore: () => mockUseClockingStore(),
}));

vi.mock('@/services/requestGuards', () => ({
  createRequestMeta: () => ({ requestId: 'req-1', idempotencyKey: 'key-1' }),
}));

vi.mock('@/components/Screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => React.createElement('screen', {}, children),
}));

vi.mock('@/components/OfflineNotice', () => ({
  OfflineNotice: () => React.createElement('offline-notice', {}),
}));

vi.mock('@/components/StatusBanner', () => ({
  StatusBanner: ({ message }: { message: string }) => React.createElement('status-banner', { message }),
}));

vi.mock('@/components/PrimaryActionButton', () => ({
  PrimaryActionButton: ({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) =>
    React.createElement('primary-button', { label, disabled: !!disabled, onPress }),
}));

vi.mock('react-native', () => {
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

describe('ClockInScreen', () => {
  beforeEach(() => {
    hoisted.replaceMock.mockReset();
    hoisted.mockClockIn.mockReset();
    hoisted.mockRefresh.mockClear();
    hoisted.mockClockIn.mockResolvedValue({ ok: true });
  });

  it('shows offline notice and disables submit until a job is selected', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockInScreen));
    });

    const offline = tree.root.findAllByType('offline-notice');
    expect(offline.length).toBe(1);

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Confirm Clock In');
    expect(submitButton?.props.disabled).toBe(true);

    const jobPress = tree.root.findAllByType('pressable')[0];
    await act(async () => {
      jobPress.props.onPress();
    });

    const enabledSubmit = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Confirm Clock In');
    expect(enabledSubmit?.props.disabled).toBe(false);
  });

  it('submits selected job and navigates to active shift', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockInScreen));
    });

    await act(async () => {
      tree.root.findAllByType('pressable')[0].props.onPress();
    });

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Confirm Clock In');
    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(hoisted.mockClockIn).toHaveBeenCalledWith('emp-1', ['job-1'], { requestId: 'req-1', idempotencyKey: 'key-1' });
    expect(hoisted.replaceMock).toHaveBeenCalledWith('/active-shift');
  });

  it('shows retry action when clock-in fails', async () => {
    hoisted.mockClockIn.mockResolvedValue({ ok: false, error: 'Offline. Reconnect and retry clock-in.' });

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockInScreen));
    });

    await act(async () => {
      tree.root.findAllByType('pressable')[0].props.onPress();
    });

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Confirm Clock In');
    await act(async () => {
      await submitButton.props.onPress();
    });

    const retryButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Retry Clock In');
    expect(retryButton).toBeTruthy();
  });
});
