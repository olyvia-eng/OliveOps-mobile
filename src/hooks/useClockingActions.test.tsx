import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockLoadBootstrap = jest.fn();
const mockClockIn = jest.fn();
const mockClockOut = jest.fn();
const mockLoadPendingClockIn = jest.fn();
const mockLoadPendingClockOut = jest.fn();
const mockSwitchActivity = jest.fn();
const mockUpdateEligibilityCache = jest.fn().mockResolvedValue(undefined);
const mockIsOnline = jest.fn().mockResolvedValue(true);
let mockOfflineClock: any;
const authenticatedUser = {
  id: 'user-1',
  businessId: 'biz-1',
  name: 'Alex',
  email: 'alex@oliveops.ca',
  role: 'crew_member',
  businessName: 'OliveOps',
  employeeId: 'emp-1',
};

jest.mock('@/api/clockingApi', () => ({
  loadBootstrap: (...args: unknown[]) => mockLoadBootstrap(...args),
  clockIn: (...args: unknown[]) => mockClockIn(...args),
  clockOut: (...args: unknown[]) => mockClockOut(...args),
  loadPendingClockIn: (...args: unknown[]) => mockLoadPendingClockIn(...args),
  loadPendingClockOut: (...args: unknown[]) => mockLoadPendingClockOut(...args),
  switchActivity: (...args: unknown[]) => mockSwitchActivity(...args),
}));

jest.mock('@/services/connectivity', () => ({
  isOnline: (...args: unknown[]) => mockIsOnline(...args),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    accessToken: 'token-1',
    user: authenticatedUser,
  }),
}));

jest.mock('@/store/offlineClockContext', () => ({
  useOptionalOfflineClockStore: () => mockOfflineClock,
}));

import { useClockingActions } from '@/hooks/useClockingActions';
import { ClockingProvider, useClockingStore } from '@/store/clockingStore';

let currentActions: ReturnType<typeof useClockingActions>;

function ActionsProbe({ refreshOnMount = false }: { refreshOnMount?: boolean }) {
  currentActions = useClockingActions();
  const { currentActiveEntryId } = useClockingStore();

  useEffect(() => {
    if (refreshOnMount) {
      void currentActions.refreshWorkContext();
    }
  }, [refreshOnMount, currentActions.refreshWorkContext]);

  return React.createElement('actions-probe', { currentActiveEntryId });
}

function activeEntry(id = 'entry-1') {
  return {
    id,
    employeeId: 'emp-1',
    workType: 'job' as const,
    jobIds: ['job-1'],
    clockIn: '2026-08-17T10:00:00.000Z',
    breakMinutes: 0,
    notes: '',
    status: 'clocked_in' as const,
  };
}

function bootstrapPayload(entry = activeEntry()) {
  return {
    ok: true,
    jobs: [{ id: 'job-1', title: 'Job 1', status: 'scheduled', assignedEmployeeIds: ['emp-1'] }],
    timeEntries: [entry],
    timeCorrections: [],
    currentActiveEntryId: entry.id,
    activeShiftWarnings: { possibleForgottenClockOut: false, thresholdHours: 12 },
    activityConfigs: [],
  };
}

describe('useClockingActions bootstrap behavior', () => {
  let tree: ReactTestRenderer | undefined;

  beforeEach(() => {
    mockLoadBootstrap.mockReset();
    mockClockIn.mockReset();
    mockClockOut.mockReset();
    mockLoadPendingClockIn.mockReset();
    mockLoadPendingClockOut.mockReset();
    mockSwitchActivity.mockReset();
    mockUpdateEligibilityCache.mockClear();
    mockIsOnline.mockReset().mockResolvedValue(true);
    mockOfflineClock = undefined;
    mockLoadBootstrap.mockResolvedValue(bootstrapPayload());
    mockClockIn.mockResolvedValue({ ok: true, timeEntry: activeEntry() });
    mockSwitchActivity.mockResolvedValue({ ok: true, timeEntry: activeEntry('entry-2') });
    mockClockOut.mockResolvedValue({
      ok: true,
      timeEntry: { ...activeEntry('entry-2'), status: 'clocked_out', clockOut: '2026-08-17T14:00:00.000Z' },
    });
    tree = undefined;
  });

  afterEach(async () => {
    if (!tree) return;
    await act(async () => {
      tree?.unmount();
    });
    tree = undefined;
  });

  it('does not retrigger a mount refresh after bootstrap populates provider state', async () => {
    await act(async () => {
      tree = create(
        React.createElement(
          ClockingProvider,
          null,
          React.createElement(ActionsProbe, { refreshOnMount: true })
        )
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockLoadBootstrap).toHaveBeenCalledTimes(1);
  });

  it('updates offline eligibility only after a successful bootstrap', async () => {
    mockOfflineClock = { updateEligibilityCache: mockUpdateEligibilityCache };
    await act(async () => {
      tree = create(
        React.createElement(ClockingProvider, null, React.createElement(ActionsProbe))
      );
    });

    await act(async () => {
      await currentActions.refreshWorkContext();
    });
    expect(mockUpdateEligibilityCache).toHaveBeenCalledWith({
      jobs: bootstrapPayload().jobs,
      activityConfigs: [],
      requiredBeforeClockInForms: undefined,
      requiredAfterClockOutForms: undefined,
    });

    mockUpdateEligibilityCache.mockClear();
    mockLoadBootstrap.mockRejectedValueOnce(new TypeError('offline'));
    await act(async () => {
      await currentActions.refreshWorkContext();
    });
    expect(mockUpdateEligibilityCache).not.toHaveBeenCalled();
  });

  it('reconciles after each mutation without retriggering mount refreshes', async () => {
    await act(async () => {
      tree = create(
        React.createElement(ClockingProvider, null, React.createElement(ActionsProbe))
      );
    });

    await act(async () => {
      await currentActions.refreshWorkContext();
      await currentActions.refreshWorkContext();
      await currentActions.clockIn('emp-1', 'job', ['job-1']);
      await currentActions.refreshWorkContext();
      await currentActions.switchActivity('job', ['job-1']);
      await currentActions.refreshWorkContext();
      await currentActions.clockOut('entry-2', '', []);
      await currentActions.refreshWorkContext();
    });

    expect(mockLoadBootstrap).toHaveBeenCalledTimes(8);
    expect(mockClockIn).toHaveBeenCalledTimes(1);
    expect(mockSwitchActivity).toHaveBeenCalledTimes(1);
    expect(mockClockOut).toHaveBeenCalledTimes(1);
  });

  it('does not let a pre-mutation bootstrap overwrite newer clock-in state', async () => {
    let resolveStaleBootstrap!: (value: ReturnType<typeof bootstrapPayload>) => void;
    const staleBootstrap = new Promise<ReturnType<typeof bootstrapPayload>>((resolve) => {
      resolveStaleBootstrap = resolve;
    });
    mockLoadBootstrap
      .mockReturnValueOnce(staleBootstrap)
      .mockResolvedValueOnce(bootstrapPayload(activeEntry('entry-new')));
    mockClockIn.mockResolvedValue({ ok: true, timeEntry: activeEntry('entry-new') });

    await act(async () => {
      tree = create(
        React.createElement(ClockingProvider, null, React.createElement(ActionsProbe))
      );
    });

    const staleRefresh = currentActions.refreshWorkContext();
    await act(async () => {
      await currentActions.clockIn('emp-1', 'job', ['job-1']);
    });

    resolveStaleBootstrap(bootstrapPayload(activeEntry('entry-old')));
    await act(async () => {
      await staleRefresh;
    });

    expect(tree.root.findByType('actions-probe').props.currentActiveEntryId).toBe('entry-new');
  });

  it('uses the direct API for online clock-in even when the offline provider is mounted', async () => {
    const submitClockIn = jest.fn();
    mockOfflineClock = { cache: { requiredBeforeClockInForms: false }, submitClockIn };
    await act(async () => {
      tree = create(React.createElement(ClockingProvider, null, React.createElement(ActionsProbe)));
    });

    let result: any;
    await act(async () => { result = await currentActions.clockIn('emp-1', 'job', ['job-1']); });

    expect(result.ok).toBe(true);
    expect(mockClockIn).toHaveBeenCalledTimes(1);
    expect(submitClockIn).not.toHaveBeenCalled();
    expect(tree.root.findByType('actions-probe').props.currentActiveEntryId).toBe('entry-1');
  });

  it('returns a pending required clock-in workflow without requiring a time entry', async () => {
    const pendingWorkflow = {
      ok: true,
      blocked: true as const,
      status: 'clock_in_pending_required_forms' as const,
      workflowOccurrenceId: 'clock-in-occurrence-1',
      requiredFormCount: 1,
      completedRequiredFormCount: 0,
      remainingRequiredFormCount: 1,
      requiredForms: [{ requirementId: 'requirement-1', formId: 'form-1' }],
      remainingForms: [{ requirementId: 'requirement-1', formId: 'form-1' }],
      reminderForms: [],
      clockInIntent: { employeeId: 'emp-1', workType: 'job' as const, jobIds: ['job-1'] },
    };
    const submitClockIn = jest.fn();
    mockOfflineClock = { cache: { requiredBeforeClockInForms: true }, submitClockIn };
    mockClockIn.mockResolvedValue(pendingWorkflow);
    await act(async () => {
      tree = create(React.createElement(ClockingProvider, null, React.createElement(ActionsProbe)));
    });

    let result: any;
    await act(async () => {
      result = await currentActions.clockIn('emp-1', 'job', ['job-1']);
    });

    expect(result).toEqual({ ok: true, pendingWorkflow });
    expect(submitClockIn).not.toHaveBeenCalled();
    expect(tree.root.findByType('actions-probe').props.currentActiveEntryId).toBeNull();
    expect(mockLoadBootstrap).not.toHaveBeenCalled();
  });

  it('fails closed offline when required before-clock-in support is unknown', async () => {
    const submitClockIn = jest.fn();
    mockOfflineClock = { cache: {}, submitClockIn };
    mockIsOnline.mockResolvedValue(false);
    await act(async () => {
      tree = create(React.createElement(ClockingProvider, null, React.createElement(ActionsProbe)));
    });

    let result: any;
    await act(async () => { result = await currentActions.clockIn('emp-1', 'job', ['job-1']); });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Connection required to clock in');
    expect(submitClockIn).not.toHaveBeenCalled();
  });

  it('preserves actual offline clock-in when authoritative capability disables required forms', async () => {
    const submitClockIn = jest.fn().mockResolvedValue({ ok: true, pendingSync: true });
    mockOfflineClock = { cache: { requiredBeforeClockInForms: false }, submitClockIn };
    mockIsOnline.mockResolvedValue(false);
    await act(async () => {
      tree = create(React.createElement(ClockingProvider, null, React.createElement(ActionsProbe)));
    });

    let result: any;
    await act(async () => { result = await currentActions.clockIn('emp-1', 'job', ['job-1']); });

    expect(result).toEqual({ ok: true, pendingSync: true });
    expect(submitClockIn).toHaveBeenCalledWith(
      { employeeId: 'emp-1', workType: 'job', jobIds: ['job-1'], unbillableCategoryId: undefined },
      expect.objectContaining({ requestId: expect.any(String), idempotencyKey: expect.any(String) }),
    );
    expect(mockClockIn).not.toHaveBeenCalled();
  });

  it('recovers a pending mandatory clock-out instead of reporting a generic clock-in error', async () => {
    const { ApiError } = require('@/types/errors');
    const pendingClockOutWorkflow = {
      ok: true, blocked: true, status: 'clock_out_pending_required_forms', workflowOccurrenceId: 'clock-out-occurrence',
      intendedClockOutAt: '2026-08-25T18:00:00.000Z', requirements: [],
    };
    mockClockIn.mockRejectedValue(new ApiError('Finish clock out', 409, 'pending_clock_out_exists'));
    mockLoadPendingClockOut.mockResolvedValue(pendingClockOutWorkflow);
    await act(async () => {
      tree = create(React.createElement(ClockingProvider, null, React.createElement(ActionsProbe)));
    });

    let result: any;
    await act(async () => { result = await currentActions.clockIn('emp-1', 'job', ['job-1']); });

    expect(result).toEqual({ ok: true, pendingClockOutWorkflow });
    expect(tree.root.findByType('actions-probe').props.currentActiveEntryId).toBeNull();
  });

  it('recovers an existing pending clock-in occurrence instead of creating another one', async () => {
    const { ApiError } = require('@/types/errors');
    const pendingWorkflow = {
      ok: true, blocked: true, status: 'clock_in_pending_required_forms', workflowOccurrenceId: 'existing-occurrence',
      requiredFormCount: 1, completedRequiredFormCount: 0, remainingRequiredFormCount: 1,
      requiredForms: [{ requirementId: 'requirement-1', formId: 'form-1' }],
      remainingForms: [{ requirementId: 'requirement-1', formId: 'form-1' }], reminderForms: [],
      clockInIntent: { employeeId: 'emp-1', workType: 'job', jobIds: ['job-1'] },
    };
    mockClockIn.mockRejectedValue(new ApiError('Existing clock-in workflow', 409, 'pending_clock_in_exists'));
    mockLoadPendingClockIn.mockResolvedValue(pendingWorkflow);
    await act(async () => {
      tree = create(React.createElement(ClockingProvider, null, React.createElement(ActionsProbe)));
    });

    let result: any;
    await act(async () => { result = await currentActions.clockIn('emp-1', 'job', ['job-1']); });

    expect(result).toEqual({ ok: true, pendingWorkflow });
    expect(mockClockIn).toHaveBeenCalledTimes(1);
  });

  it('rejects switch activity while clock-out is in progress', async () => {
    let resolveClockOut!: (value: { ok: boolean; timeEntry: ReturnType<typeof activeEntry> }) => void;
    mockClockOut.mockReturnValue(new Promise((resolve) => {
      resolveClockOut = resolve;
    }));
    mockLoadBootstrap.mockResolvedValue(bootstrapPayload({
      ...activeEntry('entry-1'),
      status: 'clocked_out',
      clockOut: '2026-08-17T14:00:00.000Z',
    }));

    await act(async () => {
      tree = create(
        React.createElement(ClockingProvider, null, React.createElement(ActionsProbe))
      );
    });

    let pendingClockOut!: ReturnType<typeof currentActions.clockOut>;
    await act(async () => {
      pendingClockOut = currentActions.clockOut('entry-1', '', []);
      await Promise.resolve();
    });
    const switchResult = await currentActions.switchActivity('job', ['job-1']);
    expect(switchResult).toEqual({
      ok: false,
      error: 'Another clocking action is already in progress.',
    });
    expect(mockSwitchActivity).not.toHaveBeenCalled();

    resolveClockOut({
      ok: true,
      timeEntry: {
        ...activeEntry('entry-1'),
        status: 'clocked_out',
        clockOut: '2026-08-17T14:00:00.000Z',
      },
    });
    await act(async () => {
      await pendingClockOut;
    });
  });

  it('returns a pending required-form workflow without clearing the active shift', async () => {
    const pendingWorkflow = {
      ok: true,
      status: 'clock_out_pending_required_forms' as const,
      blocked: true as const,
      workflowOccurrenceId: 'occurrence-1',
      intendedClockOutAt: '2026-08-17T14:00:00.000Z',
      requirements: [],
    };
    mockClockOut.mockResolvedValue(pendingWorkflow);
    await act(async () => {
      tree = create(React.createElement(ClockingProvider, null, React.createElement(ActionsProbe)));
    });
    await act(async () => {
      await currentActions.refreshWorkContext();
    });

    let result: any;
    await act(async () => {
      result = await currentActions.clockOut('entry-1', '', []);
    });

    expect(result).toEqual({ ok: true, pendingWorkflow });
    expect(tree.root.findByType('actions-probe').props.currentActiveEntryId).toBe('entry-1');
  });

  it('recovers the existing occurrence when a duplicate clock-out reports pending_clock_out_exists', async () => {
    const { ApiError } = require('@/types/errors');
    const pendingWorkflow = {
      ok: true,
      status: 'clock_out_pending_required_forms',
      blocked: true,
      workflowOccurrenceId: 'occurrence-existing',
      intendedClockOutAt: '2026-08-17T14:00:00.000Z',
      requirements: [],
    };
    mockClockOut.mockRejectedValue(new ApiError('Existing workflow', 409, 'pending_clock_out_exists'));
    mockLoadPendingClockOut.mockResolvedValue(pendingWorkflow);
    await act(async () => {
      tree = create(React.createElement(ClockingProvider, null, React.createElement(ActionsProbe)));
    });

    let result: any;
    await act(async () => { result = await currentActions.clockOut('entry-1', '', []); });

    expect(result).toEqual({ ok: true, pendingWorkflow });
    expect(mockLoadPendingClockOut).toHaveBeenCalledWith('token-1');
  });
});
