import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

let mockParams: any = {};
let mockCorrectionLoading = false;
const mockSubmitCorrection = jest.fn();
const mockClockOut = jest.fn();
const mockResolveCommandWithCorrection = jest.fn();
const mockLoadUnbillableCategoriesIfNeeded = jest.fn().mockResolvedValue(undefined);

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
  businessTimeZone: 'America/Toronto',
  currentActiveEntryId: null as string | null,
  activeShiftWarnings: {
    possibleForgottenClockOut: false,
    thresholdHours: 12,
  },
  timeCorrections: [],
  jobs: [{ id: 'job-1', title: 'Front Walkway', status: 'scheduled', assignedEmployeeIds: ['emp-1'] }],
  timeEntries: [
    {
      id: 'entry-1',
      employeeId: 'emp-1',
      jobId: 'job-1',
      workType: 'job',
      clockIn: '2026-08-07T07:30:00.000Z',
      clockOut: '2026-08-07T22:00:00.000Z',
      breakMinutes: 0,
      notes: '',
      status: 'clocked_out',
    },
    {
      id: 'entry-active',
      employeeId: 'emp-1',
      jobId: 'job-1',
      workType: 'job',
      clockIn: '2026-08-07T07:30:00.000Z',
      breakMinutes: 0,
      notes: '',
      status: 'clocked_in',
    },
  ],
};

const mockUseClockingStore = jest.fn(() => mockClockingState);

const mockUseClockingActions = jest.fn(() => ({
  clockOut: mockClockOut,
  loading: false,
}));

const mockUseTimeCorrectionActions = jest.fn(() => ({
  submitCorrection: mockSubmitCorrection,
  loading: mockCorrectionLoading,
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

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  router: {
    replace: jest.fn(),
    push: jest.fn(),
  },
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

jest.mock('@/store/clockingStore', () => ({
  useClockingStore: () => mockUseClockingStore(),
}));

jest.mock('@/store/offlineClockContext', () => ({
  useOptionalOfflineClockStore: () => ({ resolveCommandWithCorrection: mockResolveCommandWithCorrection }),
}));

jest.mock('@/hooks/useClockingActions', () => ({
  useClockingActions: () => mockUseClockingActions(),
}));

jest.mock('@/hooks/useTimeCorrectionActions', () => ({
  useTimeCorrectionActions: () => mockUseTimeCorrectionActions(),
}));

jest.mock('@/hooks/useUnbillableCategories', () => ({
  useUnbillableCategories: () => mockUseUnbillableCategories(),
}));

jest.mock('@/services/requestGuards', () => ({
  createRequestMeta: () => ({ requestId: 'req-1', idempotencyKey: 'key-1' }),
}));

jest.mock('@/components/Screen', () => ({
  Screen: ({ children }: any) => require('react').createElement('screen', {}, children),
}));

jest.mock('@/components/StatusBanner', () => ({
  StatusBanner: ({ message }: any) => require('react').createElement('status-banner', { message }),
}));

jest.mock('@/components/PrimaryActionButton', () => ({
  PrimaryActionButton: ({ label, disabled, onPress }: any) =>
    require('react').createElement('primary-button', { label, disabled: !!disabled, onPress }),
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
    TextInput: ({ value, onChangeText, testID, placeholder }: any) => React.createElement('textinput', { value, onChangeText, testID, placeholder }),
    Pressable: ({ children, onPress, testID }: any) => React.createElement('pressable', { onPress, testID }, children),
    ActivityIndicator: () => React.createElement('activity-indicator', {}),
  };
});

import RequestTimeCorrectionScreen from '../../app/request-time-correction';

describe('RequestTimeCorrectionScreen', () => {
  beforeEach(() => {
    mockParams = {};
    mockCorrectionLoading = false;
    mockClockingState.currentActiveEntryId = null;
    mockSubmitCorrection.mockReset();
    mockClockOut.mockReset();
    mockResolveCommandWithCorrection.mockReset();
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
    mockSubmitCorrection.mockResolvedValue({ ok: true, correction: { id: 'corr-1' } });
    mockClockOut.mockResolvedValue({ ok: true });
    mockUseAuthStore.mockReturnValue({
      user: {
        id: 'u-1',
        businessId: 'biz-1',
        name: 'Alex',
        email: 'a@x.com',
        role: 'crew_member',
        businessName: 'OliveOps',
        employeeId: 'emp-1',
      },
    });
  });

  it('submits correction request for existing entry', async () => {
    mockParams = { timeEntryId: 'entry-1' };

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(RequestTimeCorrectionScreen));
    });

    const reason = tree.root.findAllByType('textinput').find((node: any) => node.props.testID === 'correction-reason-input');
    await act(async () => {
      reason.props.onChangeText('I entered wrong time.');
    });

    const submit = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Submit Request');
    await act(async () => {
      await submit.props.onPress();
    });

    expect(mockSubmitCorrection).toHaveBeenCalled();
    expect(mockSubmitCorrection.mock.calls[0][0]).toMatchObject({
      timeEntryId: 'entry-1',
      requestType: 'wrong_time',
    });
  });

  it('shows forgot clock-out field and clock-out-first flow when user is still clocked in', async () => {
    mockParams = { requestType: 'forgot_clock_out' };
    mockClockingState.currentActiveEntryId = 'entry-active';

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(RequestTimeCorrectionScreen));
    });

    const banners = tree.root.findAllByType('status-banner');
    expect(banners[0].props.message).toBe('You are still clocked in.');

    const renderedText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(renderedText).toContain('What time did you actually finish?');

    const submit = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Submit Request');
    expect(submit.props.disabled).toBe(true);
  });

  it('prefills a failed offline clock-out timestamp', async () => {
    mockParams = {
      requestType: 'forgot_clock_out',
      timeEntryId: 'entry-active',
      intendedAt: '2026-08-23T14:04:00.000Z',
      offlineAction: 'clock_out',
    };
    mockClockingState.currentActiveEntryId = 'entry-active';

    let tree: any;
    await act(async () => {
      tree = create(<RequestTimeCorrectionScreen />);
    });

    const inputs = tree.root.findAllByType('textinput');
    expect(inputs.some((node: any) => node.props.value === '10:04')).toBe(true);
  });

  it('does not work around an active offline conflict by clocking out at the current time', async () => {
    mockParams = {
      requestType: 'forgot_clock_out',
      timeEntryId: 'entry-active',
      intendedAt: '2026-08-23T14:03:00.000Z',
      offlineAction: 'clock_out',
      offlineCommandId: 'failed-out',
    };
    mockClockingState.currentActiveEntryId = 'entry-active';

    let tree: any;
    await act(async () => {
      tree = create(<RequestTimeCorrectionScreen />);
    });

    expect(tree.root.findAllByType('status-banner').map((node: any) => node.props.message))
      .toContain('This shift is still active on the server. A correction cannot be requested until active-shift correction support is available.');
    expect(tree.root.findAllByType('primary-button').some(
      (node: any) => node.props.label === 'Clock Out & Request Correction',
    )).toBe(false);
    expect(mockClockOut).not.toHaveBeenCalled();
  });

  it('submits against a mapped server entry omitted from bootstrap and resolves the offline command', async () => {
    mockParams = {
      timeEntryId: 'mapped-entry-not-loaded',
      offlineCommandId: 'failed-out',
      localShiftId: 'local-shift-1',
      requestType: 'forgot_clock_out',
      intendedAt: '2026-08-23T14:03:00.000Z',
      offlineAction: 'clock_out',
      offlineReason: 'Offline clock-out could not sync.',
    };

    let tree: any;
    await act(async () => {
      tree = create(<RequestTimeCorrectionScreen />);
    });

    expect(tree.root.findByProps({ testID: 'correction-reason-input' }).props.value)
      .toBe('Offline clock-out could not sync.');
    await act(async () => {
      await tree.root.findAllByType('primary-button')
        .find((node: any) => node.props.label === 'Submit Request').props.onPress();
    });

    expect(mockSubmitCorrection).toHaveBeenCalledWith(expect.objectContaining({
      timeEntryId: 'mapped-entry-not-loaded',
      requestType: 'forgot_clock_out',
      requestedClockOutAt: '2026-08-23T14:03:00.000Z',
    }));
    expect(mockResolveCommandWithCorrection).toHaveBeenCalledWith('failed-out', 'corr-1');
    expect(tree.root.findAllByType('status-banner').map((node: any) => node.props.message))
      .not.toContain('A historical entry is required for this correction type.');
  });

  it('clock out and request correction clocks out before creating correction', async () => {
    mockParams = { requestType: 'forgot_clock_out' };
    mockClockingState.currentActiveEntryId = 'entry-active';

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(RequestTimeCorrectionScreen));
    });

    const action = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock Out & Request Correction');
    await act(async () => {
      await action.props.onPress();
    });

    expect(mockClockOut).toHaveBeenCalledTimes(1);
    expect(mockSubmitCorrection).not.toHaveBeenCalled();
  });

  it('failed clock-out prevents correction creation in clock-out-first flow', async () => {
    mockParams = { requestType: 'forgot_clock_out' };
    mockClockingState.currentActiveEntryId = 'entry-active';
    mockClockOut.mockResolvedValue({ ok: false, error: 'Clock-out failed.' });

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(RequestTimeCorrectionScreen));
    });

    const action = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Clock Out & Request Correction');
    await act(async () => {
      await action.props.onPress();
    });

    expect(mockClockOut).toHaveBeenCalledTimes(1);
    expect(mockSubmitCorrection).not.toHaveBeenCalled();
  });

  it('submits missing-time forgot clock-in request without timeEntryId', async () => {
    mockParams = { requestType: 'forgot_clock_in' };

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(RequestTimeCorrectionScreen));
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'job-option-job-1' })[0].props.onPress();
    });

    const reason = tree.root.findAllByType('textinput').find((node: any) => node.props.testID === 'correction-reason-input');
    await act(async () => {
      reason.props.onChangeText('Forgot to clock in this morning.');
    });

    const submit = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Submit Request');
    await act(async () => {
      await submit.props.onPress();
    });

    expect(mockSubmitCorrection).toHaveBeenCalled();
    expect(mockSubmitCorrection.mock.calls[0][0].timeEntryId).toBeUndefined();
    expect(mockSubmitCorrection.mock.calls[0][0].requestType).toBe('forgot_clock_in');
  });

  it('offers Drive Time without capability data and submits its canonical activity type', async () => {
    mockParams = { requestType: 'wrong_activity', timeEntryId: 'entry-1' };

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(RequestTimeCorrectionScreen));
    });

    const driveOption = tree.root.findAllByProps({ testID: 'activity-option-drive_time' });
    expect(driveOption.length).toBeGreaterThan(0);

    await act(async () => {
      driveOption[0].props.onPress();
    });

    const reason = tree.root.findAllByType('textinput').find((node: any) => node.props.testID === 'correction-reason-input');
    await act(async () => {
      reason.props.onChangeText('This entry should be Drive Time.');
    });

    const submit = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Submit Request');
    await act(async () => {
      await submit.props.onPress();
    });

    expect(mockSubmitCorrection).toHaveBeenCalledWith(expect.objectContaining({
      timeEntryId: 'entry-1',
      requestType: 'wrong_activity',
      requestedActivityType: 'drive_time',
    }));
  });

  it('prevents duplicate submit taps while submitting', async () => {
    mockParams = { timeEntryId: 'entry-1' };
    mockCorrectionLoading = true;

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(RequestTimeCorrectionScreen));
    });

    const submit = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Submitting...');
    expect(submit.props.disabled).toBe(true);
  });

  it('requires unbillable category for non-billable activity corrections', async () => {
    mockParams = { requestType: 'wrong_activity', timeEntryId: 'entry-1' };

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(RequestTimeCorrectionScreen));
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'activity-option-non_billable' })[0].props.onPress();
    });

    const reason = tree.root.findAllByType('textinput').find((node: any) => node.props.testID === 'correction-reason-input');
    await act(async () => {
      reason.props.onChangeText('Should be non-billable training.');
    });

    const submit = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Submit Request');
    expect(submit.props.disabled).toBe(true);
  });

  it('submits requestedUnbillableCategoryId for non-billable activity correction', async () => {
    mockParams = { requestType: 'wrong_activity', timeEntryId: 'entry-1' };

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(RequestTimeCorrectionScreen));
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'activity-option-non_billable' })[0].props.onPress();
    });

    await act(async () => {
      tree.root.findAllByProps({ testID: 'unbillable-category-option-cat-training' })[0].props.onPress();
    });

    const reason = tree.root.findAllByType('textinput').find((node: any) => node.props.testID === 'correction-reason-input');
    await act(async () => {
      reason.props.onChangeText('Should be non-billable training.');
    });

    const submit = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Submit Request');
    await act(async () => {
      await submit.props.onPress();
    });

    expect(mockSubmitCorrection).toHaveBeenCalled();
    expect(mockSubmitCorrection.mock.calls[0][0]).toMatchObject({
      requestType: 'wrong_activity',
      requestedActivityType: 'non_billable',
      requestedUnbillableCategoryId: 'cat-training',
    });
  });
});
