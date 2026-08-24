import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockLoadDetail = jest.fn().mockResolvedValue({ ok: true });
const mockCancel = jest.fn().mockResolvedValue({ ok: true });
let mockAlertButtons: any[] = [];
let mockStatus = 'pending';

const baseRequest = {
  id: 'request-1', requestType: 'vacation', startDate: '2026-08-28', endDate: '2026-08-30',
  employeeNote: 'Family trip', submittedAt: '2026-08-24T12:00:00.000Z',
  createdAt: '2026-08-24T12:00:00.000Z', updatedAt: '2026-08-24T12:00:00.000Z',
};

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'request-1' }) }));
jest.mock('@/store/timeOffStore', () => ({
  useTimeOffStore: () => ({
    requests: [{ ...baseRequest, status: mockStatus }],
    details: {},
  }),
}));
jest.mock('@/hooks/useTimeOffActions', () => ({
  useTimeOffActions: () => ({
    loadDetail: mockLoadDetail, cancel: mockCancel, loadingDetail: false, cancellingId: null,
  }),
}));
jest.mock('@/components/Screen', () => ({ Screen: ({ children }: any) => require('react').createElement('screen', {}, children) }));
jest.mock('@/components/MobilePrimitives', () => ({
  ScreenHeader: ({ title }: any) => require('react').createElement('header', { title }),
  StatusBadge: ({ label }: any) => require('react').createElement('badge', { label }),
}));
jest.mock('@/components/LoadingState', () => ({ LoadingState: (props: any) => require('react').createElement('loading', props) }));
jest.mock('@/components/ErrorState', () => ({ ErrorState: (props: any) => require('react').createElement('error-state', props) }));
jest.mock('@/components/StatusBanner', () => ({ StatusBanner: (props: any) => require('react').createElement('banner', props) }));
jest.mock('@/components/SecondaryButton', () => ({ SecondaryButton: (props: any) => require('react').createElement('secondary-button', props) }));
jest.mock('react-native', () => {
  const ReactModule = require('react');
  return {
    NativeModules: {}, Platform: { OS: 'ios', select: (values: any) => values.ios ?? values.default },
    TurboModuleRegistry: { get: () => null },
    Alert: { alert: (_title: string, _message: string, buttons: any[]) => { mockAlertButtons = buttons; } },
    StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
    View: ({ children, ...props }: any) => ReactModule.createElement('view', props, children),
    Text: ({ children, ...props }: any) => ReactModule.createElement('text', props, children),
  };
});

import TimeOffDetailScreen from '../../app/time-off-detail';

function textOf(tree: any) {
  return tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
}

describe('TimeOffDetailScreen', () => {
  beforeEach(() => {
    mockLoadDetail.mockClear().mockResolvedValue({ ok: true });
    mockCancel.mockClear().mockResolvedValue({ ok: true });
    mockAlertButtons = [];
    mockStatus = 'pending';
  });

  it('renders cached request details and confirms a pending cancellation', async () => {
    let tree: any;
    await act(async () => { tree = create(<TimeOffDetailScreen />); });
    expect(textOf(tree)).toContain('Vacation');
    expect(textOf(tree)).toContain('Family trip');
    expect(mockLoadDetail).toHaveBeenCalledWith('request-1');
    await act(async () => tree.root.findByType('secondary-button').props.onPress());
    expect(mockAlertButtons.map((button) => button.text)).toEqual(['Keep Request', 'Cancel Request']);
    await act(async () => { await mockAlertButtons[1].onPress(); });
    expect(mockCancel).toHaveBeenCalledWith('request-1');
    expect(tree.root.findByType('banner').props.message).toBe('Time-off request cancelled.');
  });

  it('hides cancellation for non-pending requests', async () => {
    mockStatus = 'approved';
    let tree: any;
    await act(async () => { tree = create(<TimeOffDetailScreen />); });
    expect(tree.root.findAllByType('secondary-button')).toHaveLength(0);
    expect(tree.root.findByType('badge').props.label).toBe('Approved');
  });

  it('shows authoritative status-change reconciliation after a stale cancel', async () => {
    mockCancel.mockResolvedValue({ ok: false, statusChanged: true, error: 'This request changed and is now approved.' });
    let tree: any;
    await act(async () => { tree = create(<TimeOffDetailScreen />); });
    await act(async () => tree.root.findByType('secondary-button').props.onPress());
    await act(async () => { await mockAlertButtons[1].onPress(); });
    expect(tree.root.findByType('banner').props.message).toBe('This request changed and is now approved.');
  });
});
