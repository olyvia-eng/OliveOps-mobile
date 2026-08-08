import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSwitchActivity = jest.fn();
const mockRefresh = jest.fn().mockResolvedValue({ ok: true });
const mockLoadUnbillableCategoriesIfNeeded = jest.fn().mockResolvedValue(undefined);

const mockUseClockingActions = jest.fn(() => ({
  switchActivity: mockSwitchActivity,
  loading: false,
  refreshWorkContext: mockRefresh,
}));

const mockUseUnbillableCategories = jest.fn(() => ({
  categories: [
    {
      id: 'cat-training',
      name: 'Training',
      description: '',
      sortOrder: 0,
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  loading: false,
  error: null,
  hasLoaded: true,
  loadIfNeeded: mockLoadUnbillableCategoriesIfNeeded,
  retry: jest.fn(),
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
}));

const mockUseClockingStore = jest.fn(() => ({
  currentActiveEntryId: 'entry-1',
  jobs: [
    { id: 'job-1', title: 'Site A', status: 'scheduled', assignedEmployeeIds: ['emp-1'] },
    { id: 'job-2', title: 'Warehouse', status: 'scheduled', assignedEmployeeIds: ['emp-1'] },
  ],
  timeEntries: [
    {
      id: 'entry-2',
      employeeId: 'emp-1',
      workType: 'job',
      jobIds: ['job-2'],
      clockIn: '2026-08-07T10:10:00.000Z',
      breakMinutes: 0,
      notes: '',
      status: 'clocked_in',
    },
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

jest.mock('@/hooks/useUnbillableCategories', () => ({
  useUnbillableCategories: () => mockUseUnbillableCategories(),
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
    mockLoadUnbillableCategoriesIfNeeded.mockClear();
    mockUseUnbillableCategories.mockReset();
    mockUseUnbillableCategories.mockReturnValue({
      categories: [
        {
          id: 'cat-training',
          name: 'Training',
          description: '',
          sortOrder: 0,
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      loading: false,
      error: null,
      hasLoaded: true,
      loadIfNeeded: mockLoadUnbillableCategoriesIfNeeded,
      retry: jest.fn(),
    });
    mockSwitchActivity.mockResolvedValue({ ok: true });
  });

  it('loads categories from shared source for unbillable switch', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(SwitchActivityScreen));
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'switch-activity-option-non_billable' })[0].props.onPress();
    });

    expect(mockLoadUnbillableCategoriesIfNeeded).toHaveBeenCalled();
    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(renderedText).toContain('Training');
  });

  it('requires unbillable category before enabling switch submission', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(SwitchActivityScreen));
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'switch-activity-option-non_billable' })[0].props.onPress();
    });

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Switch Activity');
    expect(submitButton?.props.disabled).toBe(true);
  });

  it('submits unbillable switch with selected category ID and no jobIds', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(SwitchActivityScreen));
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'switch-activity-option-non_billable' })[0].props.onPress();
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'unbillable-category-option-cat-training' })[0].props.onPress();
    });

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Switch Activity');
    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(mockSwitchActivity).toHaveBeenCalledWith('non_billable', [], 'cat-training', { requestId: 'req-switch-1', idempotencyKey: 'key-switch-1' });
    expect(router.replace).toHaveBeenCalledWith('/active-shift');
  });

  it('offers Drive Time without capability data and submits its canonical work type', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(SwitchActivityScreen));
    });

    const driveOption = tree.root.findAllByProps({ testID: 'switch-activity-option-drive_time' });
    expect(driveOption.length).toBeGreaterThan(0);

    await act(async () => {
      driveOption[0].props.onPress();
    });

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Switch Activity');
    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(mockSwitchActivity).toHaveBeenCalledWith('drive_time', [], undefined, { requestId: 'req-switch-1', idempotencyKey: 'key-switch-1' });
    expect(router.replace).toHaveBeenCalledWith('/active-shift');
  });
});
