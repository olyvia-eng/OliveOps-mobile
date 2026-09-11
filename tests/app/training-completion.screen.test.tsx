import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, jest } from '@jest/globals';

const historicalDocument = {
  fileId: 'historical-file', originalFileName: 'orientation-v3.pdf', mimeType: 'application/pdf' as const,
  sizeBytes: 3000, uploadedAt: '2026-09-01T12:00:00.000Z', status: 'ready' as const, version: 3,
};
const mockRefreshHistory = jest.fn();

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ completionId: 'completion-3' }) }));
jest.mock('@/store/trainingStore', () => ({ useTrainingStore: () => ({ completions: [{
  id: 'completion-3', completionId: 'completion-3', trainingTitle: 'Orientation', completedVersion: 3,
  completedAt: '2026-09-02T12:00:00.000Z', contentMode: 'document', document: historicalDocument,
}] }) }));
jest.mock('@/hooks/useTrainingActions', () => ({ useTrainingActions: () => ({ refreshHistory: mockRefreshHistory }) }));
jest.mock('@/components/AuthorizedPdfViewer', () => ({ AuthorizedPdfViewer: (props: any) => require('react').createElement('pdf-viewer', props) }));
jest.mock('@/components/Screen', () => ({
  Screen: ({ children }: any) => require('react').createElement('screen', {}, children),
  ScreenSafeAreaView: ({ children }: any) => require('react').createElement('safe-area', {}, children),
}));
jest.mock('react-native', () => {
  const ReactModule = require('react');
  return {
    NativeModules: {}, Platform: { select: (values: any) => values.ios ?? values.default }, TurboModuleRegistry: { get: () => null },
    StyleSheet: { create: (value: unknown) => value },
    View: ({ children, ...props }: any) => ReactModule.createElement('view', props, children),
    Text: ({ children, ...props }: any) => ReactModule.createElement('text', props, children),
    Pressable: ({ children, ...props }: any) => ReactModule.createElement('pressable', props, children),
    ActivityIndicator: (props: any) => ReactModule.createElement('activity-indicator', props),
  };
});

import TrainingCompletionScreen from '../../app/training-completion';

describe('TrainingCompletionScreen', () => {
  it('renders the immutable document snapshot from the selected completion', async () => {
    let tree: any;
    await act(async () => { tree = create(<TrainingCompletionScreen />); });
    expect(tree.root.findByType('pdf-viewer').props.document).toEqual(historicalDocument);
    expect(mockRefreshHistory).not.toHaveBeenCalled();
    expect(tree.root.findAllByType('primary-button')).toHaveLength(0);
  });
});