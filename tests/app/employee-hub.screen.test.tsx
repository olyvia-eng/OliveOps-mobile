import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockLoadTraining = jest.fn();
const mockLoadHistory = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('@/api/trainingApi', () => ({
  loadMyTraining: (...args: unknown[]) => mockLoadTraining(...args),
  loadMyTrainingHistory: (...args: unknown[]) => mockLoadHistory(...args),
}));
jest.mock('@/store/authStore', () => ({ useAuthStore: () => ({ accessToken: 'token-1' }) }));
jest.mock('@/components/Screen', () => ({ Screen: ({ children }: any) => require('react').createElement('screen', {}, children) }));
jest.mock('react-native', () => {
  const ReactModule = require('react');
  return {
    NativeModules: {}, Platform: { select: (values: any) => values.ios ?? values.default }, TurboModuleRegistry: { get: () => null },
    ActivityIndicator: (props: any) => ReactModule.createElement('activity-indicator', props),
    StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
    View: ({ children, ...props }: any) => ReactModule.createElement('view', props, children),
    Text: ({ children, ...props }: any) => ReactModule.createElement('text', props, children),
    Pressable: ({ children, onPress, style, ...props }: any) => ReactModule.createElement('pressable', { onPress, style: typeof style === 'function' ? style({ pressed: false }) : style, ...props }, typeof children === 'function' ? children({ pressed: false }) : children),
  };
});

import EmployeeHubScreen from '../../app/employee-hub';

function textOf(tree: any) {
  return tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
}

describe('EmployeeHubScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockLoadTraining.mockReset().mockResolvedValue({
      ok: true,
      attentionCount: 1,
      assignments: [{
        id: 'assignment-1', assignmentId: 'assignment-1', trainingTitle: 'WHMIS',
        currentDueDate: '2026-09-10', presentationStatus: 'due_soon',
      }],
    });
    mockLoadHistory.mockReset().mockResolvedValue({
      ok: true,
      completions: [{
        id: 'completion-1', completionId: 'completion-1', trainingTitle: 'Site Orientation',
        completedAt: '2026-09-01T14:00:00.000Z', completedVersion: 3,
      }],
    });
  });

  it('shows attention work and opens the exact assignment', async () => {
    let tree: any;
    await act(async () => { tree = create(<EmployeeHubScreen />); });
    expect(textOf(tree)).toContain('1 assignment need attention.');
    expect(textOf(tree)).toContain('WHMIS');
    await act(async () => tree.root.findByProps({ testID: 'training-row-assignment-1' }).props.onPress());
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/training-detail', params: { assignmentId: 'assignment-1' } });
  });

  it('shows immutable completion history separately from assignments', async () => {
    let tree: any;
    await act(async () => { tree = create(<EmployeeHubScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'employee-hub-tab-history' }).props.onPress());
    expect(textOf(tree)).toContain('Site Orientation');
    expect(textOf(tree)).toContain('Version 3');
    expect(tree.root.findByProps({ testID: 'training-completion-completion-1' })).toBeTruthy();
  });
});