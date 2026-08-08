import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockRefresh = jest.fn().mockResolvedValue({ ok: true });

const mockUseClockingActions = jest.fn(() => ({
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
}));

const mockClockingState = {
  currentActiveEntryId: 'entry-1',
  activeShiftWarnings: {
    possibleForgottenClockOut: false,
    thresholdHours: 12,
  },
  timeCorrections: [],
  jobs: [
    { id: 'job-1', title: 'Front Walkway', status: 'scheduled', assignedEmployeeIds: ['emp-1'] },
    { id: 'job-2', title: 'Warehouse', status: 'scheduled', assignedEmployeeIds: ['emp-1'] },
  ],
  timeEntries: [
    {
      id: 'entry-2',
      employeeId: 'emp-1',
      jobId: 'job-2',
      workType: 'job',
      clockIn: '2026-08-07T10:10:00.000Z',
      breakMinutes: 0,
      notes: '',
      status: 'clocked_in',
    },
    {
      id: 'entry-1',
      employeeId: 'emp-1',
      jobId: 'job-1',
      workType: 'job',
      clockIn: '2026-08-07T10:00:00.000Z',
      breakMinutes: 0,
      notes: '',
      status: 'clocked_in',
    },
  ],
};

const mockUseClockingStore = jest.fn(() => mockClockingState);

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
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
  PrimaryActionButton: ({ label, onPress }: any) =>
    require('react').createElement('primary-button', { label, onPress }),
}));

jest.mock('react-native', () => {
  const React = require('react');
  return {
    StyleSheet: { create: (value: unknown) => value },
    View: ({ children }: any) => React.createElement('view', {}, children),
    Text: ({ children }: any) => React.createElement('text', {}, children),
    Pressable: ({ children, onPress }: any) => React.createElement('pressable', { onPress }, children),
  };
});

import HomeScreen from '../../app/home';

describe('HomeScreen', () => {
  let tree: any;

  beforeEach(() => {
    mockRefresh.mockClear();
    mockClockingState.activeShiftWarnings.possibleForgottenClockOut = false;
  });

  afterEach(async () => {
    if (!tree) return;
    await act(async () => {
      tree.unmount();
    });
    tree = undefined;
  });

  it('uses authoritative active entry id for current status card', async () => {
    await act(async () => {
      tree = create(React.createElement(HomeScreen));
    });

    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(renderedText).toContain('Front Walkway');
    expect(renderedText).not.toContain('Current job: Warehouse');
  });

  it('shows long-shift warning actions when possible forgotten clock-out is flagged', async () => {
    mockClockingState.activeShiftWarnings.possibleForgottenClockOut = true;

    await act(async () => {
      tree = create(React.createElement(HomeScreen));
    });

    const labels = tree.root.findAllByType('primary-button').map((node: any) => node.props.label);
    expect(labels).toContain('Clock Out Now');

    const banners = tree.root.findAllByType('status-banner');
    expect(banners[0].props.message).toContain('Did you forget to clock out?');

    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(renderedText).toContain('Clock Out & Request Correction');
  });
});
