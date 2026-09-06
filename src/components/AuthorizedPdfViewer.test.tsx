import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPrepareDownload = jest.fn();
const mockIsOnline = jest.fn();
const mockOpenUrl = jest.fn();

jest.mock('@/api/storageApi', () => ({ prepareDownload: (...args: unknown[]) => mockPrepareDownload(...args) }));
jest.mock('@/services/connectivity', () => ({ isOnline: () => mockIsOnline() }));
jest.mock('@/store/authStore', () => ({ useAuthStore: () => ({ accessToken: 'token-1' }) }));
jest.mock('react-native-pdf', () => ({
  __esModule: true,
  default: (props: any) => require('react').createElement('native-pdf', props),
}));
jest.mock('react-native', () => {
  const ReactModule = require('react');
  return {
    AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
    Linking: { openURL: (...args: unknown[]) => mockOpenUrl(...args) },
    NativeModules: {},
    Platform: { OS: 'ios', select: (values: any) => values.ios ?? values.default },
    StyleSheet: { create: (value: unknown) => value },
    TurboModuleRegistry: { get: () => null },
    View: ({ children, ...props }: any) => ReactModule.createElement('view', props, children),
    Text: ({ children, ...props }: any) => ReactModule.createElement('text', props, children),
    Pressable: ({ children, onPress, ...props }: any) => ReactModule.createElement('pressable', { onPress, ...props }, children),
    ActivityIndicator: (props: any) => ReactModule.createElement('activity-indicator', props),
  };
});

import { AuthorizedPdfViewer } from './AuthorizedPdfViewer';

const document = {
  fileId: 'file-1', originalFileName: 'orientation.pdf', mimeType: 'application/pdf' as const,
  sizeBytes: 1234, uploadedAt: '2026-09-01T12:00:00.000Z', status: 'ready' as const, version: 2,
};

describe('AuthorizedPdfViewer', () => {
  beforeEach(() => {
    mockPrepareDownload.mockReset().mockResolvedValue({ ok: true, fileId: 'file-1', downloadUrl: 'https://signed.example/one' });
    mockIsOnline.mockReset().mockResolvedValue(true);
    mockOpenUrl.mockReset().mockResolvedValue(undefined);
  });

  it('renders a signed URL without persistent PDF caching and reports pages', async () => {
    let tree: any;
    await act(async () => { tree = create(<AuthorizedPdfViewer document={document} />); });
    const pdf = tree.root.findByType('native-pdf');
    expect(mockPrepareDownload).toHaveBeenCalledWith('file-1', 'token-1');
    expect(pdf.props.source).toEqual({ uri: 'https://signed.example/one', cache: false });
    expect(pdf.props.trustAllCerts).toBe(false);
    await act(async () => pdf.props.onLoadComplete(7));
    expect(tree.root.findAllByType('text').some((node: any) => node.children.join('') === 'Page 1 of 7')).toBe(true);
  });

  it('renews signed access once after a native load failure', async () => {
    mockPrepareDownload
      .mockResolvedValueOnce({ ok: true, fileId: 'file-1', downloadUrl: 'https://signed.example/one' })
      .mockResolvedValueOnce({ ok: true, fileId: 'file-1', downloadUrl: 'https://signed.example/two' });
    let tree: any;
    await act(async () => { tree = create(<AuthorizedPdfViewer document={document} />); });
    await act(async () => tree.root.findByType('native-pdf').props.onError(new Error('403')));
    expect(mockPrepareDownload).toHaveBeenCalledTimes(2);
    expect(tree.root.findByType('native-pdf').props.source.uri).toBe('https://signed.example/two');
  });

  it('uses fresh signed access for the external fallback', async () => {
    mockPrepareDownload
      .mockResolvedValueOnce({ ok: true, fileId: 'file-1', downloadUrl: 'https://signed.example/viewer' })
      .mockResolvedValueOnce({ ok: true, fileId: 'file-1', downloadUrl: 'https://signed.example/external' });
    let tree: any;
    await act(async () => { tree = create(<AuthorizedPdfViewer document={document} />); });
    const externalButton = tree.root.findAllByType('pressable').find((node: any) => node.props.accessibilityLabel === 'Open in Another App');
    await act(async () => externalButton.props.onPress());
    expect(mockOpenUrl).toHaveBeenCalledWith('https://signed.example/external');
  });

  it('shows an offline-unavailable state without requesting signed access', async () => {
    mockIsOnline.mockResolvedValue(false);
    let tree: any;
    await act(async () => { tree = create(<AuthorizedPdfViewer document={document} />); });
    expect(mockPrepareDownload).not.toHaveBeenCalled();
    expect(tree.root.findAllByType('text').some((node: any) => node.children.join('').includes('unavailable offline'))).toBe(true);
  });
});