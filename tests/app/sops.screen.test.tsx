import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPush = jest.fn();
const mockLoadSops = jest.fn();

const baseSop = {
  businessId: 'biz-1', version: 1, category: 'Safety', shortDescription: 'Procedure', purpose: '',
  instructions: '', safetyInformation: '', attachmentFileIds: [], publishedAt: '2026-09-01T12:00:00.000Z', publishedBy: 'admin-1',
};

jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('@/api/sopsApi', () => ({ loadMySops: (...args: unknown[]) => mockLoadSops(...args) }));
jest.mock('@/services/connectivity', () => ({ isOnline: jest.fn(async () => true) }));
jest.mock('@/services/sopCacheStorage', () => ({ loadSopCache: jest.fn(async () => null), saveSopCache: jest.fn(async () => undefined) }));
jest.mock('@/store/authStore', () => ({ useAuthStore: () => ({
  accessToken: 'token-1', user: { id: 'user-1', businessId: 'biz-1', employeeId: 'employee-1' },
}) }));
jest.mock('@/components/Screen', () => ({ ScreenSafeAreaView: ({ children }: any) => require('react').createElement('safe-area', {}, children) }));
jest.mock('@/components/LoadingState', () => ({ LoadingState: (props: any) => require('react').createElement('loading-state', props) }));
jest.mock('@/components/MobilePrimitives', () => ({
  EmptyState: (props: any) => require('react').createElement('empty-state', props),
  ListRow: (props: any) => require('react').createElement('list-row', props),
  ScreenHeader: (props: any) => require('react').createElement('screen-header', props),
  SectionCard: ({ children }: any) => require('react').createElement('section-card', {}, children),
  SectionHeader: (props: any) => require('react').createElement('section-header', props),
}));
jest.mock('react-native', () => {
  const ReactModule = require('react');
  return {
    NativeModules: {}, Platform: { select: (values: any) => values.ios ?? values.default }, TurboModuleRegistry: { get: () => null },
    StyleSheet: { create: (value: unknown) => value },
    View: ({ children, ...props }: any) => ReactModule.createElement('view', props, children),
    Text: ({ children, ...props }: any) => ReactModule.createElement('text', props, children),
    Pressable: ({ children, ...props }: any) => ReactModule.createElement('pressable', props, children),
    TextInput: (props: any) => ReactModule.createElement('text-input', props),
    RefreshControl: (props: any) => ReactModule.createElement('refresh-control', props),
    FlatList: ({ data, renderItem, ListHeaderComponent }: any) => ReactModule.createElement('flat-list', {},
      ListHeaderComponent,
      data.map((item: any, index: number) => ReactModule.createElement(ReactModule.Fragment, { key: item.sopId }, renderItem({ item, index }))),
    ),
  };
});

import SopsScreen from '../../app/sops';

describe('SopsScreen document routing', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockLoadSops.mockReset().mockResolvedValue({ ok: true, sops: [
      { ...baseSop, sopId: 'document-sop', title: 'Lockout', contentMode: 'document', document: {
        fileId: 'pdf-1', originalFileName: 'lockout.pdf', mimeType: 'application/pdf', sizeBytes: 1000,
        uploadedAt: '2026-09-01T12:00:00.000Z', status: 'ready', version: 1,
      } },
      { ...baseSop, sopId: 'legacy-sop', title: 'Legacy procedure' },
    ] });
  });

  it('routes explicit documents to the viewer and missing modes to structured detail', async () => {
    let tree: any;
    await act(async () => { tree = create(<SopsScreen />); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => tree.root.findByProps({ testID: 'sop-row-document-sop' }).props.onPress());
    await act(async () => tree.root.findByProps({ testID: 'sop-row-legacy-sop' }).props.onPress());
    expect(mockPush).toHaveBeenNthCalledWith(1, { pathname: '/sop-document', params: { sopId: 'document-sop' } });
    expect(mockPush).toHaveBeenNthCalledWith(2, { pathname: '/sop-detail', params: { sopId: 'legacy-sop' } });
  });
});