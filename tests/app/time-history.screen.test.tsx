import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockClockingState = {
  timeEntries: [] as any[],
  jobs: [{ id: 'job-1', title: 'Front Walkway', status: 'scheduled', assignedEmployeeIds: ['emp-1'] }],
};

const mockUseClockingStore = jest.fn(() => mockClockingState);

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
    const now = new Date();
    const activeClockIn = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    const completedClockIn = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const completedClockOut = new Date(now.getTime() - 40 * 60 * 1000).toISOString();

    mockClockingState.timeEntries = [
      {
        id: 'entry-active',
        employeeId: 'emp-1',
        jobId: 'job-1',
        workType: 'job',
        clockIn: activeClockIn,
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

  it('shows active badge, resolved job names, and no raw job IDs', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(TimeHistoryScreen));
    });

    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children));
    expect(renderedText).toContain('Front Walkway');
    expect(renderedText).toContain('Active');
    expect(renderedText).not.toContain('job-1');
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
