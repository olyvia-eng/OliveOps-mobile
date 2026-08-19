import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockRefresh = jest.fn().mockResolvedValue({ ok: true });
const mockRefreshForms = jest.fn().mockResolvedValue({ ok: true });

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
const mockFormsState = {
  toDo: [{ id: 'required-1' }, { id: 'required-2' }],
  available: [{ id: 'available-1' }, { id: 'available-2' }, { id: 'available-3' }],
  completed: [{ submissionId: 'completed-1' }],
};

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('@/hooks/useClockingActions', () => ({
  useClockingActions: () => mockUseClockingActions(),
}));

jest.mock('@/hooks/useFormsActions', () => ({
  useFormsActions: () => ({ refreshForms: mockRefreshForms }),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

jest.mock('@/store/clockingStore', () => ({
  useClockingStore: () => mockUseClockingStore(),
}));

jest.mock('@/store/formsStore', () => ({
  useFormsStore: () => mockFormsState,
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
    NativeModules: {},
    Platform: { select: (values: any) => values.ios ?? values.default },
    StyleSheet: { create: (value: unknown) => value },
    TurboModuleRegistry: { get: () => null },
    View: ({ children }: any) => React.createElement('view', {}, children),
    Text: ({ children }: any) => React.createElement('text', {}, children),
    Pressable: ({ children, onPress }: any) => React.createElement('pressable', { onPress }, children),
  };
});

import HomeScreen from '../../app/home';
import { router } from 'expo-router';

describe('HomeScreen', () => {
  let tree: any;

  beforeEach(() => {
    mockRefresh.mockClear();
    mockRefreshForms.mockClear();
    mockFormsState.toDo = [{ id: 'required-1' }, { id: 'required-2' }];
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

  it('opens Forms as a primary employee feature', async () => {
    await act(async () => {
      tree = create(React.createElement(HomeScreen));
    });

    const formsRow = tree.root.findAllByType('pressable').find((node: any) => {
      const text = node.findAllByType('text').map((child: any) => String(child.props.children)).join(' ');
      return text.includes('Forms');
    });
    await act(async () => formsRow.props.onPress());
    expect(router.push).toHaveBeenCalledWith('/forms');
  });

  it('shows only the outstanding To Do count for Forms', async () => {
    await act(async () => { tree = create(<HomeScreen />); });
    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(renderedText).toContain('2 due');
    expect(renderedText).not.toContain('3 due');
    expect(renderedText).not.toContain('6 due');
  });

  it('omits the due count when no required Forms are outstanding', async () => {
    mockFormsState.toDo = [];
    await act(async () => { tree = create(<HomeScreen />); });
    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(renderedText).not.toContain('due');
    expect(renderedText).toContain('Complete required and available forms');
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
