import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => {
  const ReactModule = require('react');
  return {
    NativeModules: {},
    Platform: { select: (values: any) => values.ios ?? values.default },
    StyleSheet: { create: (value: unknown) => value },
    TurboModuleRegistry: { get: () => null },
    View: ({ children }: any) => ReactModule.createElement('view', null, children),
    Text: ({ children }: any) => ReactModule.createElement('text', null, children),
    Pressable: ({ children, onPress }: any) => ReactModule.createElement('pressable', { onPress }, children),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => require('react').createElement('safe-area', null, children),
}));

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  wrap: (component: unknown) => component,
}));

import { AppErrorBoundary } from '@/components/AppErrorBoundary';

describe('AppErrorBoundary', () => {
  let consoleError: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('shows a safe fallback and retries without exposing error details', async () => {
    let shouldThrow = true;
    function Child() {
      if (shouldThrow) throw new Error('sensitive stack detail');
      return React.createElement('recovered');
    }

    let tree: any;
    await act(async () => {
      tree = create(
        React.createElement(AppErrorBoundary, null, React.createElement(Child))
      );
    });

    const fallbackText = tree.root.findAllByType('text')
      .map((node: any) => String(node.props.children))
      .join(' ');
    expect(fallbackText).toContain('Something went wrong');
    expect(fallbackText).not.toContain('sensitive stack detail');

    shouldThrow = false;
    await act(async () => {
      tree.root.findByType('pressable').props.onPress();
    });

    expect(tree.root.findByType('recovered')).toBeTruthy();
  });
});