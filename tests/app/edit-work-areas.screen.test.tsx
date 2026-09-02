import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ApiError } from '@/types/errors';

const mockLoadTimeline = jest.fn();
const mockReconcile = jest.fn();
const mockIsOnline = jest.fn();
const mockSetTimeEntries = jest.fn();
const mockSetCurrentActiveEntryId = jest.fn();
const mockSetClockingCapabilities = jest.fn();
const mockDispatch = jest.fn();
let beforeRemove: ((event: any) => void) | undefined;

const timeline = [
  {
    id: 'entry-job-a', employeeId: 'emp-1', workType: 'job', jobId: 'job-a', jobIds: ['job-a'],
    workAreaId: 'area-excavation', workAreaNameSnapshot: 'Excavation', clockIn: '2026-09-02T11:00:00.000Z',
    clockOut: '2026-09-02T13:00:00.000Z', breakMinutes: 0, notes: '', status: 'clocked_out',
  },
  {
    id: 'entry-drive', employeeId: 'emp-1', workType: 'drive_time', jobIds: [], clockIn: '2026-09-02T13:00:00.000Z',
    clockOut: '2026-09-02T13:30:00.000Z', breakMinutes: 0, notes: '', status: 'clocked_out',
  },
  {
    id: 'entry-job-b', employeeId: 'emp-1', workType: 'job', jobId: 'job-b', jobIds: ['job-b'],
    workAreaId: 'area-grading', workAreaNameSnapshot: 'Grading', clockIn: '2026-09-02T13:30:00.000Z',
    breakMinutes: 0, notes: '', status: 'clocked_in',
  },
] as any[];

let mockClockingState: any;

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn() },
  useNavigation: () => ({
    addListener: (_event: string, listener: (event: any) => void) => {
      beforeRemove = listener;
      return jest.fn();
    },
    dispatch: (...args: unknown[]) => mockDispatch(...args),
  }),
}));

jest.mock('@/api/clockingApi', () => ({
  loadCurrentShiftWorkAreaTimeline: (...args: unknown[]) => mockLoadTimeline(...args),
  reconcileCurrentShiftWorkAreas: (...args: unknown[]) => mockReconcile(...args),
}));

jest.mock('@/services/connectivity', () => ({ isOnline: (...args: unknown[]) => mockIsOnline(...args) }));
jest.mock('@/services/requestGuards', () => ({ createRequestMeta: () => ({ requestId: 'stable-request-1', idempotencyKey: 'unused' }) }));
jest.mock('@/store/authStore', () => ({ useAuthStore: () => ({ accessToken: 'token-1', user: { employeeId: 'emp-1' } }) }));
jest.mock('@/store/clockingStore', () => ({ useClockingStore: () => mockClockingState }));

jest.mock('@/components/Screen', () => ({ Screen: ({ children }: any) => require('react').createElement('screen', {}, children) }));
jest.mock('@/components/StatusBanner', () => ({ StatusBanner: ({ message }: any) => require('react').createElement('status-banner', { message }) }));
jest.mock('@/components/PrimaryActionButton', () => ({
  PrimaryActionButton: ({ label, disabled, onPress }: any) => require('react').createElement('primary-button', { label, disabled, onPress }),
}));
jest.mock('@/components/SecondaryButton', () => ({
  SecondaryButton: ({ label, onPress }: any) => require('react').createElement('secondary-button', { label, onPress }),
}));
jest.mock('@/components/MobilePrimitives', () => ({
  ScreenHeader: ({ title }: any) => require('react').createElement('screen-header', { title }),
  SectionHeader: ({ title }: any) => require('react').createElement('section-header', { title }),
  StatusBadge: ({ label }: any) => require('react').createElement('status-badge', { label }),
  ListRow: ({ title, onPress, testID }: any) => require('react').createElement('list-row', { title, onPress, testID }),
}));

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: any) => require('react').createElement('date-time-picker', props),
}));

jest.mock('react-native', () => {
  const React = require('react');
  return {
    NativeModules: {},
    Platform: { OS: 'ios', select: (values: any) => values.ios ?? values.default },
    TurboModuleRegistry: { get: () => null },
    ActivityIndicator: () => React.createElement('activity-indicator', {}),
    Alert: { alert: jest.fn() },
    Modal: ({ visible, children }: any) => visible ? React.createElement('modal', {}, children) : null,
    Pressable: ({ children, onPress, testID, disabled, accessibilityState }: any) => React.createElement(
      'pressable', { onPress, testID, disabled, accessibilityState }, typeof children === 'function' ? children({ pressed: false }) : children,
    ),
    StyleSheet: { create: (value: unknown) => value, absoluteFill: {} },
    Text: ({ children }: any) => React.createElement('text', {}, children),
    View: ({ children, testID }: any) => React.createElement('view', { testID }, children),
  };
});

import EditWorkAreasScreen from '../../app/edit-work-areas';
import { Alert } from 'react-native';
import { router } from 'expo-router';

async function renderEditor() {
  let tree: any;
  await act(async () => { tree = create(<EditWorkAreasScreen />); });
  await act(async () => Promise.resolve());
  return tree;
}

describe('EditWorkAreasScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-02T15:30:00.000Z'));
    mockClockingState = {
      businessTimeZone: 'America/Toronto',
      clockingCapabilities: { adjustClockInTime: true, editShiftWorkAreas: true },
      currentActiveEntryId: 'entry-job-b',
      jobs: [
        { id: 'job-a', title: 'Smith Residence', status: 'scheduled', assignedEmployeeIds: ['emp-1'], eligibleOperationalWorkAreas: [
          { id: 'area-excavation', name: 'Excavation', status: 'in_progress' },
          { id: 'area-base', name: 'Base Prep', status: 'in_progress' },
        ] },
        { id: 'job-b', title: 'Warehouse', status: 'scheduled', assignedEmployeeIds: ['emp-1'], eligibleOperationalWorkAreas: [
          { id: 'area-grading', name: 'Grading', status: 'in_progress' },
          { id: 'area-cleanup', name: 'Cleanup', status: 'in_progress' },
        ] },
      ],
      timeEntries: [...timeline, { ...timeline[0], id: 'history', clockIn: '2026-09-01T11:00:00.000Z' }],
      setClockingCapabilities: mockSetClockingCapabilities,
      setCurrentActiveEntryId: mockSetCurrentActiveEntryId,
      setTimeEntries: mockSetTimeEntries,
    };
    mockIsOnline.mockReset().mockResolvedValue(true);
    mockLoadTimeline.mockReset().mockResolvedValue({ ok: true, timeline, activeEntryId: 'entry-job-b', timelineRevision: 'rev-1', canEdit: true });
    mockReconcile.mockReset();
    mockSetTimeEntries.mockReset();
    mockSetCurrentActiveEntryId.mockReset();
    mockSetClockingCapabilities.mockReset();
    mockDispatch.mockReset();
    (Alert.alert as jest.Mock).mockReset();
    (router.replace as jest.Mock).mockReset();
    (router.back as jest.Mock).mockReset();
    beforeRemove = undefined;
  });

  afterEach(() => jest.useRealTimers());

  it('shows Job Work with business times and marks Drive Time locked', async () => {
    const tree = await renderEditor();
    const text = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(text).toContain('Excavation');
    expect(text).toContain('Grading');
    expect(text).toContain('Drive Time');
    expect(tree.root.findAllByType('status-badge').map((node: any) => node.props.label)).toContain('Locked');
    expect(text).toMatch(/7:00/);
  });

  it('adds a Work Area change after choosing time then a Job-scoped Work Area', async () => {
    const tree = await renderEditor();
    await act(async () => tree.root.findByProps({ testID: 'split-segment-0' }).props.onPress());
    expect(tree.root.findAllByProps({ testID: 'work-area-option-area-base' })).toHaveLength(0);
    await act(async () => tree.root.findByProps({ testID: 'boundary-time-picker' }).props.onChange({}, new Date(2026, 8, 2, 8, 0)));
    await act(async () => tree.root.findByProps({ testID: 'boundary-done' }).props.onPress());
    const options = tree.root.findAllByType('list-row');
    expect(options.filter((node: any) => node.props.testID === 'work-area-option-area-base')).toHaveLength(1);
    expect(options.filter((node: any) => node.props.testID === 'work-area-option-area-cleanup')).toHaveLength(0);
    await act(async () => options.find((node: any) => node.props.testID === 'work-area-option-area-base').props.onPress());

    expect(tree.root.findAllByType('view').filter((node: any) => String(node.props.testID ?? '').startsWith('timeline-segment-'))).toHaveLength(4);
    expect(mockSetTimeEntries).not.toHaveBeenCalled();
  });

  it('changes an existing Work Area without changing its Job', async () => {
    const tree = await renderEditor();
    await act(async () => tree.root.findByProps({ testID: 'work-area-2' }).props.onPress());
    const options = tree.root.findAllByType('list-row');
    expect(options.filter((node: any) => node.props.testID === 'work-area-option-area-cleanup')).toHaveLength(1);
    expect(options.filter((node: any) => node.props.testID === 'work-area-option-area-base')).toHaveLength(0);
    await act(async () => options.find((node: any) => node.props.testID === 'work-area-option-area-cleanup').props.onPress());
    expect(tree.root.findAllByType('text').map((node: any) => String(node.props.children))).toContain('Cleanup');
  });

  it('changes one shared boundary in both adjacent submitted segments', async () => {
    const adjacent = [
      timeline[0],
      { ...timeline[0], id: 'entry-job-a-2', workAreaId: 'area-base', workAreaNameSnapshot: 'Base Prep', clockIn: '2026-09-02T13:00:00.000Z', clockOut: undefined, status: 'clocked_in' },
    ];
    mockLoadTimeline.mockResolvedValue({ ok: true, timeline: adjacent, activeEntryId: 'entry-job-a-2', timelineRevision: 'rev-adjacent', canEdit: true });
    mockReconcile.mockResolvedValue({ ok: true, timeline: adjacent, activeEntryId: 'entry-job-a-2', timelineRevision: 'rev-next' });
    const tree = await renderEditor();
    await act(async () => tree.root.findByProps({ testID: 'boundary-1' }).props.onPress());
    await act(async () => tree.root.findByProps({ testID: 'boundary-time-picker' }).props.onChange({}, new Date(2026, 8, 2, 9, 30)));
    await act(async () => tree.root.findByProps({ testID: 'boundary-done' }).props.onPress());
    await act(async () => tree.root.findByType('primary-button').props.onPress());

    const submitted = mockReconcile.mock.calls[0][0].segments;
    expect(submitted[0].endAt).toBe('2026-09-02T13:30:00.000Z');
    expect(submitted[1].startAt).toBe('2026-09-02T13:30:00.000Z');
  });

  it('keeps the timeline read-only when backend canEdit is false', async () => {
    mockLoadTimeline.mockResolvedValue({ ok: true, timeline, activeEntryId: 'entry-job-b', timelineRevision: 'rev-1', canEdit: false });
    const tree = await renderEditor();
    expect(tree.root.findByType('primary-button').props.disabled).toBe(true);
    expect(tree.root.findAllByProps({ testID: 'split-segment-0' })).toHaveLength(0);
    expect(tree.root.findAllByType('status-banner').some((node: any) => node.props.message === 'Work Area editing is not available for this shift.')).toBe(true);
  });

  it('warns on dirty exit and Cancel discards without mutating global entries', async () => {
    const tree = await renderEditor();
    await act(async () => tree.root.findByProps({ testID: 'work-area-2' }).props.onPress());
    await act(async () => tree.root.findByProps({ testID: 'work-area-option-area-cleanup' }).props.onPress());
    const preventDefault = jest.fn();
    await act(async () => beforeRemove?.({ preventDefault, data: { action: { type: 'GO_BACK' } } }));
    expect(preventDefault).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Discard changes?', "Your Work Area changes haven't been saved.", expect.any(Array));
    const discard = (Alert.alert as jest.Mock).mock.calls[0][2].find((item: any) => item.text === 'Discard');
    await act(async () => discard.onPress());
    expect(mockDispatch).toHaveBeenCalled();
    expect(mockSetTimeEntries).not.toHaveBeenCalled();
  });

  it('sends one stable request, prevents double Save, and installs only authoritative entries', async () => {
    let resolveSave!: (value: any) => void;
    mockReconcile.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
    const tree = await renderEditor();
    await act(async () => tree.root.findByProps({ testID: 'work-area-2' }).props.onPress());
    await act(async () => tree.root.findByProps({ testID: 'work-area-option-area-cleanup' }).props.onPress());
    const save = tree.root.findByType('primary-button');
    await act(async () => { void save.props.onPress(); void save.props.onPress(); await Promise.resolve(); });
    expect(mockReconcile).toHaveBeenCalledTimes(1);
    expect(mockReconcile).toHaveBeenCalledWith(expect.objectContaining({
      clientRequestId: 'stable-request-1', timelineRevision: 'rev-1', segments: expect.any(Array),
    }), 'token-1');

    const authoritative = [{ ...timeline[2], id: 'server-entry-new', workAreaId: 'area-cleanup', workAreaNameSnapshot: 'Cleanup' }];
    await act(async () => resolveSave({ ok: true, timeline: authoritative, activeEntryId: 'server-entry-new', timelineRevision: 'rev-2' }));
    expect(mockSetTimeEntries).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'server-entry-new' }),
      expect.objectContaining({ id: 'history' }),
    ]));
    expect(mockSetTimeEntries.mock.calls[0][0].some((entry: any) => entry.id === 'entry-job-b')).toBe(false);
    expect(mockSetCurrentActiveEntryId).toHaveBeenCalledWith('server-entry-new');
    expect(router.replace).toHaveBeenCalledWith('/clock-out');
  });

  it('refreshes instead of overwriting on a timeline concurrency conflict', async () => {
    mockReconcile.mockRejectedValue(new ApiError('changed', 409, 'shift_timeline_changed'));
    mockLoadTimeline
      .mockResolvedValueOnce({ ok: true, timeline, activeEntryId: 'entry-job-b', timelineRevision: 'rev-1', canEdit: true })
      .mockResolvedValueOnce({ ok: true, timeline: [{ ...timeline[2], workAreaNameSnapshot: 'Latest' }], activeEntryId: 'entry-job-b', timelineRevision: 'rev-2', canEdit: true });
    const tree = await renderEditor();
    await act(async () => tree.root.findByProps({ testID: 'work-area-2' }).props.onPress());
    await act(async () => tree.root.findByProps({ testID: 'work-area-option-area-cleanup' }).props.onPress());
    await act(async () => tree.root.findByType('primary-button').props.onPress());
    expect(mockLoadTimeline).toHaveBeenCalledTimes(2);
    expect(mockSetTimeEntries).not.toHaveBeenCalled();
    expect(tree.root.findByType('status-banner').props.message).toContain("We've refreshed the latest times");
  });

  it('handles stale permission denial without treating capability as authority', async () => {
    mockReconcile.mockRejectedValue(new ApiError('denied', 403, 'shift_work_area_edit_not_allowed'));
    const tree = await renderEditor();
    await act(async () => tree.root.findByProps({ testID: 'work-area-2' }).props.onPress());
    await act(async () => tree.root.findByProps({ testID: 'work-area-option-area-cleanup' }).props.onPress());
    await act(async () => tree.root.findByType('primary-button').props.onPress());
    expect(mockSetClockingCapabilities).toHaveBeenCalledWith(expect.objectContaining({ editShiftWorkAreas: false }));
    expect(tree.root.findByType('status-banner').props.message).toBe('Work Area editing is no longer available for your account.');
  });

  it('shows the available timeline read-only while offline and never posts', async () => {
    mockIsOnline.mockResolvedValue(false);
    const tree = await renderEditor();
    expect(mockLoadTimeline).not.toHaveBeenCalled();
    expect(tree.root.findByType('status-banner').props.message).toBe('Reconnect to edit Work Area times.');
    expect(tree.root.findByType('primary-button').props.disabled).toBe(true);
    expect(mockReconcile).not.toHaveBeenCalled();
  });
});