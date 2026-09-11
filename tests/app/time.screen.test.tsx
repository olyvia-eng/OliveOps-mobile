import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPush = jest.fn();
const mockRefresh = jest.fn().mockResolvedValue({ ok: true });
let mockEffectiveClock: any;
let mockOfflineClock: any;
let mockPendingClockIn: any;
let mockPendingClockOut: any;
const mockClockingState: any = {
  activeShiftWarnings: { possibleForgottenClockOut: false, thresholdHours: 12 },
  businessTimeZone: 'America/Toronto',
  jobs: [{ id: 'job-1', title: 'Front Walkway', status: 'scheduled', assignedEmployeeIds: ['employee-1'] }],
  timeCorrections: [],
  timeEntries: [],
  currentActiveEntryId: null,
};

jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('@/hooks/useEffectiveClockState', () => ({ useEffectiveClockState: () => mockEffectiveClock }));
jest.mock('@/hooks/useClockingActions', () => ({ useClockingActions: () => ({ refreshWorkContext: mockRefresh }) }));
jest.mock('@/store/authStore', () => ({ useAuthStore: () => ({ user: { employeeId: 'employee-1' } }) }));
jest.mock('@/store/clockingStore', () => ({ useClockingStore: () => mockClockingState }));
jest.mock('@/store/offlineClockContext', () => ({
  useOptionalOfflineClockStore: () => mockOfflineClock,
  getOfflineConflictMessage: () => 'This offline time change conflicts with your current time record. Submit a time correction.',
}));
jest.mock('@/store/pendingClockInStore', () => ({ usePendingClockInStore: () => mockPendingClockIn }));
jest.mock('@/store/pendingClockOutStore', () => ({ usePendingClockOutStore: () => mockPendingClockOut }));
jest.mock('@/components/Screen', () => ({
  PrimaryScreen: ({ children, testID }: any) => require('react').createElement('primary-screen', {
    testID, edges: ['top', 'left', 'right'], scrollable: true,
  }, children),
}));
jest.mock('@/components/PrimaryActionButton', () => ({
  PrimaryActionButton: (props: any) => require('react').createElement('primary-button', props),
}));
jest.mock('@/components/SecondaryButton', () => ({
  SecondaryButton: (props: any) => require('react').createElement('secondary-button', props),
}));
jest.mock('react-native', () => {
  const ReactModule = require('react');
  return {
    NativeModules: {}, Platform: { select: (values: any) => values.ios ?? values.default }, TurboModuleRegistry: { get: () => null },
    StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
    View: ({ children, ...props }: any) => ReactModule.createElement('view', props, children),
    Text: ({ children, ...props }: any) => ReactModule.createElement('text', props, children),
    Pressable: ({ children, onPress, style, ...props }: any) => ReactModule.createElement('pressable', { onPress, style: typeof style === 'function' ? style({ pressed: false }) : style, ...props }, children),
  };
});

import TimeScreen from '../../app/time';

function textOf(node: any) {
  return node.findAllByType('text').map((item: any) => String(item.props.children)).join(' ');
}

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1', employeeId: 'employee-1', workType: 'job', jobId: 'job-1',
    workAreaNameSnapshot: 'Excavation', clockIn: '2026-09-05T12:00:00.000Z',
    breakMinutes: 0, notes: '', status: 'clocked_in', ...overrides,
  };
}

describe('TimeScreen', () => {
  let tree: any;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-05T14:00:00.000Z'));
    mockPush.mockReset();
    mockRefresh.mockClear();
    mockClockingState.activeShiftWarnings.possibleForgottenClockOut = false;
    mockClockingState.timeCorrections = [];
    mockClockingState.timeEntries = [];
    mockClockingState.currentActiveEntryId = null;
    mockEffectiveClock = {
      activeEntry: null,
      effectiveActiveEntryId: null,
      effectiveStatus: 'clocked_out_synced',
      timeEntries: [],
      shiftStartedAt: undefined,
    };
    mockOfflineClock = undefined;
    mockPendingClockIn = {
      workflow: null, currentRequirement: null, currentForm: null,
      phase: { kind: 'no_pending_workflow' }, ensureCurrentForm: jest.fn(), finalize: jest.fn(),
    };
    mockPendingClockOut = { workflow: null, currentRequirement: null, currentForm: null };
  });

  afterEach(async () => {
    jest.useRealTimers();
    if (tree) await act(async () => tree.unmount());
    tree = undefined;
  });

  it('shows a safe-area clock-in workspace when not clocked in', async () => {
    await act(async () => { tree = create(<TimeScreen />); });
    expect(textOf(tree.root)).toContain('Not clocked in');
    expect(tree.root.findByType('primary-screen').props.edges).toEqual(['top', 'left', 'right']);
    expect(tree.root.findByType('primary-screen').props.scrollable).toBe(true);
    await act(async () => tree.root.findByType('primary-button').props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/clock-in');
  });

  it('shows shared active work and uses existing Clock Out and Switch Activity workflows', async () => {
    const active = entry();
    mockClockingState.timeEntries = [active];
    mockClockingState.currentActiveEntryId = 'entry-1';
    mockEffectiveClock = {
      activeEntry: active,
      effectiveActiveEntryId: 'entry-1',
      effectiveStatus: 'clocked_in_synced',
      timeEntries: [active],
      shiftStartedAt: active.clockIn,
    };
    await act(async () => { tree = create(<TimeScreen />); });

    const text = textOf(tree.root);
    expect(text).toContain('Clocked in');
    expect(text).toContain('Front Walkway');
    expect(text).toContain('Excavation');
    expect(text).toContain('2h 0m');
    await act(async () => tree.root.findByType('primary-button').props.onPress());
    await act(async () => tree.root.findByType('secondary-button').props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/clock-out');
    expect(mockPush).toHaveBeenCalledWith('/switch-activity');
  });

  it('shows business-local totals and only today entries newest first', async () => {
    const todayOld = entry({ id: 'today-old', clockIn: '2026-09-05T11:00:00.000Z', clockOut: '2026-09-05T12:00:00.000Z', status: 'clocked_out' });
    const todayNew = entry({ id: 'today-new', workType: 'drive_time', jobId: undefined, clockIn: '2026-09-05T13:00:00.000Z', clockOut: '2026-09-05T13:30:00.000Z', status: 'clocked_out' });
    const yesterday = entry({ id: 'yesterday', clockIn: '2026-09-05T02:00:00.000Z', clockOut: '2026-09-05T03:00:00.000Z', status: 'clocked_out' });
    mockEffectiveClock.timeEntries = [todayOld, yesterday, todayNew];
    await act(async () => { tree = create(<TimeScreen />); });

    expect(textOf(tree.root.findByProps({ testID: 'today-summary' }))).toContain('1h 30m');
    const rows = tree.root.findAllByType('pressable').filter((node: any) => typeof node.props.testID === 'string' && node.props.testID.startsWith('today-entry-'));
    expect(rows.map((row: any) => row.props.testID)).toEqual(['today-entry-today-new', 'today-entry-today-old']);
    expect(tree.root.findAllByProps({ testID: 'today-entry-yesterday' })).toHaveLength(0);
  });

  it('hides Needs attention when today has no issue', async () => {
    await act(async () => { tree = create(<TimeScreen />); });
    expect(tree.root.findAllByProps({ testID: 'time-attention' })).toHaveLength(0);
  });

  it('recovers pending required Forms through the existing form workflow', async () => {
    mockPendingClockIn = {
      workflow: { workflowOccurrenceId: 'occurrence-1' },
      currentRequirement: { requirementId: 'requirement-1' },
      currentForm: { id: 'form-1' },
      phase: { kind: 'requirements_outstanding', current: 1, total: 1 },
      ensureCurrentForm: jest.fn(), finalize: jest.fn(),
    };
    await act(async () => { tree = create(<TimeScreen />); });
    const attention = tree.root.findByProps({ testID: 'time-attention' });
    expect(textOf(attention)).toContain('Complete required clock-in form');
    expect(tree.root.findAllByType('primary-button')).toHaveLength(0);
    await act(async () => attention.findAllByType('pressable')[0].props.onPress());
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/form', params: expect.objectContaining({ formId: 'form-1', trigger: 'before_clock_in' }),
    }));
  });

  it('shows a pending clock-out Form and suppresses duplicate shift actions', async () => {
    const active = entry();
    mockClockingState.timeEntries = [active];
    mockClockingState.currentActiveEntryId = 'entry-1';
    mockEffectiveClock = {
      activeEntry: active, effectiveActiveEntryId: 'entry-1', effectiveStatus: 'clocked_in_synced',
      timeEntries: [active], shiftStartedAt: active.clockIn,
    };
    mockPendingClockOut = {
      workflow: { workflowOccurrenceId: 'clock-out-occurrence' },
      currentRequirement: { workflowRequirementId: 'clock-out-requirement' },
      currentForm: { id: 'clock-out-form' },
    };
    await act(async () => { tree = create(<TimeScreen />); });

    expect(textOf(tree.root)).toContain('Complete required clock-out form');
    expect(tree.root.findAllByType('primary-button')).toHaveLength(0);
    await act(async () => tree.root.findByProps({ testID: 'time-attention' }).findAllByType('pressable')[0].props.onPress());
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/form', params: {
      formId: 'clock-out-form', trigger: 'after_clock_out',
      workflowOccurrenceId: 'clock-out-occurrence', workflowRequirementId: 'clock-out-requirement',
    } });
  });

  it('shows missing clock-out and returned correction recovery', async () => {
    const active = entry();
    mockClockingState.timeEntries = [active];
    mockClockingState.currentActiveEntryId = 'entry-1';
    mockClockingState.activeShiftWarnings.possibleForgottenClockOut = true;
    mockClockingState.timeCorrections = [{ id: 'correction-1', status: 'rejected', timeEntryId: 'entry-old' }];
    mockEffectiveClock = {
      activeEntry: active, effectiveActiveEntryId: 'entry-1', effectiveStatus: 'clocked_in_synced',
      timeEntries: [active], shiftStartedAt: active.clockIn,
    };
    await act(async () => { tree = create(<TimeScreen />); });

    const attention = tree.root.findByProps({ testID: 'time-attention' });
    expect(textOf(attention)).toContain('Possible missing clock-out');
    expect(textOf(attention)).toContain('1 correction request was returned');
  });

  it('shows offline pending actions and clock conflicts with the existing recovery actions', async () => {
    const syncNow = jest.fn();
    mockOfflineClock = { effectiveState: { pendingCount: 2, currentShiftConflict: null }, syncNow, cache: null };
    await act(async () => { tree = create(<TimeScreen />); });
    expect(textOf(tree.root)).toContain('2 offline time changes are waiting to sync');
    await act(async () => tree.root.findByProps({ testID: 'time-attention' }).findAllByType('pressable')[0].props.onPress());
    expect(syncNow).toHaveBeenCalledTimes(1);

    await act(async () => tree.unmount());
    mockOfflineClock = {
      effectiveState: { pendingCount: 0, currentShiftConflict: { id: 'command-1', lastErrorCode: 'offline_shift_state_conflict' } },
      syncNow, cache: null,
    };
    await act(async () => { tree = create(<TimeScreen />); });
    expect(textOf(tree.root)).toContain('Clock conflict needs review');
    await act(async () => tree.root.findByProps({ testID: 'time-attention' }).findAllByType('pressable')[0].props.onPress());
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/offline-time-change', params: { commandId: 'command-1' } });
  });

  it('opens the existing full Time History route', async () => {
    await act(async () => { tree = create(<TimeScreen />); });
    const link = tree.root.findAllByType('pressable').find((node: any) => textOf(node).includes('View Time History'));
    await act(async () => link.props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/time-history');
  });
});