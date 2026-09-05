import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, jest } from '@jest/globals';

const mockReplace = jest.fn();
let mockPathname = '/home';
let mockCounts = { overdueCount: 0, dueSoonCount: 0 };

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  usePathname: () => mockPathname,
}));
jest.mock('@/store/authStore', () => ({ useAuthStore: () => ({ status: 'authenticated' }) }));
jest.mock('@/store/trainingStore', () => ({ useTrainingStore: () => mockCounts }));
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

import { PrimaryNavigation } from '../../src/components/PrimaryNavigation';

describe('PrimaryNavigation', () => {
  it('shows persistent primary destinations and hides a zero badge', async () => {
    let tree: any;
    await act(async () => { tree = create(<PrimaryNavigation />); });
    expect(tree.root.findAllByType('pressable')).toHaveLength(4);
    expect(tree.root.findAllByProps({ testID: 'hub-attention-badge' })).toHaveLength(0);
  });

  it('sums Training attention, caps the badge, and provides an accessible label', async () => {
    mockCounts = { overdueCount: 80, dueSoonCount: 25 };
    let tree: any;
    await act(async () => { tree = create(<PrimaryNavigation />); });
    expect(tree.root.findByProps({ testID: 'hub-attention-badge' }).findByType('text').props.children).toBe('99+');
    expect(tree.root.findByProps({ testID: 'primary-nav-hub' }).props.accessibilityLabel).toBe('Hub, 105 Training assignments need attention');
  });

  it('replaces the current primary route without stacking tabs', async () => {
    mockCounts = { overdueCount: 0, dueSoonCount: 0 };
    let tree: any;
    await act(async () => { tree = create(<PrimaryNavigation />); });
    await act(async () => tree.root.findByProps({ testID: 'primary-nav-time' }).props.onPress());
    expect(mockReplace).toHaveBeenCalledWith('/time-history');
  });

  it('remains available on authenticated detail routes', async () => {
    mockPathname = '/training-detail';
    let tree: any;
    await act(async () => { tree = create(<PrimaryNavigation />); });
    expect(tree.root.findAllByType('pressable')).toHaveLength(4);
    mockPathname = '/home';
  });
});