import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockLoadBootstrap = jest.fn();
const mockClockIn = jest.fn();
const mockClockOut = jest.fn();
const mockSwitchActivity = jest.fn();
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
  switchActivity: (...args: unknown[]) => mockSwitchActivity(...args),
}));

jest.mock('@/services/connectivity', () => ({
  isOnline: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    accessToken: 'token-1',
    user: authenticatedUser,
  }),
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
    mockSwitchActivity.mockReset();
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
});
