import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockClockIn = jest.fn();
const mockRefresh = jest.fn().mockResolvedValue({ ok: true });
const mockGetRequiredForms = jest.fn().mockResolvedValue({ ok: true, forms: [] });
const mockRefreshForms = jest.fn().mockResolvedValue({ ok: true });
const mockStartWorkflow = jest.fn(() => 'workflow-1');
const mockClearWorkflow = jest.fn();
let mockWorkflow: any = null;
const mockLoadUnbillableCategoriesIfNeeded = jest.fn().mockResolvedValue(undefined);
const mockRetryUnbillableCategories = jest.fn().mockResolvedValue(undefined);
let mockOfflineClock: any;

const mockUseClockingActions = jest.fn(() => ({
  clockIn: mockClockIn,
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
    {
      id: 'cat-maintenance',
      name: 'Equipment Maintenance',
      description: '',
      sortOrder: 1,
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  loading: false,
  error: null,
  hasLoaded: true,
  loadIfNeeded: mockLoadUnbillableCategoriesIfNeeded,
  retry: mockRetryUnbillableCategories,
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
  jobs: [
    { id: 'job-1', title: 'Site A', status: 'scheduled', assignedEmployeeIds: ['emp-1'] },
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

jest.mock('@/store/offlineClockContext', () => ({
  useOptionalOfflineClockStore: () => mockOfflineClock,
}));

jest.mock('@/store/formsWorkflowStore', () => ({
  useFormsWorkflowStore: () => ({
    workflow: mockWorkflow,
    startWorkflow: mockStartWorkflow,
    clearWorkflow: mockClearWorkflow,
  }),
}));

jest.mock('@/services/requestGuards', () => ({
  createRequestMeta: () => ({ requestId: 'req-1', idempotencyKey: 'key-1' }),
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

import ClockInScreen from '../../app/clock-in';
import { router } from 'expo-router';

describe('ClockInScreen', () => {
  beforeEach(() => {
    (router.replace as jest.Mock).mockReset();
    mockClockIn.mockReset();
    mockRefresh.mockClear();
    mockGetRequiredForms.mockReset().mockResolvedValue({ ok: true, forms: [] });
    mockRefreshForms.mockReset().mockResolvedValue({ ok: true });
    mockStartWorkflow.mockClear();
    mockClearWorkflow.mockClear();
    mockWorkflow = null;
    mockOfflineClock = undefined;
    mockLoadUnbillableCategoriesIfNeeded.mockClear();
    mockRetryUnbillableCategories.mockClear();
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
        {
          id: 'cat-maintenance',
          name: 'Equipment Maintenance',
          description: '',
          sortOrder: 1,
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      loading: false,
      error: null,
      hasLoaded: true,
      loadIfNeeded: mockLoadUnbillableCategoriesIfNeeded,
      retry: mockRetryUnbillableCategories,
    });
    mockClockIn.mockResolvedValue({ ok: true });
  });

  it('routes an effective pending clock-in back to Active Shift', async () => {
    mockOfflineClock = {
      hydrated: true,
      effectiveState: { activeEntry: { id: 'local-clock:shift-1:key-1' } },
      cache: null,
    };

    await act(async () => {
      create(React.createElement(ClockInScreen));
    });

    expect(router.replace).toHaveBeenCalledWith('/active-shift');
  });

  it('shows offline notice and disables submit until a job is selected', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockInScreen));
    });

    const offline = tree.root.findAllByType('offline-notice');
    expect(offline.length).toBe(1);

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock In');
    expect(submitButton?.props.disabled).toBe(true);

    await act(async () => {
      tree.root.findAllByProps({ testID: 'activity-option-job' })[0].props.onPress();
    });
    const jobPress = tree.root.findAllByProps({ testID: 'job-option-job-1' })[0];
    await act(async () => {
      jobPress.props.onPress();
    });

    const selectedJob = tree.root.findAllByType('pressable').find((node: any) => node.props.testID === 'job-option-job-1');
    expect(selectedJob.props.accessibilityState).toEqual({ selected: true });
    expect(selectedJob.props.style).toEqual(expect.arrayContaining([
      expect.objectContaining({ backgroundColor: '#EBF1E7', borderColor: '#56734A' }),
    ]));

    const enabledSubmit = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock In');
    expect(enabledSubmit?.props.disabled).toBe(false);
  });

  it('submits selected job and navigates to active shift', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockInScreen));
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'activity-option-job' })[0].props.onPress();
    });
    await act(async () => {
      tree.root.findAllByProps({ testID: 'job-option-job-1' })[0].props.onPress();
    });

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock In');
    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(mockClockIn).toHaveBeenCalledWith('emp-1', 'job', ['job-1'], undefined, { requestId: 'req-1', idempotencyKey: 'key-1' });
    expect(router.replace).toHaveBeenCalledWith('/active-shift');
  });

  it('surfaces advisory Forms before clock in without blocking Continue', async () => {
    mockGetRequiredForms
      .mockResolvedValueOnce({ ok: true, forms: [{ id: 'form-clock', name: 'Morning Truck Inspection', category: 'Vehicle', trigger: 'before_clock_in', context: {}, fields: [] }] })
      .mockResolvedValueOnce({ ok: true, forms: [{ id: 'form-job', name: 'Job Start Check', trigger: 'before_starting_job', context: { jobId: 'job-1' }, fields: [] }] });
    let tree: any;
    await act(async () => { tree = create(<ClockInScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'activity-option-job' }).props.onPress());
    await act(async () => tree.root.findByProps({ testID: 'job-option-job-1' }).props.onPress());

    await act(async () => tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock In').props.onPress());

    expect(mockGetRequiredForms).toHaveBeenNthCalledWith(1, 'before_clock_in');
    expect(mockGetRequiredForms).toHaveBeenNthCalledWith(2, 'before_starting_job', { jobId: 'job-1' });
    expect(mockClockIn).not.toHaveBeenCalled();
    expect(mockStartWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      originRoute: '/clock-in',
      phase: 'pre_action',
      forms: expect.arrayContaining([expect.objectContaining({ id: 'form-clock' }), expect.objectContaining({ id: 'form-job' })]),
      intent: expect.objectContaining({ kind: 'clock_in', workType: 'job', jobIds: ['job-1'] }),
    }));
    const text = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(text).toContain('Pre-shift');
    expect(text).toContain('Morning Truck Inspection');
    expect(text).toContain('Job Start Check');

    await act(async () => tree.root.findAllByType('secondary-button').find((node: any) => node.props.label === 'Skip for Now').props.onPress());
    expect(mockClockIn).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/active-shift');
  });

  it('opens the exact advisory Form without clocking in', async () => {
    mockGetRequiredForms.mockResolvedValueOnce({
      ok: true,
      forms: [{ id: 'form-clock', name: 'Morning Truck Inspection', trigger: 'before_clock_in', context: {}, fields: [] }],
    });
    let tree: any;
    await act(async () => { tree = create(<ClockInScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'activity-option-drive_time' }).props.onPress());
    await act(async () => tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock In').props.onPress());
    mockWorkflow = {
      id: 'workflow-1', originRoute: '/clock-in', destination: '/active-shift', phase: 'pre_action', completedCount: 0,
      intent: { kind: 'clock_in', employeeId: 'emp-1', workType: 'drive_time', jobIds: [] },
      forms: [{ id: 'form-clock', name: 'Morning Truck Inspection', trigger: 'before_clock_in', context: {}, fields: [] }],
    };
    await act(async () => tree.update(<ClockInScreen />));
    await act(async () => tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Complete Form').props.onPress());

    expect(mockClockIn).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/form',
      params: expect.objectContaining({ formId: 'form-clock', trigger: 'before_clock_in', workflowId: 'workflow-1' }),
    }));
  });

  it('restores a completed Form workflow and clocks into the selected job exactly once', async () => {
    mockWorkflow = {
      id: 'workflow-1', originRoute: '/clock-in', destination: '/active-shift', phase: 'pre_action', completedCount: 1,
      intent: { kind: 'clock_in', employeeId: 'emp-1', workType: 'job', jobIds: ['job-1'] },
      forms: [{ id: 'form-clock', name: 'Morning Truck Inspection', trigger: 'before_clock_in', context: {}, fields: [] }],
    };

    await act(async () => { create(<ClockInScreen />); });

    expect(mockClockIn).toHaveBeenCalledTimes(1);
    expect(mockClockIn).toHaveBeenCalledWith('emp-1', 'job', ['job-1'], undefined, expect.any(Object));
    expect(mockClearWorkflow).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/active-shift');
  });

  it('shows the next pre-action Form and waits for the final completion before clocking in', async () => {
    const forms = [
      { id: 'form-one', name: 'Morning Truck Inspection', trigger: 'before_clock_in', context: {}, fields: [] },
      { id: 'form-two', name: 'Daily Safety Check', trigger: 'before_clock_in', context: {}, fields: [] },
    ];
    mockWorkflow = {
      id: 'workflow-1', originRoute: '/clock-in', destination: '/active-shift', phase: 'pre_action', completedCount: 1,
      intent: { kind: 'clock_in', employeeId: 'emp-1', workType: 'job', jobIds: ['job-1'] },
      forms,
    };
    let tree: any;
    await act(async () => { tree = create(<ClockInScreen />); });

    expect(mockClockIn).not.toHaveBeenCalled();
    const text = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(text).toContain('1 of 2 completed');
    expect(text).toContain('Daily Safety Check');
    expect(text).not.toContain('Morning Truck Inspection');

    await act(async () => tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Complete Next Form').props.onPress());
    expect(router.push).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/form',
      params: expect.objectContaining({ formId: 'form-two', workflowId: 'workflow-1' }),
    }));

    mockWorkflow = { ...mockWorkflow, completedCount: 2 };
    await act(async () => tree.update(<ClockInScreen />));
    expect(mockClockIn).toHaveBeenCalledTimes(1);
  });

  it('continues clock-in when the advisory Forms check fails', async () => {
    mockGetRequiredForms.mockResolvedValue({ ok: false, error: 'Could not check required Forms.' });
    let tree: any;
    await act(async () => { tree = create(<ClockInScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'activity-option-drive_time' }).props.onPress());
    await act(async () => tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock In').props.onPress());

    expect(mockClockIn).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/active-shift');
  });

  it('offers Drive Time without capability data and submits its canonical work type', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockInScreen));
    });

    const driveOption = tree.root.findAllByProps({ testID: 'activity-option-drive_time' });
    expect(driveOption.length).toBeGreaterThan(0);

    await act(async () => {
      driveOption[0].props.onPress();
    });

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock In');
    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(mockClockIn).toHaveBeenCalledWith('emp-1', 'drive_time', [], undefined, { requestId: 'req-1', idempotencyKey: 'key-1' });
    expect(router.replace).toHaveBeenCalledWith('/active-shift');
  });

  it('shows retry action when clock-in fails', async () => {
    mockClockIn.mockResolvedValue({ ok: false, error: 'Offline. Reconnect and retry clock-in.' });

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockInScreen));
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'activity-option-job' })[0].props.onPress();
    });
    await act(async () => {
      tree.root.findAllByProps({ testID: 'job-option-job-1' })[0].props.onPress();
    });

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock In');
    await act(async () => {
      await submitButton.props.onPress();
    });

    const retryButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Retry Clock In');
    expect(retryButton).toBeTruthy();
  });

  it('loads and renders backend categories for unbillable', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockInScreen));
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'activity-option-non_billable' })[0].props.onPress();
    });

    expect(mockLoadUnbillableCategoriesIfNeeded).toHaveBeenCalled();

    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(renderedText).toContain('Training');
    expect(renderedText).toContain('Equipment Maintenance');
    expect(renderedText).not.toContain('backend-configurable and will appear when available');
  });

  it('requires unbillable category before enabling unbillable clock-in', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockInScreen));
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'activity-option-non_billable' })[0].props.onPress();
    });

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock In');
    expect(submitButton?.props.disabled).toBe(true);
  });

  it('submits unbillable with selected backend category ID', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockInScreen));
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'activity-option-non_billable' })[0].props.onPress();
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'unbillable-category-option-cat-training' })[0].props.onPress();
    });

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock In');
    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(mockClockIn).toHaveBeenCalledWith('emp-1', 'non_billable', [], 'cat-training', { requestId: 'req-1', idempotencyKey: 'key-1' });
  });

  it('shows empty state and blocks unbillable submit when no categories are available', async () => {
    mockUseUnbillableCategories.mockReturnValue({
      categories: [],
      loading: false,
      error: null,
      hasLoaded: true,
      loadIfNeeded: mockLoadUnbillableCategoriesIfNeeded,
      retry: mockRetryUnbillableCategories,
    });

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockInScreen));
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'activity-option-non_billable' })[0].props.onPress();
    });

    const banners = tree.root.findAllByType('status-banner').map((node: any) => node.props.message);
    expect(banners).toContain('No unbillable categories are currently available. Ask your administrator to configure them in OliveOps.');

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock In');
    expect(submitButton?.props.disabled).toBe(true);
  });

  it('shows load-failure retry state and blocks unbillable submit', async () => {
    mockUseUnbillableCategories.mockReturnValue({
      categories: [],
      loading: false,
      error: 'network error',
      hasLoaded: false,
      loadIfNeeded: mockLoadUnbillableCategoriesIfNeeded,
      retry: mockRetryUnbillableCategories,
    });

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(ClockInScreen));
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'activity-option-non_billable' })[0].props.onPress();
    });

    const retryPressable = tree.root.findAllByProps({ testID: 'unbillable-category-retry' })[0];
    expect(retryPressable).toBeTruthy();

    await act(async () => {
      retryPressable.props.onPress();
    });
    expect(mockRetryUnbillableCategories).toHaveBeenCalledTimes(1);

    const submitButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock In');
    expect(submitButton?.props.disabled).toBe(true);
  });
});
