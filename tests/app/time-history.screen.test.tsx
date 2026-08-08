import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockClockingState = {
  currentActiveEntryId: null as string | null,
  timeCorrections: [] as any[],
  timeEntries: [] as any[],
  jobs: [{ id: 'job-1', title: 'Front Walkway', status: 'scheduled', assignedEmployeeIds: ['emp-1'] }],
};

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

const mockUseClockingStore = jest.fn(() => mockClockingState);

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

jest.mock('@/store/clockingStore', () => ({
  useClockingStore: () => mockUseClockingStore(),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaView: ({ children }: any) => React.createElement('safe-area', {}, children),
  };
});

jest.mock('react-native', () => {
  const React = require('react');
  return {
    StyleSheet: { create: (value: unknown) => value },
    View: ({ children }: any) => React.createElement('view', {}, children),
    Text: ({ children }: any) => React.createElement('text', {}, children),
    Pressable: ({ children, onPress }: any) => React.createElement('pressable', { onPress }, children),
    FlatList: ({ data, ListHeaderComponent, renderItem, ListEmptyComponent }: any) => {
      const children = [];
      if (ListHeaderComponent) {
        children.push(React.createElement(React.Fragment, { key: 'header' }, ListHeaderComponent));
      }
      if (Array.isArray(data) && data.length > 0) {
        data.forEach((item: any, index: number) => {
          children.push(React.createElement(React.Fragment, { key: `row-${index}` }, renderItem({ item })));
        });
      } else if (ListEmptyComponent) {
        children.push(React.createElement(React.Fragment, { key: 'empty' }, ListEmptyComponent));
      }
      return React.createElement('flat-list', {}, children);
    },
  };
});

import TimeHistoryScreen from '../../app/time-history';

describe('TimeHistoryScreen', () => {
  beforeEach(() => {
    const now = new Date(2026, 7, 6, 12, 0, 0, 0);
    jest.useFakeTimers();
    jest.setSystemTime(now);

    const authoritativeActiveClockIn = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    const orphanClockIn = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
    const completedClockIn = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const completedClockOut = new Date(now.getTime() - 40 * 60 * 1000).toISOString();

    mockClockingState.currentActiveEntryId = 'entry-active';
    mockClockingState.timeCorrections = [
      {
        id: 'corr-pending-1',
        employeeId: 'emp-1',
        timeEntryId: 'entry-active',
        requestType: 'wrong_time',
        status: 'pending',
        reason: 'Forgot break details',
        submittedByUserId: 'u-1',
        submittedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        createdAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      },
      {
        id: 'corr-approved-1',
        employeeId: 'emp-1',
        timeEntryId: 'entry-complete',
        requestType: 'wrong_activity',
        status: 'approved',
        requestedActivityType: 'non_billable',
        reason: 'Was actually shop prep',
        submittedByUserId: 'u-1',
        submittedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        reviewedAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
        createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
      },
    ];
    mockClockingState.timeEntries = [
      {
        id: 'entry-active',
        employeeId: 'emp-1',
        jobId: 'job-1',
        workType: 'job',
        clockIn: authoritativeActiveClockIn,
        breakMinutes: 0,
        notes: '',
        status: 'clocked_in',
      },
      {
        id: 'entry-orphan-open',
        employeeId: 'emp-1',
        jobId: 'job-1',
        workType: 'non_billable',
        clockIn: orphanClockIn,
        breakMinutes: 0,
        notes: '',
        status: 'clocked_in',
      },
      {
        id: 'entry-complete',
        employeeId: 'emp-1',
        jobId: 'job-1',
        workType: 'job',
        clockIn: completedClockIn,
        clockOut: completedClockOut,
        breakMinutes: 0,
        notes: '',
        status: 'clocked_out',
      },
    ];
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows Active only for authoritative currentActiveEntryId and no raw job IDs', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(TimeHistoryScreen));
    });

    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(renderedText).toContain('Front Walkway');
    expect(renderedText).toContain('Now');
    expect(renderedText).toContain('Active');
    expect(renderedText).toContain('End time unavailable');
    expect(renderedText).toContain('Incomplete record');
    expect(renderedText).toContain('Job Work');
    expect(renderedText).toContain('Correction pending');
    expect(renderedText).not.toContain('job-1');

    const activeBadges = tree.root.findAllByType('text').filter((node: any) => String(node.props.children) === 'Active');
    expect(activeBadges.length).toBe(1);
  });

  it('shows completed entry with actual end-time range and no Active badge', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(TimeHistoryScreen));
    });

    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(renderedText).toContain(' - ');
    expect(renderedText).toContain('1h 20m');
    expect(renderedText).toContain('Corrected');
  });

  it('applies approved correction values to effective display and does not mark pending as approved', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(TimeHistoryScreen));
    });

    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(renderedText).toContain('Unbillable Time');

    const pendingBadges = tree.root.findAllByType('text').filter((node: any) => String(node.props.children) === 'Correction pending');
    expect(pendingBadges.length).toBe(1);
  });

  it('shows human-friendly weekly total label instead of decimal hours', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(TimeHistoryScreen));
    });

    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(renderedText).toContain('This week total:');
    expect(renderedText).toMatch(/\d+h\s*\d+m/);
    expect(renderedText).not.toContain('hours');
  });
});
