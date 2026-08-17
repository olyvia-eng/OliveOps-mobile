import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it } from '@jest/globals';
import { ClockingProvider, useClockingStore } from '@/store/clockingStore';

let currentStore: ReturnType<typeof useClockingStore>;

function ClockingProbe() {
  currentStore = useClockingStore();
  return React.createElement('clocking-probe', {
    jobCount: currentStore.jobs.length,
    timeEntryCount: currentStore.timeEntries.length,
  });
}

describe('ClockingProvider', () => {
  it('keeps custom action identities stable after bootstrap-style state updates', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        React.createElement(ClockingProvider, null, React.createElement(ClockingProbe))
      );
    });

    const initialActions = {
      resetUnbillableCategories: currentStore.resetUnbillableCategories,
      setActiveShiftWarnings: currentStore.setActiveShiftWarnings,
      setUnbillableCategories: currentStore.setUnbillableCategories,
      upsertTimeEntry: currentStore.upsertTimeEntry,
    };

    await act(async () => {
      currentStore.setJobs([
        { id: 'job-1', title: 'Job 1', status: 'scheduled', assignedEmployeeIds: ['emp-1'] },
      ]);
      currentStore.setTimeEntries([
        {
          id: 'entry-1',
          employeeId: 'emp-1',
          workType: 'job',
          jobIds: ['job-1'],
          clockIn: '2026-08-17T10:00:00.000Z',
          breakMinutes: 0,
          notes: '',
          status: 'clocked_in',
        },
      ]);
      currentStore.setActiveShiftWarnings({
        possibleForgottenClockOut: true,
        thresholdHours: 10,
      });
      currentStore.setUnbillableCategories([], 'biz-1');
      currentStore.upsertTimeEntry({
        id: 'entry-1',
        employeeId: 'emp-1',
        workType: 'job',
        jobIds: ['job-1'],
        clockIn: '2026-08-17T10:00:00.000Z',
        breakMinutes: 0,
        notes: 'updated',
        status: 'clocked_in',
      });
    });

    expect(currentStore.resetUnbillableCategories).toBe(initialActions.resetUnbillableCategories);
    expect(currentStore.setActiveShiftWarnings).toBe(initialActions.setActiveShiftWarnings);
    expect(currentStore.setUnbillableCategories).toBe(initialActions.setUnbillableCategories);
    expect(currentStore.upsertTimeEntry).toBe(initialActions.upsertTimeEntry);
    expect(tree.root.findByType('clocking-probe').props.jobCount).toBe(1);
    expect(tree.root.findByType('clocking-probe').props.timeEntryCount).toBe(1);
  });
});
