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
  currentActiveEntryId: 'entry-1',
  timeEntries: [
    {
      id: 'entry-2',
      employeeId: 'emp-1',
      workType: 'job',
      jobIds: ['job-2'],
      clockIn: '2026-08-06T11:00:00.000Z',
      breakMinutes: 0,
      notes: '',
      status: 'clocked_in',
    },
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
  jobs: [
    { id: 'job-1', title: 'Front Walkway', status: 'scheduled', assignedEmployeeIds: ['emp-1'] },
    { id: 'job-2', title: 'Warehouse', status: 'scheduled', assignedEmployeeIds: ['emp-1'] },
  ],
}));

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
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
    ActivityIndicator: () => React.createElement('activity-indicator', {}),
    Image: () => React.createElement('image', {}),
    Pressable: ({ children, onPress }: any) =>
      React.createElement('pressable', { onPress }, typeof children === 'function' ? children({ pressed: false }) : children),
    View: ({ children }: any) => React.createElement('view', {}, children),
    Text: ({ children }: any) => React.createElement('text', {}, children),
    TextInput: ({ onChangeText, value, placeholder }: any) => React.createElement('textinput', { onChangeText, value, placeholder }),
  };
});

import ClockOutScreen from '../../app/clock-out';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { completeUpload, prepareUpload, uploadUriToS3 } from '@/api/storageApi';

describe('ClockOutScreen', () => {
  beforeEach(() => {
    (Alert.alert as jest.Mock).mockReset();
    (router.replace as jest.Mock).mockReset();
    mockClockOut.mockReset();
    mockClockOut.mockResolvedValue({ ok: true });
    (prepareUpload as jest.Mock).mockReset();
    (uploadUriToS3 as jest.Mock).mockReset();
    (completeUpload as jest.Mock).mockReset();
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockReset();
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockReset();
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => ({ size: 1024 }),
    });
  });

  it('shows offline notice and keeps confirm enabled when active shift exists', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockOutScreen));
    });

    expect(tree.root.findAllByType('offline-notice').length).toBe(1);

    const confirm = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock Out');
    expect(confirm?.props.disabled).toBe(false);
  });

  it('asks for destructive confirmation before submit', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockOutScreen));
    });

    const notesInput = tree.root.findAllByType('textinput').find((node: any) => node.props.placeholder === "Add optional notes about today's work...");
    await act(async () => {
      notesInput.props.onChangeText('Done');
    });

    const confirm = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock Out');
    await act(async () => {
      confirm.props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect((Alert.alert as jest.Mock).mock.calls[0]?.[0]).toBe('Confirm Clock Out');

    (Alert.alert as jest.Mock).mockImplementation((_title: string, _message: string, actions: Array<{ onPress?: () => void }>) => {
      const confirmAction = actions?.[1];
      if (confirmAction?.onPress) {
        confirmAction.onPress();
      }
    });

    await act(async () => {
      confirm.props.onPress();
    });

    expect(mockClockOut).toHaveBeenCalledWith('entry-1', 'Done', undefined, { requestId: 'req-2', idempotencyKey: 'key-2' });
  });

  it('uploads a library photo and submits its file ID array on clock-out', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file://clock-out-1.heic',
          fileName: 'clock-out-1.heic',
          mimeType: 'image/heic',
        },
      ],
    });
    (prepareUpload as jest.Mock).mockResolvedValue({
      ok: true,
      fileId: 'file-123',
      uploadUrl: 'https://uploads.example/file-123',
      requiredHeaders: { 'Content-Type': 'image/heic' },
    });
    (uploadUriToS3 as jest.Mock).mockResolvedValue(undefined);
    (completeUpload as jest.Mock).mockResolvedValue({ ok: true, fileId: 'file-123' });

    (Alert.alert as jest.Mock).mockImplementation((title: string, _message: string, actions: Array<{ onPress?: () => void }>) => {
      if (title === 'Add Photo') {
        const libraryAction = actions?.[1];
        if (libraryAction?.onPress) libraryAction.onPress();
        return;
      }

      if (title === 'Confirm Clock Out') {
        const confirmAction = actions?.[1];
        if (confirmAction?.onPress) confirmAction.onPress();
      }
    });

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockOutScreen));
    });

    const notesInput = tree.root.findAllByType('textinput').find((node: any) => node.props.placeholder === "Add optional notes about today's work...");
    await act(async () => {
      notesInput.props.onChangeText('Done');
    });

    const addPhotoPressable = tree.root.findAllByType('pressable').find((node: any) => {
      const children = node.children ?? [];
      return children.some((child: any) => child?.props?.children === 'Add Photo');
    });

    await act(async () => {
      addPhotoPressable.props.onPress();
    });

    const confirm = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock Out');
    await act(async () => {
      confirm.props.onPress();
    });

    expect(mockClockOut).toHaveBeenCalledWith('entry-1', 'Done', ['file-123'], { requestId: 'req-2', idempotencyKey: 'key-2' });
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

    const notesInput = tree.root.findAllByType('textinput').find((node: any) => node.props.placeholder === "Add optional notes about today's work...");
    await act(async () => {
      notesInput.props.onChangeText('Done');
    });

    const confirm = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock Out');
    await act(async () => {
      confirm.props.onPress();
    });

    const retry = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Retry Clock Out');
    expect(retry).toBeTruthy();
  });
});
