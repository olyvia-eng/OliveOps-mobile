import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: any) => require('react').createElement('safe-area', props, children),
}));
jest.mock('react-native', () => {
  const ReactModule = require('react');
  return {
    NativeModules: {}, Platform: { select: (values: any) => values.ios ?? values.default }, TurboModuleRegistry: { get: () => null },
    StyleSheet: { create: (value: unknown) => value },
    View: ({ children, ...props }: any) => ReactModule.createElement('view', props, children),
    ScrollView: ({ children, ...props }: any) => ReactModule.createElement('scroll-view', props, children),
  };
});

import { PrimarySafeAreaView, PrimaryScreen, Screen, ScreenSafeAreaView } from '@/components/Screen';

describe('safe-area screen containers', () => {
  it('applies the top inset once to a scrollable primary destination', async () => {
    let tree: any;
    await act(async () => { tree = create(<PrimaryScreen testID="primary-content">Content</PrimaryScreen>); });

    expect(tree.root.findByType('safe-area').props.edges).toEqual(['top', 'left', 'right']);
    expect(tree.root.findByType('scroll-view').props.testID).toBe('primary-content');
    expect(tree.root.findByType('scroll-view').props.contentContainerStyle).toEqual(expect.objectContaining({ flexGrow: 1 }));
  });

  it('leaves top inset ownership to the Stack header on nested screens', async () => {
    let tree: any;
    await act(async () => { tree = create(<Screen testID="nested-content">Content</Screen>); });

    expect(tree.root.findByType('safe-area').props.edges).toEqual(['left', 'right']);
    expect(tree.root.findByType('safe-area').props.edges).not.toContain('top');
  });

  it('supports virtualized primary lists without adding a second scroll view', async () => {
    let tree: any;
    await act(async () => {
      tree = create(<PrimarySafeAreaView testID="primary-list">{React.createElement('virtual-list')}</PrimarySafeAreaView>);
    });

    expect(tree.root.findByType('safe-area').props.edges).toEqual(['top', 'left', 'right']);
    expect(tree.root.findAllByType('scroll-view')).toHaveLength(0);
    expect(tree.root.findByType('virtual-list')).toBeTruthy();
  });

  it('supports header-managed virtualized lists without duplicating the top inset', async () => {
    let tree: any;
    await act(async () => {
      tree = create(<ScreenSafeAreaView testID="nested-list">{React.createElement('virtual-list')}</ScreenSafeAreaView>);
    });

    expect(tree.root.findByType('safe-area').props.edges).toEqual(['left', 'right']);
    expect(tree.root.findAllByType('scroll-view')).toHaveLength(0);
  });
});