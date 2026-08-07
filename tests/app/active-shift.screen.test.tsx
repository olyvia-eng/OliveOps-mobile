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
  timeEntries: [] as any[],
  jobs: [{ id: 'job-1', title: 'Front Walkway', status: 'scheduled', assignedEmployeeIds: ['emp-1'] }],
};

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
    StyleSheet: { create: (value: unknown) => value },
    View: ({ children }: any) => React.createElement('view', {}, children),
    Text: ({ children }: any) => React.createElement('text', {}, children),
  };
});

import ActiveShiftScreen from '../../app/active-shift';

describe('ActiveShiftScreen', () => {
  beforeEach(() => {
    mockClockingState.timeEntries = [];
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

    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(renderedText).toContain('Front Walkway');
    expect(renderedText).toContain('Activity:');
    expect(renderedText).toContain('Job Work');
    expect(renderedText).not.toContain('job-1');

    const labels = tree.root.findAllByType('primary-button').map((node: any) => node.props.label);
    expect(labels).toContain('Clock Out');
    expect(labels).toContain('Switch Activity');
    expect(labels).not.toContain('Clock In');
  });
});
