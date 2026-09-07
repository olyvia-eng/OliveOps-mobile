import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockLoadDetail = jest.fn();
const mockLoadForms = jest.fn();
const mockQueueCompletion = jest.fn();
const mockQueueNote = jest.fn();
const mockQueuePhoto = jest.fn();
const mockReplayOutbox = jest.fn();
const mockLoadOutbox = jest.fn();
const mockClockIn = jest.fn();
const mockAcceptWorkflow = jest.fn();
const mockCreateRequestMeta = jest.fn(() => ({ requestId: 'request-1', idempotencyKey: 'key-1' }));

const summary = {
  id: 'visit-1', jobId: 'job-1', serviceId: 'service-1', jobName: 'Oak Residence',
  serviceName: 'Weekly Lawn Care', customerName: 'Morgan', propertyName: 'Oak Residence',
  propertyAddress: '10 Oak Street', scheduledDate: '2026-08-07', scheduleAllDay: true,
  status: 'scheduled', billingType: 'recurring', hasRequiredForms: true, hasSops: true,
};

function detail(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    visit: {
      id: 'visit-1', jobId: 'job-1', serviceId: 'service-1', scheduledDate: '2026-08-07',
      scheduleAllDay: true, assignedEmployeeIds: ['emp-1'], assignedEquipmentIds: [], status: 'scheduled',
      billingTypeSnapshot: 'recurring', billingStatus: 'included', source: 'recurrence', notes: '',
      revision: 1, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
    },
    job: { id: 'job-1', title: 'Oak Residence' },
    service: { id: 'service-1', name: 'Weekly Lawn Care', description: 'Mow and trim', billingType: 'recurring' },
    timeEntries: [], forms: [], formSubmissions: [], photos: [], sops: [],
    completion: {
      requiredFormIds: ['form-1'], minimumPhotoCount: 1, noteRequired: true,
      completedFormIds: [], missingFormIds: ['form-1'], photoCount: 0, noteCount: 0, activeTimeEntryCount: 0,
    },
    ...overrides,
  };
}

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ jobId: 'job-1', visitId: 'visit-1' }),
}));
jest.mock('@/api/serviceVisitsApi', () => ({
  loadServiceVisitDetail: (...args: unknown[]) => mockLoadDetail(...args),
}));
jest.mock('@/api/formsApi', () => ({ loadEmployeeForms: (...args: unknown[]) => mockLoadForms(...args) }));
jest.mock('@/api/storageApi', () => ({ prepareUpload: jest.fn(), uploadUriToS3: jest.fn(), completeUpload: jest.fn() }));
jest.mock('@/services/photoPicker', () => ({ pickSinglePhoto: jest.fn() }));
jest.mock('@/services/serviceVisitOutbox', () => ({
  queueServiceVisitCompletion: (...args: unknown[]) => mockQueueCompletion(...args),
  queueServiceVisitNote: (...args: unknown[]) => mockQueueNote(...args),
  queueServiceVisitPhoto: (...args: unknown[]) => mockQueuePhoto(...args),
  replayServiceVisitOutbox: (...args: unknown[]) => mockReplayOutbox(...args),
  loadServiceVisitOutbox: (...args: unknown[]) => mockLoadOutbox(...args),
}));
jest.mock('@/services/requestGuards', () => ({
  createRequestMeta: (...args: unknown[]) => mockCreateRequestMeta(...args),
  createFormClientSubmissionId: jest.fn(() => 'form-submission:stable-id'),
}));
jest.mock('@/hooks/useClockingActions', () => ({ useClockingActions: () => ({ clockIn: mockClockIn, loading: false }) }));
jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ accessToken: 'token-1', user: { id: 'user-1', businessId: 'business-1', employeeId: 'emp-1' } }),
}));
jest.mock('@/store/clockingStore', () => ({
  useClockingStore: () => ({
    businessTimeZone: 'America/Toronto', currentActiveEntryId: null, timeEntries: [],
    todayServiceVisits: [summary], upcomingServiceVisits: [],
  }),
}));
jest.mock('@/store/pendingClockInStore', () => ({
  usePendingClockInStore: () => ({ acceptWorkflow: mockAcceptWorkflow }),
}));
jest.mock('@/components/Screen', () => ({ Screen: ({ children, testID }: any) => require('react').createElement('screen', { testID }, children) }));
jest.mock('@/components/PrimaryActionButton', () => ({
  PrimaryActionButton: ({ label, disabled, onPress }: any) => require('react').createElement('primary-button', { label, disabled: !!disabled, onPress }),
}));
jest.mock('@/components/SecondaryButton', () => ({
  SecondaryButton: ({ label, disabled, onPress }: any) => require('react').createElement('secondary-button', { label, disabled: !!disabled, onPress }),
}));
jest.mock('@/components/StatusBanner', () => ({ StatusBanner: ({ message }: any) => require('react').createElement('status-banner', { message }) }));
jest.mock('react-native', () => {
  const ReactNative = require('react');
  return {
    NativeModules: {}, Platform: { select: (values: any) => values.ios ?? values.default },
    StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 }, TurboModuleRegistry: { get: () => null },
    Alert: { alert: jest.fn() },
    View: ({ children, ...props }: any) => ReactNative.createElement('view', props, children),
    Text: ({ children, ...props }: any) => ReactNative.createElement('text', props, children),
    TextInput: (props: any) => ReactNative.createElement('text-input', props),
    Pressable: ({ children, style, ...props }: any) => ReactNative.createElement('pressable', props, typeof children === 'function' ? children({ pressed: false }) : children),
  };
});

import ServiceVisitScreen from '../../app/service-visit';
import { router } from 'expo-router';
import { Alert } from 'react-native';

async function renderScreen() {
  let tree: any;
  await act(async () => { tree = create(<ServiceVisitScreen />); });
  await act(async () => Promise.resolve());
  return tree;
}

describe('ServiceVisitScreen', () => {
  beforeEach(() => {
    mockLoadDetail.mockReset().mockResolvedValue(detail());
    mockLoadForms.mockReset().mockResolvedValue({ ok: true, timezone: 'America/Toronto', generatedAt: '', toDo: [], available: [], completed: [] });
    mockQueueCompletion.mockReset().mockResolvedValue({});
    mockQueueNote.mockReset().mockResolvedValue({});
    mockQueuePhoto.mockReset().mockResolvedValue({});
    mockReplayOutbox.mockReset().mockResolvedValue([]);
    mockLoadOutbox.mockReset().mockResolvedValue([]);
    mockClockIn.mockReset().mockResolvedValue({ ok: true });
    mockAcceptWorkflow.mockReset();
    (router.push as jest.Mock).mockReset();
    (router.replace as jest.Mock).mockReset();
    (Alert.alert as jest.Mock).mockReset();
  });

  it('starts Job work with the immutable Service Visit tuple', async () => {
    const tree = await renderScreen();
    const start = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Start Work');
    await act(async () => start.props.onPress());

    expect(mockClockIn).toHaveBeenCalledWith(
      'emp-1', 'job', ['job-1'], undefined, { requestId: 'request-1', idempotencyKey: 'key-1' },
      undefined, undefined,
      { jobId: 'job-1', serviceId: 'service-1', serviceVisitId: 'visit-1', serviceName: 'Weekly Lawn Care', propertyName: 'Oak Residence' },
    );
    expect(router.replace).toHaveBeenCalledWith('/active-shift');
  });

  it('keeps explicit completion disabled while Visit requirements are outstanding', async () => {
    const tree = await renderScreen();
    const complete = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Complete Visit');
    expect(complete.props.disabled).toBe(true);
    expect(mockQueueCompletion).not.toHaveBeenCalled();
  });

  it('completes the Visit only after explicit confirmation when requirements are met', async () => {
    mockLoadDetail.mockResolvedValue(detail({
      completion: {
        requiredFormIds: ['form-1'], minimumPhotoCount: 1, noteRequired: true,
        completedFormIds: ['form-1'], missingFormIds: [], photoCount: 1, noteCount: 1, activeTimeEntryCount: 0,
      },
    }));
    (Alert.alert as jest.Mock).mockImplementation((_title: string, _message: string, actions: Array<{ onPress?: () => void }>) => actions[1].onPress?.());
    const tree = await renderScreen();
    const complete = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Complete Visit');
    expect(complete.props.disabled).toBe(false);
    await act(async () => complete.props.onPress());

    expect(mockQueueCompletion).toHaveBeenCalledWith({
      identityKey: 'business-1:user-1:emp-1', jobId: 'job-1', serviceId: 'service-1',
      serviceVisitId: 'visit-1', clientSubmissionId: 'complete:stable-id',
    });
  });
});
