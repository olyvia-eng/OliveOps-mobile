import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockRefresh = jest.fn().mockResolvedValue({ ok: true });
const mockPush = jest.fn();
const mockSetFlashMessage = jest.fn();
let mockAppStateChange: ((state: string) => void) | undefined;
const mockStore: any = {
  requests: [], loaded: false, listError: null, flashMessage: null, setFlashMessage: mockSetFlashMessage,
};
let mockLoadingList = true;

jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('@/store/timeOffStore', () => ({ useTimeOffStore: () => mockStore }));
jest.mock('@/hooks/useTimeOffActions', () => ({
  useTimeOffActions: () => ({ refresh: mockRefresh, loadingList: mockLoadingList }),
}));
jest.mock('@/components/Screen', () => ({ Screen: ({ children }: any) => require('react').createElement('screen', {}, children) }));
jest.mock('@/components/LoadingState', () => ({ LoadingState: ({ label }: any) => require('react').createElement('loading', { label }) }));
jest.mock('@/components/ErrorState', () => ({ ErrorState: ({ message, onRetry }: any) => require('react').createElement('error-state', { message, onRetry }) }));
jest.mock('@/components/StatusBanner', () => ({ StatusBanner: ({ message }: any) => require('react').createElement('banner', { message }) }));
jest.mock('@/components/PrimaryActionButton', () => ({ PrimaryActionButton: ({ label, onPress }: any) => require('react').createElement('button', { label, onPress }) }));
jest.mock('@/components/MobilePrimitives', () => ({
  ScreenHeader: ({ title }: any) => require('react').createElement('header', { title }),
  SectionHeader: ({ title }: any) => require('react').createElement('section-header', { title }),
  StatusBadge: ({ label }: any) => require('react').createElement('badge', { label }),
  EmptyState: ({ title, message, action }: any) => require('react').createElement('empty-state', { title, message }, action),
  ListRow: (props: any) => require('react').createElement('list-row', props),
}));
jest.mock('react-native', () => ({
  NativeModules: {},
  Platform: { OS: 'ios', select: (values: any) => values.ios ?? values.default },
  TurboModuleRegistry: { get: () => null },
  AppState: {
    currentState: 'active',
    addEventListener: (_event: string, handler: (state: string) => void) => {
      mockAppStateChange = handler;
      return { remove: jest.fn() };
    },
  },
  StyleSheet: { create: (value: unknown) => value },
  View: ({ children, ...props }: any) => require('react').createElement('view', props, children),
}));

import TimeOffScreen from '../../app/time-off';

const pending = {
  id: 'request-1', requestType: 'vacation', startDate: '2026-08-28', endDate: '2026-08-30',
  employeeNote: '', status: 'pending', submittedAt: '2026-08-24T12:00:00.000Z',
  createdAt: '2026-08-24T12:00:00.000Z', updatedAt: '2026-08-24T12:00:00.000Z',
};

describe('TimeOffScreen', () => {
  beforeEach(() => {
    mockRefresh.mockClear().mockResolvedValue({ ok: true });
    mockPush.mockClear();
    mockAppStateChange = undefined;
    Object.assign(mockStore, { requests: [], loaded: false, listError: null, flashMessage: null });
    mockLoadingList = true;
  });

  it('distinguishes loading, server error, and empty states', async () => {
    let tree: any;
    await act(async () => { tree = create(<TimeOffScreen />); });
    expect(tree.root.findByType('loading').props.label).toBe('Loading time-off requests...');

    mockLoadingList = false;
    mockStore.listError = 'Server unavailable';
    await act(async () => tree.update(<TimeOffScreen />));
    const error = tree.root.findByType('error-state');
    expect(error.props.message).toBe('Server unavailable');
    await act(async () => error.props.onRetry());
    expect(mockRefresh).toHaveBeenCalledTimes(2);

    mockStore.loaded = true;
    mockStore.listError = null;
    await act(async () => tree.update(<TimeOffScreen />));
    expect(tree.root.findByType('empty-state').props).toEqual(expect.objectContaining({
      title: 'No time-off requests yet', message: 'Your submitted requests will appear here.',
    }));
  });

  it('renders cached rows during refresh errors and opens detail', async () => {
    Object.assign(mockStore, { requests: [pending], loaded: true, listError: 'Could not refresh' });
    mockLoadingList = false;
    let tree: any;
    await act(async () => { tree = create(<TimeOffScreen />); });
    const row = tree.root.findByProps({ testID: 'time-off-row-request-1' });
    expect(row.props.title).toBe('Vacation');
    expect(row.props.subtitle).toContain('Aug 28');
    await act(async () => row.props.onPress());
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/time-off-detail', params: { id: 'request-1' } });
  });

  it('refreshes when returning to the foreground', async () => {
    await act(async () => { create(<TimeOffScreen />); });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    await act(async () => mockAppStateChange?.('background'));
    await act(async () => mockAppStateChange?.('active'));
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });
});
