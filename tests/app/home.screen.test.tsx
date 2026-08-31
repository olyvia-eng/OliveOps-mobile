import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockRefresh = jest.fn().mockResolvedValue({ ok: true });
const mockRefreshForms = jest.fn().mockResolvedValue({ ok: true });
let mockPendingClockOut: any;
let mockPendingClockIn: any;

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

const mockClockingState = {
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

jest.mock('@/hooks/useFormsActions', () => ({
  useFormsActions: () => ({ refreshForms: mockRefreshForms }),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

jest.mock('@/store/clockingStore', () => ({
  useClockingStore: () => mockUseClockingStore(),
}));

jest.mock('@/store/formsStore', () => ({
  useFormsStore: () => mockFormsState,
}));

jest.mock('@/store/pendingClockOutStore', () => ({
  usePendingClockOutStore: () => mockPendingClockOut,
}));

jest.mock('@/store/pendingClockInStore', () => ({
  usePendingClockInStore: () => mockPendingClockIn,
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
    Pressable: ({ children, onPress }: any) => React.createElement('pressable', { onPress }, children),
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
    mockRefreshForms.mockClear();
    mockFormsState.toDo = [{ id: 'required-1' }, { id: 'required-2' }];
    mockClockingState.activeShiftWarnings.possibleForgottenClockOut = false;
    mockPendingClockOut = {
      workflow: null,
      currentRequirement: null,
      currentForm: null,
      completedCount: 0,
      totalCount: 0,
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
  });

  it('opens Forms as a primary employee feature', async () => {
    await act(async () => {
      tree = create(React.createElement(HomeScreen));
    });

    const formsRow = tree.root.findAllByType('pressable').find((node: any) => {
      const text = node.findAllByType('text').map((child: any) => String(child.props.children)).join(' ');
      return text.includes('Forms');
    });
    await act(async () => formsRow.props.onPress());
    expect(router.push).toHaveBeenCalledWith('/forms');
  });

  it('opens Time Off from Quick Actions', async () => {
    await act(async () => {
      tree = create(React.createElement(HomeScreen));
    });

    const row = tree.root.findAllByType('pressable').find((node: any) => textOf(node).includes('Time Off'));
    await act(async () => row.props.onPress());
    expect(router.push).toHaveBeenCalledWith('/time-off');
  });

  it('shows only the outstanding To Do count for Forms', async () => {
    await act(async () => { tree = create(<HomeScreen />); });
    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(renderedText).toContain('2 due');
    expect(renderedText).not.toContain('3 due');
    expect(renderedText).not.toContain('6 due');
  });

  it('omits the due count when no required Forms are outstanding', async () => {
    mockFormsState.toDo = [];
    await act(async () => { tree = create(<HomeScreen />); });
    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(renderedText).not.toContain('due');
    expect(renderedText).toContain('Complete required and available forms');
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
    mockPendingClockOut = {
      workflow: { workflowOccurrenceId: 'occurrence-1' },
      currentRequirement: { workflowRequirementId: 'requirement-1' },
      currentForm: { id: 'form-1' },
      completedCount: 1,
      totalCount: 3,
    };
    await act(async () => { tree = create(<HomeScreen />); });

    const labels = tree.root.findAllByType('primary-button').map((node: any) => node.props.label);
    expect(labels).toContain('Resume Required Form');
    expect(labels).not.toContain('Clock Out');
    const renderedText = textOf(tree.root);
    expect(renderedText).toContain('Clock out pending');
    expect(renderedText).toContain('Required form 2 of 3');
  });

  it('restores pending clock-in as a resume action without showing an active shift', async () => {
    const ensureCurrentForm = jest.fn();
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
      finalize,
    };
    await act(async () => { tree = create(<HomeScreen />); });

    const retry = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Retry Finish Clock In');
    await act(async () => retry.props.onPress());

    expect(finalize).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalled();
    expect(mockPendingClockIn.ensureCurrentForm).not.toHaveBeenCalled();
  });
});
