import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPush = jest.fn();
let mockCommand: any;

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ commandId: 'failed-out' }),
  router: { push: (...args: unknown[]) => mockPush(...args), back: jest.fn() },
}));
jest.mock('@/store/offlineClockContext', () => ({
  useOptionalOfflineClockStore: () => ({
    commands: [mockCommand],
    cache: {
      jobs: [{ id: 'job-1', title: 'Front Walkway', status: 'scheduled' }],
      unbillableCategories: [],
    },
  }),
}));
jest.mock('@/hooks/useEffectiveClockState', () => ({
  useEffectiveClockState: () => ({
    activeEntry: {
      id: 'server-entry-b', employeeId: 'employee-1', workType: 'job', jobIds: ['job-1'],
      clockIn: '2026-08-23T13:00:00.000Z', breakMinutes: 0, notes: '', status: 'clocked_in',
    },
    currentActivity: { workType: 'job', jobIds: ['job-1'] },
  }),
}));
jest.mock('@/store/clockingStore', () => ({
  useClockingStore: () => ({
    businessTimeZone: 'America/Toronto',
    jobs: [{ id: 'job-1', title: 'Front Walkway', status: 'scheduled', assignedEmployeeIds: ['employee-1'] }],
  }),
}));
jest.mock('@/components/Screen', () => ({
  Screen: ({ children }: any) => require('react').createElement('screen', {}, children),
}));
jest.mock('@/components/PrimaryActionButton', () => ({
  PrimaryActionButton: ({ label, onPress }: any) => require('react').createElement('primary-button', { label, onPress }),
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
    View: ({ children }: any) => React.createElement('view', {}, children),
    Text: ({ children }: any) => React.createElement('text', {}, children),
  };
});

import OfflineTimeChangeScreen from '../../app/offline-time-change';

describe('OfflineTimeChangeScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockCommand = {
      schemaVersion: 1,
      id: 'failed-out',
      identityKey: 'business:user:employee',
      employeeId: 'employee-1',
      businessId: 'business',
      localShiftId: 'local-shift-1',
      type: 'clock_out',
      logicalPayload: { breakMinutes: 0, notes: '' },
      requestId: 'request-out',
      idempotencyKey: 'key-out',
      clientOccurredAt: '2026-08-23T14:04:00.000Z',
      queuedAt: '2026-08-23T14:04:00.100Z',
      status: 'needs_attention',
      retryCount: 1,
      lastErrorCategory: 'offline_shift_state_conflict',
      resolvedServerEntryId: 'server-entry-b',
    };
  });

  it('shows failed clock-out context and safe conflict reason', async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<OfflineTimeChangeScreen />);
    });

    const text = tree.root.findAllByType('text').map((node) => String(node.props.children)).join(' ');
    expect(text).toContain('Clock Out');
    expect(text).toContain('Your saved shift changed before this offline action could sync.');
    expect(text).toContain('Clocked in');
    expect(text).toContain('Front Walkway');
  });

  it('carries failed command context into Time Correction', async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<OfflineTimeChangeScreen />);
    });

    await act(async () => {
      tree.root.findByType('primary-button').props.onPress();
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/request-time-correction',
      params: expect.objectContaining({
        timeEntryId: 'server-entry-b',
        requestType: 'forgot_clock_out',
        intendedAt: '2026-08-23T14:04:00.000Z',
        offlineAction: 'clock_out',
        requestedActivity: 'job',
        requestedJobId: 'job-1',
      }),
    });
  });
});
