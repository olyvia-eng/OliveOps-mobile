import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useLocalSearchParams: () => ({ timeEntryId: 'entry-1' }),
}));

jest.mock('@/store/clockingStore', () => ({
  useClockingStore: () => ({
    businessTimeZone: 'America/Toronto',
    jobs: [{ id: 'job-1', title: 'Interlock Patio', status: 'scheduled', assignedEmployeeIds: ['emp-1'] }],
    timeCorrections: [],
  }),
}));

jest.mock('@/hooks/useEffectiveClockState', () => ({
  useEffectiveClockState: () => ({
    effectiveActiveEntryId: null,
    timeEntries: [{
      id: 'entry-1', employeeId: 'emp-1', jobId: 'job-1', workType: 'job',
      workAreaNameSnapshot: 'Interlock Installation', clockIn: '2026-09-02T12:00:00.000Z',
      clockOut: '2026-09-02T15:00:00.000Z', breakMinutes: 0, notes: '', status: 'clocked_out',
    }],
  }),
}));

jest.mock('@/components/Screen', () => ({
  Screen: ({ children }: any) => require('react').createElement('screen', {}, children),
}));

jest.mock('@/components/PrimaryActionButton', () => ({
  PrimaryActionButton: ({ label, onPress }: any) => require('react').createElement('primary-button', { label, onPress }),
}));

jest.mock('react-native', () => ({
  NativeModules: {},
  Platform: { select: (values: any) => values.ios ?? values.default },
  StyleSheet: { create: (value: unknown) => value },
  TurboModuleRegistry: { get: () => null },
  View: ({ children }: any) => require('react').createElement('view', {}, children),
  Text: ({ children }: any) => require('react').createElement('text', {}, children),
}));

import TimeEntryDetailScreen from '../../app/time-entry-detail';

describe('TimeEntryDetailScreen', () => {
  beforeEach(() => mockPush.mockReset());

  it('shows entry context and opens Request Correction for that entry', async () => {
    let tree: any;
    await act(async () => { tree = create(<TimeEntryDetailScreen />); });
    const text = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(text).toContain('Interlock Patio');
    expect(text).toContain('Interlock Installation');

    await act(async () => tree.root.findByProps({ label: 'Request Correction' }).props.onPress());
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/request-time-correction',
      params: { timeEntryId: 'entry-1', requestType: 'wrong_time' },
    });
  });
});