import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockLoadMySopDetail = jest.fn();

const webCreatedSop = {
  sopId: 'sop-web-1', businessId: 'biz-1', version: 3, title: 'End of Day Procedure', contentMode: 'structured',
  category: 'Operations', shortDescription: 'Close the site correctly.',
  richTextContent: { type: 'doc', content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Purpose' }] },
    { type: 'paragraph', content: [
      { type: 'text', text: 'This SOP explains ', marks: [{ type: 'italic' }] },
      { type: 'text', text: 'the correct process.', marks: [{ type: 'bold' }, { type: 'underline' }] },
    ] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Complete each step before leaving.' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Preparation' }] },
    { type: 'bulletList', content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Inspect the work area' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Gather required equipment' }] }] },
    ] },
    { type: 'orderedList', attrs: { start: 1, type: null }, content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Secure the site' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Submit the report' }] }] },
    ] },
  ] },
  purpose: '', instructions: '', safetyInformation: '', attachmentFileIds: [],
  document: null, publishedAt: '2026-09-06T12:00:00.000Z', publishedBy: 'admin-1',
};

jest.mock('expo-router', () => ({
  Redirect: (props: any) => require('react').createElement('redirect', props),
  useLocalSearchParams: () => ({ sopId: 'sop-web-1' }),
}));
jest.mock('@/api/sopsApi', () => ({ loadMySopDetail: (...args: unknown[]) => mockLoadMySopDetail(...args) }));
jest.mock('@/api/storageApi', () => ({ prepareDownload: jest.fn() }));
jest.mock('@/services/connectivity', () => ({ isOnline: jest.fn(async () => true) }));
jest.mock('@/services/sopCacheStorage', () => ({ loadSopCache: jest.fn(async () => null), saveSopCache: jest.fn(async () => undefined) }));
jest.mock('@/store/authStore', () => ({ useAuthStore: () => ({
  accessToken: 'token-1', user: { id: 'user-1', businessId: 'biz-1', employeeId: 'employee-1' },
}) }));
jest.mock('@/components/Screen', () => ({ Screen: ({ children, ...props }: any) => require('react').createElement('screen', props, children) }));
jest.mock('react-native', () => {
  const ReactModule = require('react');
  return {
    NativeModules: {}, Platform: { select: (values: any) => values.ios ?? values.default }, TurboModuleRegistry: { get: () => null },
    StyleSheet: { create: (value: unknown) => value },
    View: ({ children, ...props }: any) => ReactModule.createElement('view', props, children),
    Text: ({ children, ...props }: any) => ReactModule.createElement('text', props, children),
    Pressable: ({ children, ...props }: any) => ReactModule.createElement('pressable', props, children),
    ActivityIndicator: (props: any) => ReactModule.createElement('activity-indicator', props),
    Linking: { openURL: jest.fn(async () => undefined) },
  };
});

import SopDetailScreen from '../../app/sop-detail';

function renderedText(tree: any) {
  return tree.root.findAllByType('text').map((node: any) => node.children.filter((child: unknown) => typeof child === 'string').join('')).join(' ');
}

describe('SopDetailScreen structured content', () => {
  beforeEach(() => {
    mockLoadMySopDetail.mockReset().mockResolvedValue({ ok: true, sop: webCreatedSop });
  });

  it('renders the current backend web-created rich text payload completely and in order', async () => {
    let tree: any;
    await act(async () => {
      tree = create(<SopDetailScreen />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const text = renderedText(tree);
    const authoredContent = [
      'Purpose', 'This SOP explains ', 'the correct process.', 'Complete each step before leaving.',
      'Preparation', 'Inspect the work area', 'Gather required equipment', 'Secure the site', 'Submit the report',
    ];
    authoredContent.forEach((value) => expect(text).toContain(value));
    expect(authoredContent.map((value) => text.indexOf(value))).toEqual([...authoredContent.map((value) => text.indexOf(value))].sort((a, b) => a - b));
    const textStyles = tree.root.findAllByType('text').flatMap((node: any) => Array.isArray(node.props.style) ? node.props.style : [node.props.style]);
    expect(textStyles.some((style: any) => style?.fontStyle === 'italic')).toBe(true);
    expect(textStyles.some((style: any) => style?.fontWeight)).toBe(true);
    expect(textStyles.some((style: any) => style?.textDecorationLine === 'underline')).toBe(true);
    expect(text).toContain('1.');
    expect(text).toContain('2.');
  });

  it('renders legacy structured SOP fields through the shared document renderer', async () => {
    mockLoadMySopDetail.mockResolvedValue({
      ok: true,
      sop: {
        ...webCreatedSop,
        richTextContent: undefined,
        purpose: 'Prevent unexpected startup.',
        instructions: 'Stop the equipment.\nIsolate the energy source.',
        safetyInformation: 'Wear required PPE.',
      },
    });
    let tree: any;
    await act(async () => {
      tree = create(<SopDetailScreen />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const text = renderedText(tree);
    expect(text).toContain('Purpose');
    expect(text).toContain('Prevent unexpected startup.');
    expect(text).toContain('Instructions');
    expect(text).toContain('Stop the equipment.');
    expect(text).toContain('Isolate the energy source.');
    expect(text).toContain('Safety Information');
    expect(text).toContain('Wear required PPE.');
  });

  it('distinguishes truly empty content from an intentionally empty section', async () => {
    mockLoadMySopDetail.mockResolvedValueOnce({
      ok: true,
      sop: { ...webCreatedSop, richTextContent: { type: 'doc', content: [{ type: 'paragraph' }] } },
    });
    let emptyTree: any;
    await act(async () => {
      emptyTree = create(<SopDetailScreen />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(renderedText(emptyTree)).toContain('No procedure content has been provided.');

    mockLoadMySopDetail.mockResolvedValueOnce({
      ok: true,
      sop: { ...webCreatedSop, richTextContent: { type: 'doc', content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Purpose' }] },
      ] } },
    });
    let headingTree: any;
    await act(async () => {
      headingTree = create(<SopDetailScreen />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(renderedText(headingTree)).toContain('Purpose');
    expect(renderedText(headingTree)).not.toContain('No procedure content has been provided.');
  });

  it('renders an unsupported block warning while preserving supported content', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockLoadMySopDetail.mockResolvedValue({
      ok: true,
      sop: {
        ...webCreatedSop,
        richTextContent: { type: 'doc', content: [
          { type: 'heading', content: [{ type: 'text', text: 'Purpose' }] },
          { type: 'checklist', content: [] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Supported content remains visible.' }] },
        ] },
      },
    });
    let tree: any;
    await act(async () => {
      tree = create(<SopDetailScreen />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const text = renderedText(tree);
    expect(text).toContain('Supported content remains visible.');
    expect(text).toContain('Some procedure content could not be displayed.');
    expect(warn).toHaveBeenCalledWith('[sop:unsupported-content]', { types: ['node:checklist'] });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('Supported content remains visible.');
    warn.mockRestore();
  });
});