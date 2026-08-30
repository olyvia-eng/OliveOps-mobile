import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockRefreshForms = jest.fn().mockResolvedValue({ ok: true });
const mockSetFlashMessage = jest.fn();
const mockPush = jest.fn();

const mockFormsState = {
  toDo: [{
    id: 'form-daily',
    name: 'Daily Job Report',
    category: 'Operations',
    description: 'Report work',
    trigger: 'daily',
    required: true,
    periodKey: '2026-08-18',
    context: { jobId: 'job-1', jobName: 'Smith Residence', divisionName: 'Residential' },
    fields: [],
    submissionState: { completed: false },
  }],
  available: [{
    id: 'form-incident',
    name: 'Incident Report',
    category: 'Safety',
    trigger: 'on_demand',
    required: false,
    context: { equipmentId: 'eq-1', equipmentName: 'Bobcat E50' },
    fields: [],
    submissionState: { completed: false },
  }],
  completed: [{
    submissionId: 'sub-1',
    formId: 'form-daily',
    formName: 'Daily Job Report',
    submittedAt: '2026-08-18T11:04:00.000Z',
    status: 'submitted',
    trigger: 'daily',
    context: { jobId: 'job-1', jobName: 'Smith Residence' },
  }],
  loadedAt: 1,
  flashMessage: null,
  setFlashMessage: mockSetFlashMessage,
};

jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('@/store/clockingStore', () => ({ useClockingStore: () => ({ businessTimeZone: 'America/Toronto' }) }));
jest.mock('@/store/formsStore', () => ({ useFormsStore: () => mockFormsState }));
jest.mock('@/hooks/useFormsActions', () => ({
  useFormsActions: () => ({ refreshForms: mockRefreshForms, loadingWorkspace: false }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => require('react').createElement('safe-area', {}, children),
}));
jest.mock('react-native', () => {
  const ReactModule = require('react');
  return {
    NativeModules: {},
    Platform: { select: (values: any) => values.ios ?? values.default },
    StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
    TurboModuleRegistry: { get: () => null },
    View: ({ children, ...props }: any) => ReactModule.createElement('view', props, children),
    Text: ({ children, ...props }: any) => ReactModule.createElement('text', props, children),
    Pressable: ({ children, onPress, ...props }: any) => ReactModule.createElement('pressable', { onPress, ...props }, typeof children === 'function' ? children({ pressed: false }) : children),
    FlatList: ({ data, ListHeaderComponent, ListEmptyComponent, renderItem, onRefresh, refreshing }: any) => ReactModule.createElement(
      'flat-list',
      { onRefresh, refreshing },
      ListHeaderComponent,
      data.length ? data.map((item: any, index: number) => ReactModule.createElement(ReactModule.Fragment, { key: index }, renderItem({ item }))) : ListEmptyComponent,
    ),
  };
});

import FormsScreen from '../../app/forms';

function textOf(tree: any) {
  return tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
}

describe('FormsScreen', () => {
  beforeEach(() => {
    mockRefreshForms.mockClear().mockResolvedValue({ ok: true });
    mockPush.mockClear();
    mockFormsState.toDo = [mockFormsState.toDo[0]].filter(Boolean) as any;
    mockFormsState.available = [mockFormsState.available[0]].filter(Boolean) as any;
    mockFormsState.completed = [mockFormsState.completed[0]].filter(Boolean) as any;
  });

  it('renders To Do by default with backend job and division context', async () => {
    let tree: any;
    await act(async () => { tree = create(React.createElement(FormsScreen)); });
    expect(textOf(tree)).toContain('Daily Job Report');
    expect(textOf(tree)).toContain('Smith Residence');
    expect(textOf(tree)).toContain('Residential');
    expect(textOf(tree)).toContain('Operations');
    expect(textOf(tree)).toContain('Due today');
    expect(mockRefreshForms).toHaveBeenCalledTimes(1);
  });

  it('renders Available and Completed and opens completed details read-only', async () => {
    let tree: any;
    await act(async () => { tree = create(React.createElement(FormsScreen)); });
    await act(async () => tree.root.findByProps({ testID: 'forms-tab-available' }).props.onPress());
    expect(textOf(tree)).toContain('Incident Report');
    expect(textOf(tree)).toContain('Bobcat E50');
    expect(textOf(tree)).toContain('Safety');
    expect(textOf(tree)).toContain('Available anytime');
    expect(textOf(tree)).not.toContain('Required');

    await act(async () => tree.root.findByProps({ testID: 'forms-tab-completed' }).props.onPress());
    expect(textOf(tree)).toContain('Submitted');
    await act(async () => tree.root.findByProps({ testID: 'submission-row-sub-1' }).props.onPress());
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/form-submission', params: { id: 'sub-1' } });
  });

  it('renders pending review as a successful completed submission status', async () => {
    mockFormsState.completed = [{ ...mockFormsState.completed[0], status: 'pending_review' }] as any;
    let tree: any;
    await act(async () => { tree = create(<FormsScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'forms-tab-completed' }).props.onPress());

    expect(textOf(tree)).toContain('Pending review');
    expect(tree.root.findByProps({ testID: 'submission-row-sub-1' })).toBeTruthy();
  });

  it('opens an exact backend form instance with its context', async () => {
    let tree: any;
    await act(async () => { tree = create(React.createElement(FormsScreen)); });
    await act(async () => tree.root.findByProps({ testID: 'form-row-form-daily' }).props.onPress());
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/form',
      params: expect.objectContaining({ formId: 'form-daily', trigger: 'daily', jobId: 'job-1' }),
    }));
  });

  it('supports pull-to-refresh and empty tab states', async () => {
    mockFormsState.toDo = [] as any;
    mockFormsState.available = [] as any;
    mockFormsState.completed = [] as any;
    let tree: any;
    await act(async () => { tree = create(React.createElement(FormsScreen)); });
    expect(textOf(tree)).toContain("You're all caught up");
    expect(textOf(tree)).toContain('No forms require your attention.');
    await act(async () => tree.root.findByProps({ testID: 'forms-tab-available' }).props.onPress());
    expect(textOf(tree)).toContain('No additional forms available');
    await act(async () => tree.root.findByProps({ testID: 'forms-tab-completed' }).props.onPress());
    expect(textOf(tree)).toContain('No completed forms yet');
    await act(async () => tree.root.findByType('flat-list').props.onRefresh());
    expect(mockRefreshForms).toHaveBeenLastCalledWith({ force: true });
  });

  it('keeps separate server requirements for the same Form and labels each reason', async () => {
    mockFormsState.toDo = [
      {
        id: 'form-daily', name: 'Post Shift Report', category: 'Operations', trigger: 'daily',
        required: true, periodKey: '2026-08-18', context: {}, fields: [], submissionState: { completed: false },
      },
      {
        id: 'form-daily', name: 'Post Shift Report', category: 'Operations', trigger: 'after_clock_out',
        required: true, context: {}, fields: [], submissionState: { completed: false },
      },
    ] as any;
    let tree: any;
    await act(async () => { tree = create(<FormsScreen />); });

    expect(tree.root.findAllByType('pressable').filter((node: any) => node.props.testID === 'form-row-form-daily')).toHaveLength(2);
    expect(textOf(tree)).toContain('Due today');
    expect(textOf(tree)).toContain('End-of-shift form');
  });
});