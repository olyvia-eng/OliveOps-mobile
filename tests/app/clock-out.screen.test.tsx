import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  alertMock: vi.fn(),
  replaceMock: vi.fn(),
  mockClockOut: vi.fn(),
  mockRefresh: vi.fn().mockResolvedValue({ ok: true }),
}));

const mockUseClockingActions = vi.fn(() => ({
  clockOut: hoisted.mockClockOut,
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
  accessToken: 'token-1',
}));

const mockUseClockingStore = vi.fn(() => ({
  timeEntries: [
    {
      id: 'entry-1',
      employeeId: 'emp-1',
      workType: 'job',
      jobIds: ['job-1'],
      clockIn: '2026-08-06T10:00:00.000Z',
      breakMinutes: 0,
      notes: '',
      status: 'clocked_in',
    },
  ],
}));

vi.mock('expo-router', () => ({
  router: {
    replace: hoisted.replaceMock,
  },
}));

vi.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: vi.fn().mockResolvedValue({ granted: true }),
  launchCameraAsync: vi.fn().mockResolvedValue({ canceled: true, assets: [] }),
  MediaTypeOptions: { Images: 'Images' },
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
  createRequestMeta: () => ({ requestId: 'req-2', idempotencyKey: 'key-2' }),
}));

vi.mock('@/services/connectivity', () => ({
  isOnline: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/api/storageApi', () => ({
  prepareUpload: vi.fn(),
  uploadUriToS3: vi.fn(),
  completeUpload: vi.fn(),
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
    Alert: { alert: hoisted.alertMock },
    View: ({ children }: any) => React.createElement('view', {}, children),
    Text: ({ children }: any) => React.createElement('text', {}, children),
    TextInput: ({ onChangeText, value, placeholder }: any) => React.createElement('textinput', { onChangeText, value, placeholder }),
  };
});

import ClockOutScreen from '../../app/clock-out';

describe('ClockOutScreen', () => {
  beforeEach(() => {
    hoisted.alertMock.mockReset();
    hoisted.replaceMock.mockReset();
    hoisted.mockClockOut.mockReset();
    hoisted.mockClockOut.mockResolvedValue({ ok: true });
  });

  it('shows offline notice and disables confirm until notes entered', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockOutScreen));
    });

    expect(tree.root.findAllByType('offline-notice').length).toBe(1);

    const confirm = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Confirm Clock Out');
    expect(confirm?.props.disabled).toBe(true);

    const notesInput = tree.root.findAllByType('textinput').find((node: any) => node.props.placeholder === 'Optional notes');
    await act(async () => {
      notesInput.props.onChangeText('Done for today');
    });

    const enabledConfirm = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Confirm Clock Out');
    expect(enabledConfirm?.props.disabled).toBe(false);
  });

  it('asks for destructive confirmation before submit', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockOutScreen));
    });

    const notesInput = tree.root.findAllByType('textinput').find((node: any) => node.props.placeholder === 'Optional notes');
    await act(async () => {
      notesInput.props.onChangeText('Done');
    });

    const confirm = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Confirm Clock Out');
    await act(async () => {
      confirm.props.onPress();
    });

    expect(hoisted.alertMock).toHaveBeenCalledTimes(1);
    expect(hoisted.alertMock.mock.calls[0]?.[0]).toBe('Confirm Clock Out');
  });

  it('shows retry button after failed clock-out submission', async () => {
    hoisted.mockClockOut.mockResolvedValue({ ok: false, error: 'Offline. Reconnect and retry clock-out.' });

    hoisted.alertMock.mockImplementation((_title: string, _message: string, actions: Array<{ onPress?: () => void }>) => {
      const confirmAction = actions?.[1];
      if (confirmAction?.onPress) {
        confirmAction.onPress();
      }
    });

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockOutScreen));
    });

    const notesInput = tree.root.findAllByType('textinput').find((node: any) => node.props.placeholder === 'Optional notes');
    await act(async () => {
      notesInput.props.onChangeText('Done');
    });

    const confirm = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Confirm Clock Out');
    await act(async () => {
      confirm.props.onPress();
    });

    const retry = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Retry Clock Out');
    expect(retry).toBeTruthy();
  });
});
