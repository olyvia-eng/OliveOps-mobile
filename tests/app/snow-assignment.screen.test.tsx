import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockLoadAssignment = jest.fn();
const mockLoadServiceTypes = jest.fn();
const mockLoadOutbox = jest.fn();
const mockQueueCommand = jest.fn();
const mockReplayOutbox = jest.fn();
let mockCompanyFeatures: { projects: boolean; recurringServices: boolean; snowOperations: boolean } | null = {
  projects: true, recurringServices: true, snowOperations: true,
};

jest.mock('@/api/snowOperationsApi', () => ({
  loadMyActiveSnowRoute: (...args: unknown[]) => mockLoadAssignment(...args),
  loadSnowServiceTypes: (...args: unknown[]) => mockLoadServiceTypes(...args),
}));
jest.mock('@/services/snowOperationsOutbox', () => ({
  loadSnowOutbox: (...args: unknown[]) => mockLoadOutbox(...args),
  queueSnowCommand: (...args: unknown[]) => mockQueueCommand(...args),
  queueSnowPhoto: jest.fn(),
  replaySnowOutbox: (...args: unknown[]) => mockReplayOutbox(...args),
  snowSubmissionId: (action: string) => `${action}:device-1`,
}));
jest.mock('@/services/snowLocation', () => ({
  captureSnowPosition: jest.fn(async () => ({ gpsUnavailableReason: 'permission_denied', deviceCapturedAt: '2026-09-08T00:00:00.000Z' })),
}));
jest.mock('@/services/photoPicker', () => ({ pickSinglePhoto: jest.fn() }));
jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    accessToken: 'token-1',
    user: { id: 'user-1', businessId: 'business-1', employeeId: 'employee-1' },
  }),
}));
jest.mock('@/store/clockingStore', () => ({
  useClockingStore: () => ({
    companyFeatures: mockCompanyFeatures,
  }),
}));
jest.mock('@/components/Screen', () => ({
  PrimaryScreen: ({ children }: any) => require('react').createElement('screen', {}, children),
}));
jest.mock('@/components/PrimaryActionButton', () => ({
  PrimaryActionButton: ({ label, onPress, disabled }: any) => require('react').createElement('primary-button', {
    accessibilityLabel: label, label, onPress, disabled,
  }),
}));
jest.mock('@/components/SecondaryButton', () => ({
  SecondaryButton: ({ label, onPress }: any) => require('react').createElement('secondary-button', { label, onPress }),
}));
jest.mock('@/components/StatusBanner', () => ({
  StatusBanner: ({ message }: any) => require('react').createElement('status-banner', { message }),
}));
jest.mock('@/components/MobilePrimitives', () => {
  const React = require('react');
  const component = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
  return {
    EmptyState: component('empty-state'), InfoRow: component('info-row'), ListRow: component('list-row'),
    ScreenHeader: component('screen-header'), SectionCard: component('section-card'), SectionHeader: component('section-header'),
    StatusBadge: component('status-badge'),
  };
});
jest.mock('react-native', () => {
  const React = require('react');
  return {
    Alert: { alert: jest.fn() },
    Linking: { canOpenURL: jest.fn(async () => true), openURL: jest.fn() },
    NativeModules: {},
    Platform: { OS: 'ios' },
    Pressable: ({ children, onPress, ...props }: any) => React.createElement('pressable', { ...props, onPress }, children),
    StyleSheet: { create: (value: unknown) => value },
    Text: ({ children, ...props }: any) => React.createElement('text', props, children),
    TurboModuleRegistry: { get: () => null },
    View: ({ children, ...props }: any) => React.createElement('view', props, children),
  };
});

import SnowAssignmentScreen from '../../app/snow-assignment';

describe('SnowAssignmentScreen', () => {
  let tree: any;

  beforeEach(() => {
    mockCompanyFeatures = { projects: true, recurringServices: true, snowOperations: true };
    mockLoadAssignment.mockReset().mockResolvedValue({
      ok: true,
      event: { id: 'event-1', title: 'January Storm', status: 'active' },
      route: { id: 'route-1', name: 'North Route', status: 'not_started' },
      stops: [{ id: 'stop-1', sortOrder: 0, status: 'pending', occurrences: [] }],
      progress: { total: 1, completed: 0, needsAttention: 0, currentStopId: 'stop-1' },
    });
    mockLoadServiceTypes.mockReset().mockResolvedValue({ ok: true, serviceTypes: [] });
    mockLoadOutbox.mockReset().mockResolvedValue([]);
    mockQueueCommand.mockReset().mockResolvedValue({});
    mockReplayOutbox.mockReset().mockResolvedValue([]);
  });

  it('queues Start Route with immutable route context and a stable submission ID', async () => {
    await act(async () => { tree = create(<SnowAssignmentScreen />); });

    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Start Route' }).props.onPress());

    expect(mockQueueCommand).toHaveBeenCalledWith({
      identityKey: 'business-1:user-1:employee-1',
      action: 'start-route',
      context: { eventId: 'event-1', routeId: 'route-1', stopId: 'stop-1' },
      payload: { clientSubmissionId: 'start-route:device-1' },
    });
    expect(mockReplayOutbox).toHaveBeenCalledWith('business-1:user-1:employee-1', 'token-1');
  });

  it('does not load or expose Snow workflow when Snow Operations is disabled', async () => {
    mockCompanyFeatures = { projects: true, recurringServices: true, snowOperations: false };

    await act(async () => { tree = create(<SnowAssignmentScreen />); });

    expect(tree.root.findByType('empty-state').props.title).toBe('Snow Operations unavailable');
    expect(mockLoadAssignment).not.toHaveBeenCalled();
    expect(mockLoadServiceTypes).not.toHaveBeenCalled();
    expect(tree.root.findAllByType('primary-button')).toHaveLength(0);
  });

  it('keeps Snow Operations off while feature state is unhydrated', async () => {
    mockCompanyFeatures = null;

    await act(async () => { tree = create(<SnowAssignmentScreen />); });

    expect(tree.root.findByType('empty-state').props.title).toBe('Snow Operations unavailable');
    expect(mockLoadAssignment).not.toHaveBeenCalled();
  });
});
