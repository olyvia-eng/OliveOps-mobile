import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockLoadTraining = jest.fn();
const mockLoadHistory = jest.fn();
const mockPush = jest.fn();
let mockTrainingState: any;

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('@/hooks/useTrainingActions', () => ({
  useTrainingActions: () => ({ refreshAssignments: mockLoadTraining, refreshHistory: mockLoadHistory }),
}));
jest.mock('@/store/trainingStore', () => ({ useTrainingStore: () => mockTrainingState }));
jest.mock('@/components/Screen', () => ({
  Screen: ({ children }: any) => require('react').createElement('screen', {}, children),
  PrimaryScreen: ({ children, testID }: any) => require('react').createElement('primary-screen', {
    edges: ['top', 'left', 'right'], testID,
  }, children),
}));
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
    mockLoadTraining.mockReset().mockResolvedValue({ ok: true });
    mockLoadHistory.mockReset().mockResolvedValue({ ok: true });
    mockTrainingState = {
      overdueCount: 0,
      dueSoonCount: 1,
      loadedAt: 1,
      loading: false,
      error: null,
      assignments: [{
        id: 'assignment-1', assignmentId: 'assignment-1', trainingTitle: 'WHMIS',
        currentDueDate: '2026-09-10', presentationStatus: 'due_soon',
      }],
      completions: [{
        id: 'completion-1', completionId: 'completion-1', trainingTitle: 'Site Orientation',
        completedAt: '2026-09-01T14:00:00.000Z', completedVersion: 3,
      }],
    };
  });

  it('shows attention work and opens the exact assignment', async () => {
    let tree: any;
    await act(async () => { tree = create(<EmployeeHubScreen />); });
    expect(textOf(tree)).toContain('1 assignment need attention.');
    expect(textOf(tree)).toContain('WHMIS');
    expect(tree.root.findByType('primary-screen').props.edges).toEqual(['top', 'left', 'right']);
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