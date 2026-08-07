import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockClockOut = jest.fn();
const mockRefresh = jest.fn().mockResolvedValue({ ok: true });

const mockUseClockingActions = jest.fn(() => ({
  clockOut: mockClockOut,
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
  accessToken: 'token-1',
}));

const mockUseClockingStore = jest.fn(() => ({
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

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
  MediaTypeOptions: { Images: 'Images' },
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
  createRequestMeta: () => ({ requestId: 'req-2', idempotencyKey: 'key-2' }),
}));

jest.mock('@/services/connectivity', () => ({
  isOnline: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/api/storageApi', () => ({
  prepareUpload: jest.fn(),
  uploadUriToS3: jest.fn(),
  completeUpload: jest.fn(),
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
    Alert: { alert: jest.fn() },
    View: ({ children }: any) => React.createElement('view', {}, children),
    Text: ({ children }: any) => React.createElement('text', {}, children),
    TextInput: ({ onChangeText, value, placeholder }: any) => React.createElement('textinput', { onChangeText, value, placeholder }),
  };
});

import ClockOutScreen from '../../app/clock-out';
import { router } from 'expo-router';
import { Alert } from 'react-native';

describe('ClockOutScreen', () => {
  beforeEach(() => {
    (Alert.alert as jest.Mock).mockReset();
    (router.replace as jest.Mock).mockReset();
    mockClockOut.mockReset();
    mockClockOut.mockResolvedValue({ ok: true });
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

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect((Alert.alert as jest.Mock).mock.calls[0]?.[0]).toBe('Confirm Clock Out');
  });

  it('shows retry button after failed clock-out submission', async () => {
    mockClockOut.mockResolvedValue({ ok: false, error: 'Offline. Reconnect and retry clock-out.' });

    (Alert.alert as jest.Mock).mockImplementation((_title: string, _message: string, actions: Array<{ onPress?: () => void }>) => {
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
