import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockClockOut = jest.fn();
const mockRefresh = jest.fn().mockResolvedValue({ ok: true });
const mockGetRequiredForms = jest.fn().mockResolvedValue({ ok: true, forms: [] });
const mockRefreshForms = jest.fn().mockResolvedValue({ ok: true });
const mockOpenSettings = jest.fn().mockResolvedValue(undefined);
let activeShiftClosed = false;

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
  currentActiveEntryId: activeShiftClosed ? null : 'entry-1',
  timeEntries: activeShiftClosed ? [] : [
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
}));

jest.mock('@/hooks/useClockingActions', () => ({
  useClockingActions: () => mockUseClockingActions(),
}));

jest.mock('@/hooks/useFormsActions', () => ({
  useFormsActions: () => ({ getRequiredForms: mockGetRequiredForms, refreshForms: mockRefreshForms }),
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
  deleteUploadedFile: jest.fn(),
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

jest.mock('@/components/SecondaryButton', () => ({
  SecondaryButton: ({ label, onPress }: any) => require('react').createElement('secondary-button', { label, onPress }),
}));

jest.mock('react-native', () => {
  const React = require('react');
  return {
    NativeModules: {},
    Platform: { select: (values: any) => values.ios ?? values.default },
    StyleSheet: { create: (value: unknown) => value },
    TurboModuleRegistry: { get: () => null },
    Linking: { openSettings: (...args: unknown[]) => mockOpenSettings(...args) },
    Alert: { alert: jest.fn() },
    ActivityIndicator: () => React.createElement('activity-indicator', {}),
    Image: () => React.createElement('image', {}),
    Pressable: ({ children, onPress }: any) =>
      React.createElement('pressable', { onPress }, typeof children === 'function' ? children({ pressed: false }) : children),
    View: ({ children }: any) => React.createElement('view', {}, children),
    Text: ({ children, testID }: any) => React.createElement('text', { testID }, children),
    TextInput: ({ onChangeText, value, placeholder }: any) => React.createElement('textinput', { onChangeText, value, placeholder }),
  };
});

import ClockOutScreen from '../../app/clock-out';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { completeUpload, deleteUploadedFile, prepareUpload, uploadUriToS3 } from '@/api/storageApi';

describe('ClockOutScreen', () => {
  beforeEach(() => {
    activeShiftClosed = false;
    (Alert.alert as jest.Mock).mockReset();
    (router.replace as jest.Mock).mockReset();
    mockClockOut.mockReset();
    mockClockOut.mockResolvedValue({ ok: true });
    mockGetRequiredForms.mockReset().mockResolvedValue({ ok: true, forms: [] });
    mockRefreshForms.mockReset().mockResolvedValue({ ok: true });
    (prepareUpload as jest.Mock).mockReset();
    (uploadUriToS3 as jest.Mock).mockReset();
    (completeUpload as jest.Mock).mockReset();
    (deleteUploadedFile as jest.Mock).mockReset();
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockReset();
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    mockOpenSettings.mockClear();
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockReset();
    (ImagePicker.launchCameraAsync as jest.Mock).mockReset();
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockReset();
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => ({ size: 1024 }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders Total Shift Time from authoritative shift segments', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-06T11:48:00.000Z'));

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockOutScreen));
    });

    const total = tree.root.findByProps({ testID: 'total-shift-time-value' });
    expect(total.props.children).toBe('1h 48m');
  });

  it('does not flash the no-active-shift banner after successful clock-out', async () => {
    mockClockOut.mockImplementation(async () => {
      activeShiftClosed = true;
      return { ok: true };
    });
    (Alert.alert as jest.Mock).mockImplementation((_title: string, _message: string, actions: Array<{ onPress?: () => void }>) => {
      actions?.[1]?.onPress?.();
    });

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockOutScreen));
    });

    const confirm = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock Out');
    await act(async () => {
      confirm.props.onPress();
    });

    const noShiftBanners = tree.root.findAllByType('status-banner').filter(
      (node: any) => node.props.message === 'No active shift found. Refresh and try again.'
    );
    expect(noShiftBanners).toHaveLength(0);
    expect(mockClockOut).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/home');
  });

  it('surfaces post-clock Forms after clock-out remains successful', async () => {
    mockGetRequiredForms
      .mockResolvedValueOnce({ ok: true, forms: [{ id: 'after-clock', name: 'Post Shift Report', category: 'Operations', trigger: 'after_clock_out', context: {}, fields: [] }] })
      .mockResolvedValueOnce({ ok: true, forms: [] });
    (Alert.alert as jest.Mock).mockImplementation((_title: string, _message: string, actions: Array<{ onPress?: () => void }>) => {
      actions?.[1]?.onPress?.();
    });
    let tree: any;
    await act(async () => { tree = create(<ClockOutScreen />); });
    await act(async () => tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock Out').props.onPress());

    expect(mockClockOut).toHaveBeenCalledTimes(1);
    expect(mockGetRequiredForms).toHaveBeenNthCalledWith(1, 'after_clock_out');
    expect(mockGetRequiredForms).toHaveBeenNthCalledWith(2, 'after_completing_job', { jobId: 'job-1' });
    expect(router.replace).not.toHaveBeenCalled();
    expect(tree.root.findAllByType('status-banner').some((node: any) => node.props.message === 'Clock-out submitted successfully.')).toBe(true);
    const text = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(text).toContain('1 form needs your attention');
    expect(text).toContain('Post Shift Report');

    await act(async () => tree.root.findByType('secondary-button').props.onPress());
    expect(router.replace).toHaveBeenCalledWith('/home');
  });

  it('opens the exact post-clock Form after clock-out succeeds', async () => {
    mockGetRequiredForms
      .mockResolvedValueOnce({ ok: true, forms: [{ id: 'after-clock', name: 'Post Shift Report', trigger: 'after_clock_out', context: { jobId: 'job-1' }, fields: [] }] })
      .mockResolvedValueOnce({ ok: true, forms: [] });
    (Alert.alert as jest.Mock).mockImplementation((_title: string, _message: string, actions: Array<{ onPress?: () => void }>) => actions?.[1]?.onPress?.());
    let tree: any;
    await act(async () => { tree = create(<ClockOutScreen />); });
    await act(async () => tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock Out').props.onPress());
    await act(async () => tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Complete Form').props.onPress());

    expect(mockClockOut).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/form',
      params: expect.objectContaining({ formId: 'after-clock', trigger: 'after_clock_out', returnTo: '/home' }),
    }));
  });

  it('keeps successful clock-out valid when post-action Forms checks fail', async () => {
    mockGetRequiredForms.mockResolvedValue({ ok: false, error: 'Could not check required Forms.' });
    (Alert.alert as jest.Mock).mockImplementation((_title: string, _message: string, actions: Array<{ onPress?: () => void }>) => actions?.[1]?.onPress?.());
    let tree: any;
    await act(async () => { tree = create(<ClockOutScreen />); });
    await act(async () => tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock Out').props.onPress());

    expect(mockClockOut).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/home');
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

  it('uploads selected library photos and submits all file IDs on clock-out', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file://clock-out-1.heic',
          fileName: 'clock-out-1.heic',
          mimeType: 'image/heic',
        },
        {
          uri: 'file://clock-out-2.jpg',
          fileName: 'clock-out-2.jpg',
          mimeType: 'image/jpeg',
        },
      ],
    });
    (prepareUpload as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        fileId: 'file-123',
        uploadUrl: 'https://uploads.example/file-123',
        requiredHeaders: { 'Content-Type': 'image/heic' },
      })
      .mockResolvedValueOnce({
        ok: true,
        fileId: 'file-456',
        uploadUrl: 'https://uploads.example/file-456',
        requiredHeaders: { 'Content-Type': 'image/jpeg' },
      });
    (uploadUriToS3 as jest.Mock).mockResolvedValue(undefined);
    (completeUpload as jest.Mock)
      .mockResolvedValueOnce({ ok: true, fileId: 'file-123' })
      .mockResolvedValueOnce({ ok: true, fileId: 'file-456' });

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

    expect(mockClockOut).toHaveBeenCalledWith('entry-1', 'Done', ['file-123', 'file-456'], { requestId: 'req-2', idempotencyKey: 'key-2' });
    expect(prepareUpload).toHaveBeenCalledTimes(2);
  });

  it('combines camera and library photos while respecting the five-photo capacity', async () => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://camera.jpg', fileName: 'camera.jpg', mimeType: 'image/jpeg' }],
    });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: Array.from({ length: 6 }, (_, index) => ({
        uri: `file://library-${index + 1}.jpg`,
        fileName: `library-${index + 1}.jpg`,
        mimeType: 'image/jpeg',
      })),
    });
    for (let index = 1; index <= 5; index += 1) {
      (prepareUpload as jest.Mock).mockResolvedValueOnce({
        ok: true,
        fileId: `file-${index}`,
        uploadUrl: `https://uploads.example/file-${index}`,
        requiredHeaders: { 'Content-Type': 'image/jpeg' },
      });
    }
    (uploadUriToS3 as jest.Mock).mockResolvedValue(undefined);
    (completeUpload as jest.Mock).mockResolvedValue({ ok: true });

    let nextSource: 'camera' | 'library' = 'camera';
    (Alert.alert as jest.Mock).mockImplementation((title: string, _message: string, actions: Array<{ onPress?: () => void }>) => {
      if (title === 'Add Photo') {
        const action = nextSource === 'camera' ? actions?.[0] : actions?.[1];
        action?.onPress?.();
        return;
      }

      if (title === 'Confirm Clock Out') {
        actions?.[1]?.onPress?.();
      }
    });

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockOutScreen));
    });

    const findAddPhoto = () => tree.root.findAllByType('pressable').find((node: any) =>
      (node.children ?? []).some((child: any) => child?.props?.children === 'Add Photo')
    );

    await act(async () => {
      findAddPhoto().props.onPress();
    });
    nextSource = 'library';
    await act(async () => {
      findAddPhoto().props.onPress();
    });

    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({
      allowsMultipleSelection: true,
      selectionLimit: 4,
    }));
    expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    expect(prepareUpload).toHaveBeenCalledTimes(5);
    expect(findAddPhoto()).toBeUndefined();

    const confirm = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock Out');
    await act(async () => {
      confirm.props.onPress();
    });

    expect(mockClockOut).toHaveBeenCalledWith(
      'entry-1',
      '',
      ['file-1', 'file-2', 'file-3', 'file-4', 'file-5'],
      { requestId: 'req-2', idempotencyKey: 'key-2' }
    );
  });

  it('offers app settings when camera permission cannot be requested again', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });
    (Alert.alert as jest.Mock).mockImplementation((title: string, _message: string, actions: Array<{ onPress?: () => void }>) => {
      if (title === 'Add Photo') actions?.[0]?.onPress?.();
    });

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockOutScreen));
    });
    const addPhoto = tree.root.findAllByType('pressable').find((node: any) =>
      (node.children ?? []).some((child: any) => child?.props?.children === 'Add Photo')
    );
    await act(async () => {
      addPhoto.props.onPress();
    });

    const openSettings = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Open Settings');
    expect(openSettings).toBeTruthy();
    await act(async () => {
      openSettings.props.onPress();
    });
    expect(mockOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('deletes uploaded unsaved attachment when removed', async () => {
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
    (deleteUploadedFile as jest.Mock).mockResolvedValue({ ok: true });

    (Alert.alert as jest.Mock).mockImplementation((title: string, _message: string, actions: Array<{ onPress?: () => void }>) => {
      if (title === 'Add Photo') {
        const libraryAction = actions?.[1];
        if (libraryAction?.onPress) libraryAction.onPress();
      }
    });

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockOutScreen));
    });

    const addPhotoPressable = tree.root.findAllByType('pressable').find((node: any) => {
      const children = node.children ?? [];
      return children.some((child: any) => child?.props?.children === 'Add Photo');
    });

    await act(async () => {
      addPhotoPressable.props.onPress();
    });

    const removePressable = tree.root.findAllByType('pressable').find((node: any) => {
      const children = node.children ?? [];
      return children.some((child: any) => child?.props?.children === 'Remove');
    });

    await act(async () => {
      removePressable.props.onPress();
    });

    expect(deleteUploadedFile).toHaveBeenCalledWith('file-123', 'token-1');
  });

  it('cleans up uploaded attachments when leaving without clocking out', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://draft.jpg', fileName: 'draft.jpg', mimeType: 'image/jpeg' }],
    });
    (prepareUpload as jest.Mock).mockResolvedValue({
      ok: true,
      fileId: 'draft-file',
      uploadUrl: 'https://uploads.example/draft-file',
      requiredHeaders: { 'Content-Type': 'image/jpeg' },
    });
    (uploadUriToS3 as jest.Mock).mockResolvedValue(undefined);
    (completeUpload as jest.Mock).mockResolvedValue({ ok: true, fileId: 'draft-file' });
    (deleteUploadedFile as jest.Mock).mockResolvedValue({ ok: true });
    (Alert.alert as jest.Mock).mockImplementation((title: string, _message: string, actions: Array<{ onPress?: () => void }>) => {
      if (title === 'Add Photo') actions?.[1]?.onPress?.();
    });

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockOutScreen));
    });
    const addPhoto = tree.root.findAllByType('pressable').find((node: any) =>
      (node.children ?? []).some((child: any) => child?.props?.children === 'Add Photo')
    );
    await act(async () => {
      addPhoto.props.onPress();
    });
    await act(async () => {
      tree.unmount();
    });

    expect(deleteUploadedFile).toHaveBeenCalledWith('draft-file', 'token-1');
  });

  it('does not clean up attachments committed by a successful clock-out', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://committed.jpg', fileName: 'committed.jpg', mimeType: 'image/jpeg' }],
    });
    (prepareUpload as jest.Mock).mockResolvedValue({
      ok: true,
      fileId: 'committed-file',
      uploadUrl: 'https://uploads.example/committed-file',
      requiredHeaders: { 'Content-Type': 'image/jpeg' },
    });
    (uploadUriToS3 as jest.Mock).mockResolvedValue(undefined);
    (completeUpload as jest.Mock).mockResolvedValue({ ok: true, fileId: 'committed-file' });
    (Alert.alert as jest.Mock).mockImplementation((title: string, _message: string, actions: Array<{ onPress?: () => void }>) => {
      if (title === 'Add Photo') {
        actions?.[1]?.onPress?.();
      } else if (title === 'Confirm Clock Out') {
        actions?.[1]?.onPress?.();
      }
    });

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockOutScreen));
    });
    const addPhoto = tree.root.findAllByType('pressable').find((node: any) =>
      (node.children ?? []).some((child: any) => child?.props?.children === 'Add Photo')
    );
    await act(async () => {
      addPhoto.props.onPress();
    });
    const confirm = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock Out');
    await act(async () => {
      confirm.props.onPress();
    });
    await act(async () => {
      tree.unmount();
    });

    expect(mockClockOut).toHaveBeenCalledWith(
      'entry-1',
      '',
      ['committed-file'],
      { requestId: 'req-2', idempotencyKey: 'key-2' }
    );
    expect(deleteUploadedFile).not.toHaveBeenCalled();
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

  it('cleans a failed prepared upload and blocks clock-out until the failed photo is retried', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [
        { uri: 'file://first.jpg', fileName: 'first.jpg', mimeType: 'image/jpeg' },
        { uri: 'file://second.jpg', fileName: 'second.jpg', mimeType: 'image/jpeg' },
      ],
    });
    (prepareUpload as jest.Mock)
      .mockResolvedValueOnce({ fileId: 'file-1', uploadUrl: 'https://uploads.example/file-1' })
      .mockResolvedValueOnce({ fileId: 'file-2', uploadUrl: 'https://uploads.example/file-2' })
      .mockResolvedValueOnce({ fileId: 'file-2-retry', uploadUrl: 'https://uploads.example/file-2-retry' });
    (uploadUriToS3 as jest.Mock).mockImplementation((url: string) => {
      return url.endsWith('/file-2')
        ? Promise.reject(new Error('upload interrupted'))
        : Promise.resolve();
    });
    (completeUpload as jest.Mock).mockResolvedValue({ ok: true });
    (deleteUploadedFile as jest.Mock).mockResolvedValue({ ok: true });
    (Alert.alert as jest.Mock).mockImplementation((title: string, _message: string, actions: Array<{ onPress?: () => void }>) => {
      if (title === 'Add Photo') actions?.[1]?.onPress?.();
      if (title === 'Confirm Clock Out') actions?.[1]?.onPress?.();
    });

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockOutScreen));
    });
    const addPhoto = tree.root.findAllByType('pressable').find((node: any) =>
      (node.children ?? []).some((child: any) => child?.props?.children === 'Add Photo')
    );
    await act(async () => {
      addPhoto.props.onPress();
    });

    expect(deleteUploadedFile).toHaveBeenCalledWith('file-2', 'token-1');
    let clockOutButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock Out');
    expect(clockOutButton.props.disabled).toBe(true);

    const retryPhoto = tree.root.findAllByType('pressable').find((node: any) =>
      (node.children ?? []).some((child: any) => child?.props?.children === 'Retry')
    );
    await act(async () => {
      retryPhoto.props.onPress();
    });

    clockOutButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock Out');
    expect(clockOutButton.props.disabled).toBe(false);
    await act(async () => {
      clockOutButton.props.onPress();
    });
    expect(mockClockOut).toHaveBeenCalledWith(
      'entry-1',
      '',
      ['file-1', 'file-2-retry'],
      { requestId: 'req-2', idempotencyKey: 'key-2' }
    );
  });

  it('keeps clock-out disabled while a photo upload is in progress', async () => {
    let finishUpload: (() => void) | undefined;
    const uploadPending = new Promise<void>((resolve) => {
      finishUpload = resolve;
    });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://pending.jpg', fileName: 'pending.jpg', mimeType: 'image/jpeg' }],
    });
    (prepareUpload as jest.Mock).mockResolvedValue({
      fileId: 'pending-file',
      uploadUrl: 'https://uploads.example/pending-file',
    });
    (uploadUriToS3 as jest.Mock).mockReturnValue(uploadPending);
    (completeUpload as jest.Mock).mockResolvedValue({ ok: true });
    (Alert.alert as jest.Mock).mockImplementation((title: string, _message: string, actions: Array<{ onPress?: () => void }>) => {
      if (title === 'Add Photo') actions?.[1]?.onPress?.();
    });

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockOutScreen));
    });
    const addPhoto = tree.root.findAllByType('pressable').find((node: any) =>
      (node.children ?? []).some((child: any) => child?.props?.children === 'Add Photo')
    );
    await act(async () => {
      addPhoto.props.onPress();
      await Promise.resolve();
    });

    let clockOutButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock Out');
    expect(clockOutButton.props.disabled).toBe(true);

    await act(async () => {
      finishUpload?.();
      await uploadPending;
    });
    clockOutButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock Out');
    expect(clockOutButton.props.disabled).toBe(false);
  });
});
