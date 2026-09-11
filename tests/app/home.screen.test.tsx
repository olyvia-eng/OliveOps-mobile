import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockRefresh = jest.fn().mockResolvedValue({ ok: true });
const mockRefreshTraining = jest.fn().mockResolvedValue({ ok: true });
const mockLoadSnowAssignment = jest.fn();
let mockPendingClockOut: any;
let mockPendingClockIn: any;
let mockOfflineClock: any;
let mockTrainingAssignments: any[];

function mockPendingClockOutFormTarget(workflow: any) {
  const requirement = workflow?.requirements?.find((item: any) => !item.completed)
    ?? workflow?.requiredForms?.find((item: any) => !item.completed);
  const form = requirement?.form ?? requirement?.formPackage
    ?? (requirement?.fields && (requirement.formId || requirement.id)
      ? { ...requirement, id: requirement.formId ?? requirement.id }
      : null);
  return requirement && form?.id && form.name && Array.isArray(form.fields)
    ? {
        form,
        workflowOccurrenceId: workflow.workflowOccurrenceId,
        workflowRequirementId: requirement.workflowRequirementId,
      }
    : null;
}

const mockUseClockingActions = jest.fn(() => ({
  refreshWorkContext: mockRefresh,
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

const mockClockingState: any = {
  companyFeatures: { projects: true, recurringServices: true, snowOperations: true },
  currentActiveEntryId: 'entry-1',
  activeShiftWarnings: {
    possibleForgottenClockOut: false,
    thresholdHours: 12,
  },
  timeCorrections: [],
  jobs: [
    { id: 'job-1', title: 'Front Walkway', status: 'scheduled', assignedEmployeeIds: ['emp-1'] },
    { id: 'job-2', title: 'Warehouse', status: 'scheduled', assignedEmployeeIds: ['emp-1'] },
  ],
  todayServiceVisits: [{
    id: 'visit-1', jobId: 'job-1', serviceId: 'service-1', jobName: 'Front Walkway',
    serviceName: 'Weekly Lawn Care', scheduledDate: '2026-08-07', scheduleAllDay: true,
    status: 'scheduled', billingType: 'recurring',
  }],
  upcomingServiceVisits: [],
  timeEntries: [
    {
      id: 'entry-2',
      employeeId: 'emp-1',
      jobId: 'job-2',
      workType: 'job',
      clockIn: '2026-08-07T10:10:00.000Z',
      breakMinutes: 0,
      notes: '',
      status: 'clocked_in',
    },
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
  ],
};

const mockUseClockingStore = jest.fn(() => mockClockingState);
const mockFormsState = {
  toDo: [{ id: 'required-1' }, { id: 'required-2' }],
  available: [{ id: 'available-1' }, { id: 'available-2' }, { id: 'available-3' }],
  completed: [{ submissionId: 'completed-1' }],
};

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('@/hooks/useClockingActions', () => ({
  useClockingActions: () => mockUseClockingActions(),
}));

jest.mock('@/api/snowOperationsApi', () => ({
  loadMyActiveSnowRoute: (...args: unknown[]) => mockLoadSnowAssignment(...args),
}));

jest.mock('@/hooks/useTrainingActions', () => ({
  useTrainingActions: () => ({ refreshAssignments: mockRefreshTraining }),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

jest.mock('@/store/clockingStore', () => ({
  useClockingStore: () => mockUseClockingStore(),
}));

jest.mock('@/store/trainingStore', () => ({
  useTrainingStore: () => ({ assignments: mockTrainingAssignments }),
}));

jest.mock('@/store/pendingClockOutStore', () => ({
  usePendingClockOutStore: () => mockPendingClockOut,
  pendingClockOutFormTarget: (workflow: any) => mockPendingClockOutFormTarget(workflow),
}));

jest.mock('@/store/pendingClockInStore', () => ({
  usePendingClockInStore: () => mockPendingClockIn,
}));

jest.mock('@/store/offlineClockContext', () => ({
  useOptionalOfflineClockStore: () => mockOfflineClock,
}));

jest.mock('@/components/Screen', () => ({
  Screen: ({ children }: any) => require('react').createElement('screen', {}, children),
  PrimaryScreen: ({ children, testID }: any) => require('react').createElement('primary-screen', {
    edges: ['top', 'left', 'right'], testID,
  }, children),
}));

jest.mock('@/components/OfflineNotice', () => ({
  OfflineNotice: () => require('react').createElement('offline-notice', {}),
}));

jest.mock('@/components/StatusBanner', () => ({
  StatusBanner: ({ message }: any) => require('react').createElement('status-banner', { message }),
}));

jest.mock('@/components/PrimaryActionButton', () => ({
  PrimaryActionButton: ({ label, onPress }: any) =>
    require('react').createElement('primary-button', { label, onPress }),
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
    Pressable: ({ children, onPress, style, ...props }: any) => React.createElement('pressable', {
      ...props,
      onPress,
      style: typeof style === 'function' ? style({ pressed: false }) : style,
    }, children),
  };
});

import HomeScreen from '../../app/home';
import { router } from 'expo-router';

function textOf(node: any) {
  return node.findAllByType('text').map((item: any) => String(item.props.children)).join(' ');
}

describe('HomeScreen', () => {
  let tree: any;

  beforeEach(() => {
    mockRefresh.mockClear();
    mockRefreshTraining.mockClear();
    mockTrainingAssignments = [];
    mockLoadSnowAssignment.mockReset().mockResolvedValue({ ok: true, event: null, route: null, stops: [] });
    mockClockingState.companyFeatures = { projects: true, recurringServices: true, snowOperations: true };
    mockClockingState.jobs = [
      { id: 'job-1', title: 'Front Walkway', status: 'scheduled', assignedEmployeeIds: ['emp-1'], scheduledToday: true },
      { id: 'job-2', title: 'Warehouse', status: 'scheduled', assignedEmployeeIds: ['emp-1'], scheduledToday: false },
    ];
    mockClockingState.currentActiveEntryId = 'entry-1';
    mockClockingState.timeEntries = [
      {
        id: 'entry-2', employeeId: 'emp-1', jobId: 'job-2', workType: 'job',
        clockIn: '2026-08-07T10:10:00.000Z', breakMinutes: 0, notes: '', status: 'clocked_in',
      },
      {
        id: 'entry-1', employeeId: 'emp-1', jobId: 'job-1', workType: 'job',
        clockIn: '2026-08-07T10:00:00.000Z', breakMinutes: 0, notes: '', status: 'clocked_in',
      },
    ];
    mockOfflineClock = undefined;
    mockClockingState.activeShiftWarnings.possibleForgottenClockOut = false;
    mockPendingClockOut = {
      workflow: null,
      currentRequirement: null,
      currentForm: null,
      completedCount: 0,
      totalCount: 0,
      busy: false,
      error: null,
      recover: jest.fn().mockResolvedValue(null),
    };
    mockPendingClockIn = {
      workflow: null,
      currentRequirement: null,
      currentForm: null,
      completedCount: 0,
      totalCount: 0,
      busy: false,
      error: null,
      phase: { kind: 'no_pending_workflow' },
      ensureCurrentForm: jest.fn().mockResolvedValue(null),
      reconcileActiveShift: jest.fn().mockResolvedValue(false),
      finalize: jest.fn().mockResolvedValue({ ok: true }),
    };
  });

  afterEach(async () => {
    if (!tree) return;
    await act(async () => {
      tree.unmount();
    });
    tree = undefined;
  });

  it('uses authoritative active entry id for current status card', async () => {
    await act(async () => {
      tree = create(React.createElement(HomeScreen));
    });

    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(renderedText).toContain('Front Walkway');
    expect(renderedText).not.toContain('Current job: Warehouse');
    expect(tree.root.findByType('primary-screen').props.edges).toEqual(['top', 'left', 'right']);
  });

  it('shows Clock In after authoritative clock-out clears the active entry and pending workflow', async () => {
    mockClockingState.currentActiveEntryId = null;
    mockClockingState.timeEntries = mockClockingState.timeEntries.map((entry: any) => ({
      ...entry,
      status: 'completed',
      clockOut: '2026-09-10T21:00:00.000Z',
    }));
    mockPendingClockOut = { ...mockPendingClockOut, workflow: null, currentRequirement: null, currentForm: null };

    await act(async () => { tree = create(<HomeScreen />); });

    expect(textOf(tree.root)).toContain('Ready to start your shift?');
    expect(textOf(tree.root)).not.toContain('Clock out pending');
    expect(tree.root.findAllByType('primary-button').map((node: any) => node.props.label)).toContain('Clock In');
  });

  it('opens the employee Snow assignment when an active Route is assigned', async () => {
    mockLoadSnowAssignment.mockResolvedValue({
      ok: true,
      event: { id: 'event-1', title: 'January Storm' },
      route: { id: 'route-1', name: 'North Route' },
      stops: [{ id: 'stop-1' }, { id: 'stop-2' }],
      progress: { total: 2, completed: 1, needsAttention: 0, currentStopId: 'stop-2' },
    });
    await act(async () => { tree = create(React.createElement(HomeScreen)); });

    await act(async () => tree.root.findByProps({ testID: 'snow-assignment-link' }).props.onPress());

    expect(router.push).toHaveBeenCalledWith('/snow-assignment');
  });

  it('hides disabled Service Visits, Snow Operations, and Projects without loading Snow', async () => {
    mockClockingState.companyFeatures = { projects: false, recurringServices: false, snowOperations: false };
    mockClockingState.currentActiveEntryId = null;

    await act(async () => { tree = create(<HomeScreen />); });

    expect(textOf(tree.root)).not.toContain('Service Visits');
    expect(textOf(tree.root)).not.toContain('Assigned Jobs');
    expect(tree.root.findAllByProps({ testID: 'snow-assignment-card' })).toHaveLength(0);
    expect(mockLoadSnowAssignment).not.toHaveBeenCalled();
  });

  it('uses legacy Projects and Recurring defaults while feature state is unhydrated', async () => {
    mockClockingState.companyFeatures = null;
    mockClockingState.currentActiveEntryId = null;
    mockClockingState.timeEntries = [];

    await act(async () => { tree = create(<HomeScreen />); });

    expect(textOf(tree.root)).toContain('Service Visits');
    expect(textOf(tree.root)).toContain('Today’s Jobs');
    expect(mockLoadSnowAssignment).not.toHaveBeenCalled();
  });

  it('shows the same canonical scheduled-today set without unrelated or unavailable Jobs', async () => {
    mockClockingState.currentActiveEntryId = null;
    mockClockingState.timeEntries = [];
    mockClockingState.jobs = [
      { id: 'today-1', title: 'Today One', status: 'scheduled', assignedEmployeeIds: ['emp-1'], scheduledToday: true },
      { id: 'today-2', title: 'Today Two', status: 'in_progress', assignedEmployeeIds: ['emp-1'], scheduledToday: true },
      { id: 'today-3', title: 'Today Three', status: 'scheduled', assignedEmployeeIds: ['emp-1'], scheduledToday: true },
      { id: 'today-4', title: 'Today Four', status: 'scheduled', assignedEmployeeIds: ['emp-1'], scheduledToday: true },
      { id: 'yesterday', title: 'Yesterday Job', status: 'in_progress', assignedEmployeeIds: ['emp-1'], scheduledToday: false },
      { id: 'completed', title: 'Completed Job', status: 'completed', assignedEmployeeIds: ['emp-1'], scheduledToday: true },
      { id: 'cancelled', title: 'Cancelled Job', status: 'cancelled', assignedEmployeeIds: ['emp-1'], scheduledToday: true },
      { id: 'on-hold', title: 'On Hold Job', status: 'on_hold', assignedEmployeeIds: ['emp-1'], scheduledToday: true },
    ];

    await act(async () => { tree = create(<HomeScreen />); });

    expect(textOf(tree.root)).toContain('Today’s Jobs');
    const todayJobRows = tree.root.findAllByType('pressable');
    for (const id of ['today-1', 'today-2', 'today-3', 'today-4']) {
      expect(todayJobRows.filter((node: any) => node.props.testID === `today-job-${id}`)).toHaveLength(1);
    }
    for (const id of ['yesterday', 'completed', 'cancelled', 'on-hold']) {
      expect(todayJobRows.filter((node: any) => node.props.testID === `today-job-${id}`)).toHaveLength(0);
    }
    expect(textOf(tree.root)).not.toContain('Yesterday Job');
    expect(textOf(tree.root)).not.toContain('Completed Job');
    expect(textOf(tree.root)).not.toContain('Cancelled Job');
    expect(textOf(tree.root)).not.toContain('On Hold Job');
  });

  it('shows the canonical empty state when no Jobs are scheduled today', async () => {
    mockClockingState.currentActiveEntryId = null;
    mockClockingState.timeEntries = [];
    mockClockingState.jobs = [
      { id: 'yesterday', title: 'Yesterday Job', status: 'in_progress', assignedEmployeeIds: ['emp-1'], scheduledToday: false },
    ];

    await act(async () => { tree = create(<HomeScreen />); });

    expect(tree.root.findAllByType('status-banner').map((node: any) => node.props.message)).toContain('No jobs scheduled for today');
    expect(textOf(tree.root)).not.toContain('Yesterday Job');
  });

  it('keeps an active Service Visit shift visible and clock-out available after the feature is disabled', async () => {
    mockClockingState.companyFeatures = { projects: false, recurringServices: false, snowOperations: false };
    mockClockingState.currentActiveEntryId = 'entry-1';
    mockClockingState.timeEntries = [{
      id: 'entry-1', employeeId: 'emp-1', jobId: 'job-1', jobIds: ['job-1'], workType: 'job',
      serviceId: 'service-1', serviceVisitId: 'visit-1', serviceName: 'Weekly Lawn Care',
      clockIn: '2026-08-07T10:00:00.000Z', breakMinutes: 0, notes: '', status: 'clocked_in',
    }];

    await act(async () => { tree = create(<HomeScreen />); });

    expect(textOf(tree.root)).toContain("You're clocked in");
    expect(tree.root.findAllByType('primary-button').map((node: any) => node.props.label)).toContain('Clock Out');
    expect(textOf(tree.root)).not.toContain('Service Visits');
  });

  it('orders overdue before due-soon Training and caps attention at three rows', async () => {
    mockTrainingAssignments = [
      { id: 'soon-1', trainingTitle: 'First Aid', currentDueDate: '2026-09-12', presentationStatus: 'due_soon' },
      { id: 'late-1', trainingTitle: 'WHMIS', currentDueDate: '2026-09-01', presentationStatus: 'overdue' },
      { id: 'late-2', trainingTitle: 'Fall Protection', currentDueDate: '2026-09-02', presentationStatus: 'overdue' },
      { id: 'soon-2', trainingTitle: 'Orientation', currentDueDate: '2026-09-15', presentationStatus: 'due_soon' },
    ];
    await act(async () => {
      tree = create(React.createElement(HomeScreen));
    });

    const attentionRows = tree.root.findByProps({ testID: 'attention-list' }).findAllByType('pressable');
    expect(attentionRows).toHaveLength(3);
    expect(textOf(attentionRows[0])).toContain('WHMIS');
    expect(textOf(attentionRows[1])).toContain('Fall Protection');
    expect(textOf(attentionRows[2])).toContain('First Aid');
    expect(textOf(tree.root)).toContain('View all');
    expect(textOf(tree.root)).not.toContain('Quick Actions');
  });

  it('shows long-shift warning actions when possible forgotten clock-out is flagged', async () => {
    mockClockingState.activeShiftWarnings.possibleForgottenClockOut = true;

    await act(async () => {
      tree = create(React.createElement(HomeScreen));
    });

    const labels = tree.root.findAllByType('primary-button').map((node: any) => node.props.label);
    expect(labels).toContain('Clock Out Now');

    const banners = tree.root.findAllByType('status-banner');
    expect(banners[0].props.message).toContain('Did you forget to clock out?');

    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(renderedText).toContain('Clock Out & Request Correction');
  });

  it('shows a distinct resume action and suppresses a second clock-out while forms are pending', async () => {
    const form = { id: 'form-1', name: 'End of Shift Report', fields: [] };
    const workflow = {
      workflowOccurrenceId: 'occurrence-1',
      requirements: [{ workflowRequirementId: 'requirement-1', completed: false, form }],
    };
    const recover = jest.fn().mockResolvedValue(workflow);
    mockPendingClockOut = {
      workflow,
      currentRequirement: { workflowRequirementId: 'requirement-1' },
      currentForm: form,
      completedCount: 1,
      totalCount: 3,
      busy: false,
      error: null,
      recover,
    };
    await act(async () => { tree = create(<HomeScreen />); });

    const labels = tree.root.findAllByType('primary-button').map((node: any) => node.props.label);
    expect(labels).toContain('Resume Required Form');
    expect(labels).not.toContain('Clock Out');
    const renderedText = textOf(tree.root);
    expect(renderedText).toContain('Clock out pending');
    expect(renderedText).toContain('Required form 2 of 3');

    await act(async () => tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Resume Required Form').props.onPress());

    expect(recover).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/form',
      params: {
        formId: 'form-1', trigger: 'after_clock_out', workflowOccurrenceId: 'occurrence-1',
        workflowRequirementId: 'requirement-1',
      },
    });
  });

  it('replaces stale local clock-out state with a reconciled canonical response', async () => {
    mockClockingState.currentActiveEntryId = null;
    mockClockingState.timeEntries = [];
    const recover = jest.fn().mockImplementation(async () => {
      mockPendingClockOut = { ...mockPendingClockOut, workflow: null, currentRequirement: null, currentForm: null };
      return null;
    });
    mockPendingClockOut = {
      workflow: { workflowOccurrenceId: 'stale-occurrence' },
      currentRequirement: { workflowRequirementId: 'stale-requirement' },
      currentForm: { id: 'stale-form', name: 'Old Report', fields: [] },
      completedCount: 0,
      totalCount: 1,
      busy: false,
      error: null,
      recover,
    };
    await act(async () => { tree = create(<HomeScreen />); });

    await act(async () => tree.root.findByType('primary-button').props.onPress());
    await act(async () => tree.update(<HomeScreen />));

    expect(recover).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: '/form' }));
    expect(tree.root.findAllByType('primary-button').map((node: any) => node.props.label)).toContain('Clock In');
    expect(textOf(tree.root)).not.toContain('Clock out pending');
  });

  it('keeps a missing required snapshot enforced and offers canonical Retry', async () => {
    mockPendingClockOut = {
      workflow: {
        workflowOccurrenceId: 'occurrence-1',
        requirements: [{ workflowRequirementId: 'requirement-1', completed: false, formId: 'form-1' }],
      },
      currentRequirement: { workflowRequirementId: 'requirement-1', formId: 'form-1' },
      currentForm: null,
      completedCount: 0,
      totalCount: 1,
      busy: false,
      error: null,
      recover: jest.fn().mockResolvedValue({
        workflowOccurrenceId: 'occurrence-1',
        requirements: [{ workflowRequirementId: 'requirement-1', completed: false, formId: 'form-1' }],
      }),
    };
    await act(async () => { tree = create(<HomeScreen />); });

    expect(tree.root.findByType('primary-button').props.label).toBe('Retry Required Form');
    await act(async () => tree.root.findByType('primary-button').props.onPress());

    expect(tree.root.findAllByType('status-banner').map((node: any) => node.props.message).join(' ')).toContain('contact your supervisor or administrator');
    expect(router.push).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: '/form' }));
    expect(tree.root.findAllByType('primary-button').map((node: any) => node.props.label)).not.toContain('Clock In');
  });

  it('opens a persisted snapshot when Retry returns a repaired pending workflow', async () => {
    const recoveredWorkflow = {
      workflowOccurrenceId: 'occurrence-1',
      requirements: [{
        workflowRequirementId: 'requirement-1', completed: false,
        formPackage: { id: 'form-1', name: 'Historical Report', fields: [] },
      }],
    };
    const recover = jest.fn().mockResolvedValue(recoveredWorkflow);
    mockPendingClockOut = {
      workflow: { workflowOccurrenceId: 'occurrence-1' },
      currentRequirement: { workflowRequirementId: 'requirement-1' },
      currentForm: null,
      completedCount: 0,
      totalCount: 1,
      busy: false,
      error: null,
      recover,
    };
    await act(async () => { tree = create(<HomeScreen />); });

    await act(async () => tree.root.findByType('primary-button').props.onPress());

    expect(recover).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/form',
      params: expect.objectContaining({ formId: 'form-1', workflowRequirementId: 'requirement-1' }),
    }));
  });

  it('restores pending clock-in as a resume action without showing an active shift', async () => {
    const ensureCurrentForm = jest.fn();
    mockClockingState.currentActiveEntryId = null;
    mockPendingClockIn = {
      workflow: { workflowOccurrenceId: 'clock-in-occurrence-1' },
      currentRequirement: { requirementId: 'clock-in-requirement-1' },
      currentForm: { id: 'form-clock-in' },
      completedCount: 0,
      totalCount: 2,
      busy: false,
      error: null,
      phase: { kind: 'requirements_outstanding', current: 1, total: 2 },
      ensureCurrentForm,
      reconcileActiveShift: jest.fn(),
      finalize: jest.fn(),
    };
    await act(async () => { tree = create(<HomeScreen />); });

    const renderedText = textOf(tree.root);
    expect(renderedText).toContain('Clock in pending');
    expect(renderedText).toContain('Required form 1 of 2');
    expect(renderedText).not.toContain("You're clocked in");
    const resume = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Resume Required Form');
    await act(async () => resume.props.onPress());
    expect(router.push).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/form',
      params: expect.objectContaining({ workflowRequirementId: 'clock-in-requirement-1' }),
    }));
    expect(ensureCurrentForm).not.toHaveBeenCalled();
  });

  it('resolves an ID-only pending clock-in and opens its Form directly', async () => {
    const ensureCurrentForm = jest.fn().mockResolvedValue({ id: 'form-clock-in' });
    mockClockingState.currentActiveEntryId = null;
    mockPendingClockIn = {
      workflow: { workflowOccurrenceId: 'clock-in-occurrence-1' },
      currentRequirement: { requirementId: 'clock-in-requirement-1', formId: 'form-clock-in' },
      currentForm: null,
      completedCount: 0,
      totalCount: 1,
      busy: false,
      error: null,
      phase: { kind: 'requirements_outstanding', current: 1, total: 1 },
      ensureCurrentForm,
      reconcileActiveShift: jest.fn(),
      finalize: jest.fn(),
    };
    await act(async () => { tree = create(<HomeScreen />); });

    const resume = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Resume Required Form');
    await act(async () => resume.props.onPress());

    expect(ensureCurrentForm).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/form',
      params: {
        formId: 'form-clock-in', trigger: 'before_clock_in', workflowOccurrenceId: 'clock-in-occurrence-1',
        workflowRequirementId: 'clock-in-requirement-1',
      },
    });
  });

  it('shows completed requirements as clock-in finalization instead of an impossible Form count', async () => {
    const finalize = jest.fn().mockResolvedValue({ ok: false, error: 'Reconnect to finish clocking in.' });
    mockClockingState.currentActiveEntryId = null;
    mockPendingClockIn = {
      workflow: {
        workflowOccurrenceId: 'clock-in-occurrence-1',
        clockInIntent: { workType: 'job', jobIds: ['job-1'], workAreaId: 'area-1', clockingContractVersion: 2 },
      },
      currentRequirement: null,
      currentForm: null,
      completedCount: 1,
      totalCount: 1,
      busy: false,
      error: 'Reconnect to finish clocking in.',
      phase: { kind: 'ready_to_finalize', total: 1 },
      ensureCurrentForm: jest.fn(),
      reconcileActiveShift: jest.fn(),
      finalize,
    };
    await act(async () => { tree = create(<HomeScreen />); });

    const renderedText = textOf(tree.root);
    const labels = tree.root.findAllByType('primary-button').map((node: any) => node.props.label);
    expect(renderedText).toContain('Required forms complete');
    expect(renderedText).toContain('Clock-in still needs to be finished.');
    expect(renderedText).not.toContain('Required form 2 of 1');
    expect(labels).toContain('Retry Finish Clock In');
    expect(labels).not.toContain('Resume Required Form');
    expect(tree.root.findAllByType('status-banner')).toEqual(expect.arrayContaining([
      expect.objectContaining({ props: expect.objectContaining({ message: 'Reconnect to finish clocking in.' }) }),
    ]));

    await act(async () => tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Retry Finish Clock In').props.onPress());
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(mockPendingClockIn.ensureCurrentForm).not.toHaveBeenCalled();
  });

  it('refreshes the active shift after Finish Clock In succeeds', async () => {
    const finalize = jest.fn().mockResolvedValue({ ok: true });
    mockClockingState.currentActiveEntryId = null;
    mockPendingClockIn = {
      workflow: { workflowOccurrenceId: 'clock-in-occurrence-1' },
      currentRequirement: null,
      currentForm: null,
      completedCount: 2,
      totalCount: 2,
      busy: false,
      error: 'Clock-in could not be finalized. Your required form progress is still saved.',
      phase: { kind: 'ready_to_finalize', total: 2 },
      ensureCurrentForm: jest.fn(),
      reconcileActiveShift: jest.fn(),
      finalize,
    };
    await act(async () => { tree = create(<HomeScreen />); });

    const retry = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Retry Finish Clock In');
    await act(async () => retry.props.onPress());

    expect(finalize).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalled();
    expect(mockPendingClockIn.ensureCurrentForm).not.toHaveBeenCalled();
  });

  it('shows an authoritative active shift instead of a stale completed clock-in workflow', async () => {
    const reconcileActiveShift = jest.fn().mockResolvedValue(true);
    mockPendingClockIn = {
      workflow: { workflowOccurrenceId: 'clock-in-occurrence-1' },
      currentRequirement: null,
      currentForm: null,
      completedCount: 1,
      totalCount: 1,
      busy: false,
      error: 'Already Clocked In',
      phase: { kind: 'ready_to_finalize', total: 1 },
      ensureCurrentForm: jest.fn(),
      reconcileActiveShift,
      finalize: jest.fn(),
    };

    await act(async () => { tree = create(<HomeScreen />); });

    const renderedText = textOf(tree.root);
    const labels = tree.root.findAllByType('primary-button').map((node: any) => node.props.label);
    expect(renderedText).toContain("You're clocked in");
    expect(renderedText).not.toContain('Clock in pending');
    expect(renderedText).not.toContain('Already Clocked In');
    expect(labels).toContain('Clock Out');
    expect(labels).not.toContain('Retry Finish Clock In');
    expect(reconcileActiveShift).toHaveBeenCalledTimes(1);
  });

  it('describes a synthetic offline clock-in as pending sync, not server-confirmed', async () => {
    mockClockingState.currentActiveEntryId = null;
    mockClockingState.timeEntries = [];
    const localEntry = {
      id: 'local-clock:shift-1:key-1', employeeId: 'emp-1', jobId: 'job-1', jobIds: ['job-1'],
      workType: 'job', clockIn: '2026-08-07T10:00:00.000Z', breakMinutes: 0, notes: '', status: 'clocked_in',
    };
    mockOfflineClock = {
      hydrated: true,
      cache: null,
      effectiveState: {
        activeEntry: localEntry,
        activeSource: 'offline_pending',
        effectiveActiveEntryId: localEntry.id,
        effectiveStatus: 'clocked_in_pending',
        shiftStartedAt: localEntry.clockIn,
      },
      effectiveTimeEntries: [localEntry],
    };

    await act(async () => { tree = create(<HomeScreen />); });

    const renderedText = textOf(tree.root);
    expect(renderedText).toContain('Clock in pending sync');
    expect(renderedText).toContain('Your clock-in is waiting to sync');
    expect(renderedText).not.toContain("You're clocked in");
  });

  it('shows a mandatory workflow ahead of a stale local optimistic clock-in', async () => {
    mockClockingState.currentActiveEntryId = null;
    mockClockingState.timeEntries = [];
    const localEntry = {
      id: 'local-clock:shift-1:key-1', employeeId: 'emp-1', jobIds: ['job-1'], workType: 'job',
      clockIn: '2026-08-07T10:00:00.000Z', breakMinutes: 0, notes: '', status: 'clocked_in',
    };
    mockOfflineClock = {
      hydrated: true,
      cache: null,
      effectiveState: {
        activeEntry: localEntry, activeSource: 'offline_pending', effectiveActiveEntryId: localEntry.id,
        effectiveStatus: 'clocked_in_pending', shiftStartedAt: localEntry.clockIn,
      },
      effectiveTimeEntries: [localEntry],
    };
    mockPendingClockIn = {
      ...mockPendingClockIn,
      workflow: { workflowOccurrenceId: 'occurrence-1' },
      currentRequirement: { requirementId: 'requirement-1', formId: 'form-1' },
      currentForm: { id: 'form-1' },
      totalCount: 1,
      phase: { kind: 'requirements_outstanding', current: 1, total: 1 },
    };

    await act(async () => { tree = create(<HomeScreen />); });

    const renderedText = textOf(tree.root);
    expect(renderedText).toContain('Clock in pending');
    expect(renderedText).toContain('Complete required pre-shift form');
    expect(renderedText).not.toContain('Clock in pending sync');
    expect(renderedText).not.toContain("You're clocked in");
  });
});
