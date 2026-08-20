import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSwitchActivity = jest.fn();
const mockRefresh = jest.fn().mockResolvedValue({ ok: true });
const mockGetRequiredForms = jest.fn().mockResolvedValue({ ok: true, forms: [] });
const mockRefreshForms = jest.fn().mockResolvedValue({ ok: true });
const mockStartWorkflow = jest.fn(() => 'workflow-switch');
const mockClearWorkflow = jest.fn();
let mockWorkflow: any = null;
const mockLoadUnbillableCategoriesIfNeeded = jest.fn().mockResolvedValue(undefined);

const mockUseClockingActions = jest.fn(() => ({
  switchActivity: mockSwitchActivity,
  loading: false,
  refreshWorkContext: mockRefresh,
}));

const mockUseUnbillableCategories = jest.fn(() => ({
  categories: [
    {
      id: 'cat-training',
      name: 'Training',
      description: '',
      sortOrder: 0,
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  loading: false,
  error: null,
  hasLoaded: true,
  loadIfNeeded: mockLoadUnbillableCategoriesIfNeeded,
  retry: jest.fn(),
}));

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

const mockUseClockingStore = jest.fn(() => ({
  currentActiveEntryId: 'entry-1',
  jobs: [
    { id: 'job-1', title: 'Site A', status: 'scheduled', assignedEmployeeIds: ['emp-1'] },
    { id: 'job-2', title: 'Warehouse', status: 'scheduled', assignedEmployeeIds: ['emp-1'] },
  ],
  timeEntries: [
    {
      id: 'entry-2',
      employeeId: 'emp-1',
      workType: 'job',
      jobIds: ['job-2'],
      clockIn: '2026-08-07T10:10:00.000Z',
      breakMinutes: 0,
      notes: '',
      status: 'clocked_in',
    },
    {
      id: 'entry-1',
      employeeId: 'emp-1',
      workType: 'job',
      jobIds: ['job-1'],
      clockIn: '2026-08-07T10:00:00.000Z',
      breakMinutes: 0,
      notes: '',
      status: 'clocked_in',
    },
  ],
}));

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
    push: jest.fn(),
  },
}));

jest.mock('@/hooks/useClockingActions', () => ({
  useClockingActions: () => mockUseClockingActions(),
}));

jest.mock('@/hooks/useFormsActions', () => ({
  useFormsActions: () => ({ getRequiredForms: mockGetRequiredForms, refreshForms: mockRefreshForms }),
}));

jest.mock('@/hooks/useUnbillableCategories', () => ({
  useUnbillableCategories: () => mockUseUnbillableCategories(),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

jest.mock('@/store/clockingStore', () => ({
  useClockingStore: () => mockUseClockingStore(),
}));

jest.mock('@/store/formsWorkflowStore', () => ({
  useFormsWorkflowStore: () => ({
    workflow: mockWorkflow,
    startWorkflow: mockStartWorkflow,
    clearWorkflow: mockClearWorkflow,
  }),
}));

jest.mock('@/services/requestGuards', () => ({
  createRequestMeta: () => ({ requestId: 'req-switch-1', idempotencyKey: 'key-switch-1' }),
}));

jest.mock('@/components/Screen', () => ({
  Screen: ({ children }: any) => require('react').createElement('screen', {}, children),
}));

jest.mock('@/components/OfflineNotice', () => ({
  OfflineNotice: () => require('react').createElement('offline-notice', {}),
}));

jest.mock('@/components/StatusBanner', () => ({
  StatusBanner: ({ message }: any) => require('react').createElement('status-banner', { message }),
}));

jest.mock('@/components/PrimaryActionButton', () => ({
  PrimaryActionButton: ({ label, disabled, onPress }: any) =>
    require('react').createElement('primary-button', { label, disabled: !!disabled, onPress }),
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
    Pressable: ({ children, onPress, testID, accessibilityState, style }: any) =>
      React.createElement('pressable', {
        onPress,
        testID,
        accessibilityState,
        style: typeof style === 'function' ? style({ pressed: false }) : style,
      }, typeof children === 'function' ? children({ pressed: false }) : children),
  };
});

import SwitchActivityScreen from '../../app/switch-activity';
import { router } from 'expo-router';

describe('SwitchActivityScreen', () => {
  beforeEach(() => {
    (router.replace as jest.Mock).mockReset();
    mockSwitchActivity.mockReset();
    mockRefresh.mockClear();
    mockGetRequiredForms.mockReset().mockResolvedValue({ ok: true, forms: [] });
    mockRefreshForms.mockReset().mockResolvedValue({ ok: true });
    mockStartWorkflow.mockClear();
    mockClearWorkflow.mockClear();
    mockWorkflow = null;
    mockLoadUnbillableCategoriesIfNeeded.mockClear();
    mockUseUnbillableCategories.mockReset();
    mockUseUnbillableCategories.mockReturnValue({
      categories: [
        {
          id: 'cat-training',
          name: 'Training',
          description: '',
          sortOrder: 0,
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      loading: false,
      error: null,
      hasLoaded: true,
      loadIfNeeded: mockLoadUnbillableCategoriesIfNeeded,
      retry: jest.fn(),
    });
    mockSwitchActivity.mockResolvedValue({ ok: true });
  });

  it('marks the chosen job with the shared selected state', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(SwitchActivityScreen));
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'switch-activity-option-job' })[0].props.onPress();
    });
    await act(async () => {
      tree.root.findAllByProps({ testID: 'switch-job-option-job-2' })[0].props.onPress();
    });

    const selectedJob = tree.root.findAllByType('pressable').find((node: any) => node.props.testID === 'switch-job-option-job-2');
    expect(selectedJob.props.accessibilityState).toEqual({ selected: true });
    expect(selectedJob.props.style).toEqual(expect.arrayContaining([
      expect.objectContaining({ backgroundColor: '#EBF1E7', borderColor: '#56734A' }),
    ]));
  });

  it('loads categories from shared source for unbillable switch', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(SwitchActivityScreen));
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'switch-activity-option-non_billable' })[0].props.onPress();
    });

    expect(mockLoadUnbillableCategoriesIfNeeded).toHaveBeenCalled();
    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(renderedText).toContain('Training');
  });

  it('requires unbillable category before enabling switch submission', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(SwitchActivityScreen));
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'switch-activity-option-non_billable' })[0].props.onPress();
    });

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Switch Activity');
    expect(submitButton?.props.disabled).toBe(true);
  });

  it('submits unbillable switch with selected category ID and no jobIds', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(SwitchActivityScreen));
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'switch-activity-option-non_billable' })[0].props.onPress();
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'unbillable-category-option-cat-training' })[0].props.onPress();
    });

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Switch Activity');
    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(mockSwitchActivity).toHaveBeenCalledWith('non_billable', [], 'cat-training', { requestId: 'req-switch-1', idempotencyKey: 'key-switch-1' });
    expect(router.replace).toHaveBeenCalledWith('/active-shift');
  });

  it('surfaces before-starting Forms and continues the job switch non-blocking', async () => {
    mockGetRequiredForms
      .mockResolvedValueOnce({ ok: true, forms: [{ id: 'before-job', name: 'Job Start Check', trigger: 'before_starting_job', context: { jobId: 'job-2' }, fields: [] }] })
      .mockResolvedValue({ ok: true, forms: [] });
    let tree: any;
    await act(async () => { tree = create(<SwitchActivityScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'switch-activity-option-job' }).props.onPress());
    await act(async () => tree.root.findByProps({ testID: 'switch-job-option-job-2' }).props.onPress());
    await act(async () => tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Switch Activity').props.onPress());

    expect(mockGetRequiredForms).toHaveBeenCalledWith('before_starting_job', { jobId: 'job-2' });
    expect(mockSwitchActivity).not.toHaveBeenCalled();
    expect(mockStartWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      phase: 'pre_action',
      intent: expect.objectContaining({ kind: 'switch_activity', activeEntryId: 'entry-1', jobIds: ['job-2'] }),
    }));

    await act(async () => tree.root.findAllByType('secondary-button').find((node: any) => node.props.label === 'Skip for Now').props.onPress());
    expect(mockSwitchActivity).toHaveBeenCalledTimes(1);
    expect(mockGetRequiredForms).toHaveBeenCalledWith('after_leaving_job', { jobId: 'job-1' });
    expect(router.replace).toHaveBeenCalledWith('/active-shift');
  });

  it('resumes the preserved job switch once after its Form is completed', async () => {
    mockWorkflow = {
      id: 'workflow-switch', originRoute: '/switch-activity', destination: '/active-shift', phase: 'pre_action', completedCount: 1,
      intent: { kind: 'switch_activity', employeeId: 'emp-1', activeEntryId: 'entry-1', workType: 'job', jobIds: ['job-2'] },
      forms: [{ id: 'before-job', name: 'Job Start Check', trigger: 'before_starting_job', context: { jobId: 'job-2' }, fields: [] }],
    };
    await act(async () => { create(<SwitchActivityScreen />); });
    expect(mockSwitchActivity).toHaveBeenCalledTimes(1);
    expect(mockSwitchActivity).toHaveBeenCalledWith('job', ['job-2'], undefined, expect.any(Object));
  });

  it('surfaces after-leaving Forms only after a successful switch', async () => {
    mockGetRequiredForms.mockResolvedValue({ ok: true, forms: [{ id: 'after-job', name: 'Job Departure Report', trigger: 'after_leaving_job', context: { jobId: 'job-1' }, fields: [] }] });
    let tree: any;
    await act(async () => { tree = create(<SwitchActivityScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'switch-activity-option-drive_time' }).props.onPress());
    await act(async () => tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Switch Activity').props.onPress());

    expect(mockSwitchActivity).toHaveBeenCalledTimes(1);
    expect(mockGetRequiredForms).toHaveBeenCalledWith('after_leaving_job', { jobId: 'job-1' });
    expect(router.replace).not.toHaveBeenCalled();
    const text = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(text).toContain('Job Departure Report');
    await act(async () => tree.root.findAllByType('secondary-button').find((node: any) => node.props.label === 'Do Later').props.onPress());
    expect(router.replace).toHaveBeenCalledWith('/active-shift');
  });

  it('offers Drive Time without capability data and submits its canonical work type', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(SwitchActivityScreen));
    });

    const driveOption = tree.root.findAllByProps({ testID: 'switch-activity-option-drive_time' });
    expect(driveOption.length).toBeGreaterThan(0);

    await act(async () => {
      driveOption[0].props.onPress();
    });

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Switch Activity');
    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(mockSwitchActivity).toHaveBeenCalledWith('drive_time', [], undefined, { requestId: 'req-switch-1', idempotencyKey: 'key-switch-1' });
    expect(router.replace).toHaveBeenCalledWith('/active-shift');
  });
});
