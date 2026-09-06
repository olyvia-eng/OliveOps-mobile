import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() }, useLocalSearchParams: () => ({ sopId: 'sop-1' }) }));
jest.mock('@/api/sopsApi', () => ({ loadMySopDetail: jest.fn(async () => ({ ok: true, sop: {
  sopId: 'sop-1', businessId: 'biz-1', version: 2, title: 'Lockout', category: 'Safety', contentMode: 'document',
  document: {
    fileId: 'sop-file-2', originalFileName: 'lockout-v2.pdf', mimeType: 'application/pdf', sizeBytes: 2200,
    uploadedAt: '2026-09-01T12:00:00.000Z', status: 'ready', version: 2,
  },
  shortDescription: '', purpose: '', instructions: '', safetyInformation: '', attachmentFileIds: [],
  publishedAt: '2026-09-01T12:00:00.000Z', publishedBy: 'admin-1',
} })) }));
jest.mock('@/services/connectivity', () => ({ isOnline: jest.fn(async () => true) }));
jest.mock('@/services/sopCacheStorage', () => ({ loadSopCache: jest.fn(async () => null), saveSopCache: jest.fn(async () => undefined) }));
jest.mock('@/store/authStore', () => ({ useAuthStore: () => ({
  accessToken: 'token-1', user: { id: 'user-1', businessId: 'biz-1', employeeId: 'employee-1' },
}) }));
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

import SopDocumentScreen from '../../app/sop-document';
import { loadMySopDetail } from '@/api/sopsApi';

describe('SopDocumentScreen', () => {
  it('renders the current SOP PDF as read-only content', async () => {
    let tree: any;
    await act(async () => {
      tree = create(<SopDocumentScreen />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(tree.root.findByType('pdf-viewer').props.document.fileId).toBe('sop-file-2');
    expect(loadMySopDetail).toHaveBeenCalledWith('sop-1', 'token-1');
    expect(tree.root.findAllByType('primary-button')).toHaveLength(0);
  });
});