import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

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
  currentActiveEntryId: null as string | null,
  activeShiftWarnings: {
    possibleForgottenClockOut: false,
    thresholdHours: 12,
  },
  timeCorrections: [],
  timeEntries: [] as any[],
  jobs: [
    { id: 'job-1', title: 'Front Walkway', status: 'scheduled', assignedEmployeeIds: ['emp-1'] },
    { id: 'job-2', title: 'Warehouse', status: 'scheduled', assignedEmployeeIds: ['emp-1'] },
  ],
};

const mockUseClockingStore = jest.fn(() => mockClockingState);
let mockOfflineClock: any;

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock('@/store/offlineClockContext', () => ({
  useOptionalOfflineClockStore: () => mockOfflineClock,
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

import ActiveShiftScreen from '../../app/active-shift';

describe('ActiveShiftScreen', () => {
  beforeEach(() => {
    mockClockingState.currentActiveEntryId = null;
    mockClockingState.activeShiftWarnings.possibleForgottenClockOut = false;
    mockClockingState.timeEntries = [];
    mockOfflineClock = undefined;
  });

  it('does not resurrect the server entry after a hydrated offline clock-out', async () => {
    mockClockingState.currentActiveEntryId = 'entry-1';
    mockClockingState.timeEntries = [{
      id: 'entry-1', employeeId: 'emp-1', jobId: 'job-1', workType: 'job',
      clockIn: '2026-08-07T10:00:00.000Z', breakMinutes: 0, notes: '', status: 'clocked_in',
    }];
    mockOfflineClock = {
      hydrated: true,
      cache: null,
      effectiveState: {
        activeEntry: null,
        effectiveActiveEntryId: null,
        effectiveStatus: 'clocked_out_pending',
      },
      effectiveTimeEntries: [{ ...mockClockingState.timeEntries[0], status: 'clocked_out' }],
    };

    let tree: any;
    await act(async () => {
      tree = create(<ActiveShiftScreen />);
    });

    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(renderedText).not.toContain('Front Walkway');
    expect(require('expo-router').router.replace).toHaveBeenCalledWith('/home');
  });

  it('shows no-active-shift state with Clock In CTA', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ActiveShiftScreen));
    });

    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children));
    expect(renderedText).toContain('No active shift');

    const labels = tree.root.findAllByType('primary-button').map((node: any) => node.props.label);
    expect(labels).toContain('Clock In');
    expect(labels).not.toContain('Clock Out');
  });

  it('shows active shift with resolved job name and Clock Out CTA', async () => {
    mockClockingState.currentActiveEntryId = 'entry-1';
    mockClockingState.timeEntries = [
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
    ];

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ActiveShiftScreen));
    });

    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(renderedText).toContain('Front Walkway');
  expect(renderedText).not.toContain('Warehouse');
    expect(renderedText).toContain('Current Activity');
    expect(renderedText).toContain('Job Work');
    expect(renderedText).not.toContain('job-1');

    const labels = tree.root.findAllByType('primary-button').map((node: any) => node.props.label);
    expect(labels).toContain('Clock Out');
    expect(renderedText).toContain('Switch Activity');
    expect(labels).not.toContain('Clock In');
  });

  it('shows long-shift warning actions when backend warning flag is true', async () => {
    mockClockingState.currentActiveEntryId = 'entry-1';
    mockClockingState.activeShiftWarnings.possibleForgottenClockOut = true;
    mockClockingState.timeEntries = [
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
    ];

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ActiveShiftScreen));
    });

    const labels = tree.root.findAllByType('primary-button').map((node: any) => node.props.label);
    expect(labels).toContain('Clock Out Now');
    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(renderedText).toContain('Clock Out & Request Correction');
  });

  it('shows unbillable category name for active unbillable shift', async () => {
    mockClockingState.currentActiveEntryId = 'entry-3';
    mockClockingState.timeEntries = [
      {
        id: 'entry-3',
        employeeId: 'emp-1',
        workType: 'non_billable',
        unbillableCategoryId: 'cat-maintenance',
        unbillableCategoryName: 'Equipment Maintenance',
        clockIn: '2026-08-07T10:00:00.000Z',
        breakMinutes: 0,
        notes: '',
        status: 'clocked_in',
      },
    ];

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ActiveShiftScreen));
    });

    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(renderedText).toContain('Unbillable');
    expect(renderedText).toContain('Equipment Maintenance');
    expect(renderedText).not.toContain('cat-maintenance');
  });
});
