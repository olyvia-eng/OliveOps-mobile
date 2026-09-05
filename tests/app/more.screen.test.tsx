import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, jest } from '@jest/globals';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('@/components/Screen', () => ({
  Screen: ({ children }: any) => require('react').createElement('screen', {}, children),
  PrimaryScreen: ({ children, testID }: any) => require('react').createElement('primary-screen', {
    edges: ['top', 'left', 'right'], testID,
  }, children),
}));
jest.mock('react-native', () => {
  const ReactModule = require('react');
  return {
    NativeModules: {}, Platform: { select: (values: any) => values.ios ?? values.default }, TurboModuleRegistry: { get: () => null },
    StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
    View: ({ children, ...props }: any) => ReactModule.createElement('view', props, children),
    Text: ({ children, ...props }: any) => ReactModule.createElement('text', props, children),
    Pressable: ({ children, onPress, style, ...props }: any) => ReactModule.createElement('pressable', { onPress, style: typeof style === 'function' ? style({ pressed: false }) : style, ...props }, children),
  };
});

import MoreScreen from '../../app/more';

describe('MoreScreen', () => {
  it('applies the primary top inset once', async () => {
    let tree: any;
    await act(async () => { tree = create(<MoreScreen />); });
    expect(tree.root.findByType('primary-screen').props.edges).toEqual(['top', 'left', 'right']);
  });

  it.each([
    ['more-forms', '/forms'],
    ['more-time-off', '/time-off'],
    ['more-time-history', '/time-history'],
    ['more-correction-requests', '/my-correction-requests'],
    ['more-settings', '/settings'],
  ])('opens %s', async (testID, path) => {
    let tree: any;
    await act(async () => { tree = create(<MoreScreen />); });
    await act(async () => tree.root.findByProps({ testID }).props.onPress());
    expect(mockPush).toHaveBeenCalledWith(path);
  });
});