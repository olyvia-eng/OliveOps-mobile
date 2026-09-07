import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ApiError } from '@/types/errors';

const mockLoadDetail = jest.fn();
const mockComplete = jest.fn();
const mockPrepareDownload = jest.fn();
const mockOpenUrl = jest.fn();
const mockReplace = jest.fn();
const mockRefreshAssignments = jest.fn();

const detail = {
  ok: true,
  assignment: {
    id: 'assignment-1', assignmentId: 'assignment-1', trainingTitle: 'WHMIS', assignedVersion: 2,
    currentDueDate: '2026-09-10', presentationStatus: 'due_soon',
  },
  version: {
    trainingId: 'training-1', version: 2, title: 'WHMIS', shortDescription: 'Hazard communication',
    instructions: 'Read the module and confirm each item.', attachmentFileId: 'file-1',
    checklist: [
      { itemId: 'item-1', text: 'Read the labels', required: true, sortOrder: 0 },
      { itemId: 'item-2', text: 'Review the SDS', required: true, sortOrder: 1 },
    ],
    trainingSections: [
      {
        sectionId: 'section-info', title: 'Test header', description: 'this is some text without a checklist', sortOrder: 0,
        checklistItems: [],
      },
      {
        sectionId: 'section-checklist', title: 'Safety checks', description: 'Confirm each item before completing.', sortOrder: 1,
        checklistItems: [
          { itemId: 'item-1', text: 'Read the labels', required: true, sortOrder: 0 },
          { itemId: 'item-2', text: 'Review the SDS', required: true, sortOrder: 1 },
        ],
      },
    ],
    acknowledgementStatement: 'I understand this training.', recurrenceType: 'annual', recurrenceMonths: null,
  },
};

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  useLocalSearchParams: () => ({ assignmentId: 'assignment-1' }),
}));
jest.mock('@/api/trainingApi', () => ({
  loadMyTrainingDetail: (...args: unknown[]) => mockLoadDetail(...args),
  completeTraining: (...args: unknown[]) => mockComplete(...args),
}));
jest.mock('@/api/storageApi', () => ({ prepareDownload: (...args: unknown[]) => mockPrepareDownload(...args) }));
jest.mock('@/store/authStore', () => ({ useAuthStore: () => ({ accessToken: 'token-1', user: { name: 'Alex Worker' } }) }));
jest.mock('@/hooks/useTrainingActions', () => ({ useTrainingActions: () => ({ refreshAssignments: mockRefreshAssignments }) }));
jest.mock('@/services/requestGuards', () => ({ createRequestMeta: () => ({ idempotencyKey: 'training-attempt-1' }) }));
jest.mock('@/components/AuthorizedPdfViewer', () => ({ AuthorizedPdfViewer: (props: any) => require('react').createElement('pdf-viewer', props) }));
jest.mock('@/components/Screen', () => ({
  Screen: ({ children }: any) => require('react').createElement('screen', {}, children),
  ScreenSafeAreaView: ({ children }: any) => require('react').createElement('safe-area', {}, children),
}));
jest.mock('@/components/PrimaryActionButton', () => ({ PrimaryActionButton: (props: any) => require('react').createElement('primary-button', props) }));
jest.mock('@/components/SecondaryButton', () => ({ SecondaryButton: (props: any) => require('react').createElement('secondary-button', props) }));
jest.mock('react-native', () => {
  const ReactModule = require('react');
  return {
    NativeModules: {}, Platform: { select: (values: any) => values.ios ?? values.default }, TurboModuleRegistry: { get: () => null },
    Linking: { openURL: (...args: unknown[]) => mockOpenUrl(...args) },
    StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
    ActivityIndicator: (props: any) => ReactModule.createElement('activity-indicator', props),
    View: ({ children, ...props }: any) => ReactModule.createElement('view', props, children),
    Text: ({ children, ...props }: any) => ReactModule.createElement('text', props, children),
    TextInput: (props: any) => ReactModule.createElement('text-input', props),
    ScrollView: ({ children, ...props }: any) => ReactModule.createElement('scroll-view', props, children),
    Pressable: ({ children, onPress, style, ...props }: any) => ReactModule.createElement('pressable', { onPress, style: typeof style === 'function' ? style({ pressed: false }) : style, ...props }, children),
  };
});

import TrainingDetailScreen from '../../app/training-detail';

describe('TrainingDetailScreen', () => {
  beforeEach(() => {
    mockLoadDetail.mockReset().mockResolvedValue(detail);
    mockComplete.mockReset().mockResolvedValue({ ok: true, completion: {}, replayed: false });
    mockPrepareDownload.mockReset().mockResolvedValue({ ok: true, fileId: 'file-1', downloadUrl: 'https://signed.example/training' });
    mockOpenUrl.mockReset().mockResolvedValue(undefined);
    mockReplace.mockReset();
    mockRefreshAssignments.mockReset().mockResolvedValue({ ok: true });
  });

  it('renders every section in backend order, including an informational section with no checklist', async () => {
    let tree: any;
    await act(async () => { tree = create(<TrainingDetailScreen />); });

    const sections = tree.root.findAllByType('view').filter((node: any) => typeof node.props.testID === 'string' && node.props.testID.startsWith('training-section-') && !node.props.testID.includes('description'));
    expect(sections.map((node: any) => node.props.testID)).toEqual([
      'training-section-section-info',
      'training-section-section-checklist',
    ]);
    expect(tree.root.findByProps({ testID: 'training-section-description-section-info' }).children).toEqual(['this is some text without a checklist']);
    expect(tree.root.findByProps({ testID: 'training-section-description-section-checklist' }).children).toEqual(['Confirm each item before completing.']);
    expect(tree.root.findAll((node: any) => node.props.testID === 'training-check-item-1')).toHaveLength(1);
    expect(tree.root.findAll((node: any) => node.props.testID === 'training-check-item-2')).toHaveLength(1);
  });

  it('does not gate on zero-item sections and requires the canonical employee signature', async () => {
    let tree: any;
    await act(async () => { tree = create(<TrainingDetailScreen />); });

    expect(tree.root.findByType('primary-button').props.disabled).toBe(true);
    await act(async () => tree.root.findByProps({ testID: 'training-check-item-1' }).props.onPress());
    await act(async () => tree.root.findByProps({ testID: 'training-check-item-2' }).props.onPress());
    await act(async () => tree.root.findByProps({ testID: 'training-acknowledgement' }).props.onPress());
    expect(tree.root.findByType('primary-button').props.disabled).toBe(true);
    await act(async () => tree.root.findByProps({ testID: 'training-signature-input' }).props.onChangeText('Another Employee'));
    expect(tree.root.findByType('primary-button').props.disabled).toBe(true);
    await act(async () => tree.root.findByProps({ testID: 'training-signature-input' }).props.onChangeText('  alex   worker  '));
    expect(tree.root.findByType('primary-button').props.disabled).toBe(false);

    await act(async () => { await tree.root.findByType('primary-button').props.onPress(); });
    expect(mockComplete).toHaveBeenCalledWith({
      assignmentId: 'assignment-1',
      submissionId: 'training-attempt-1',
      checklistResponses: [
        { itemId: 'item-1', checked: true },
        { itemId: 'item-2', checked: true },
      ],
      acknowledged: true,
      signatureName: 'Alex Worker',
    }, 'token-1');
    expect(mockReplace).toHaveBeenCalledWith('/training');
    expect(mockRefreshAssignments).toHaveBeenCalledWith({ force: true });
  });

  it('opens attachments through the authorized storage flow', async () => {
    let tree: any;
    await act(async () => { tree = create(<TrainingDetailScreen />); });
    await act(async () => { await tree.root.findByType('secondary-button').props.onPress(); });
    expect(mockPrepareDownload).toHaveBeenCalledWith('file-1', 'token-1');
    expect(mockOpenUrl).toHaveBeenCalledWith('https://signed.example/training');
  });

  it('shows document Training without completing on open and preserves acknowledgement gating', async () => {
    mockLoadDetail.mockResolvedValueOnce({
      ...detail,
      version: {
        ...detail.version,
        contentMode: 'document',
        document: {
          fileId: 'pdf-2', originalFileName: 'whmis-v2.pdf', mimeType: 'application/pdf', sizeBytes: 2048,
          uploadedAt: '2026-09-01T12:00:00.000Z', status: 'ready', version: 2,
        },
        attachmentFileId: null,
        checklist: [],
      },
    });
    let tree: any;
    await act(async () => { tree = create(<TrainingDetailScreen />); });

    expect(tree.root.findByType('pdf-viewer').props.document.fileId).toBe('pdf-2');
    expect(mockComplete).not.toHaveBeenCalled();
    expect(tree.root.findByType('primary-button').props.disabled).toBe(true);

    await act(async () => tree.root.findByProps({ testID: 'training-acknowledgement' }).props.onPress());
    await act(async () => tree.root.findByProps({ testID: 'training-signature-input' }).props.onChangeText('Alex Worker'));
    await act(async () => { await tree.root.findByType('primary-button').props.onPress(); });
    expect(mockComplete).toHaveBeenCalledWith({
      assignmentId: 'assignment-1',
      submissionId: 'training-attempt-1',
      checklistResponses: [],
      acknowledged: true,
      signatureName: 'Alex Worker',
    }, 'token-1');
  });

  it('treats an already completed cycle as authoritative success', async () => {
    mockComplete.mockRejectedValue(new ApiError('This training cycle is already complete.', 409, 'cycle_complete'));
    let tree: any;
    await act(async () => { tree = create(<TrainingDetailScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'training-check-item-1' }).props.onPress());
    await act(async () => tree.root.findByProps({ testID: 'training-check-item-2' }).props.onPress());
    await act(async () => tree.root.findByProps({ testID: 'training-acknowledgement' }).props.onPress());
    await act(async () => tree.root.findByProps({ testID: 'training-signature-input' }).props.onChangeText('Alex Worker'));
    await act(async () => { await tree.root.findByType('primary-button').props.onPress(); });
    expect(mockReplace).toHaveBeenCalledWith('/training');
  });
});