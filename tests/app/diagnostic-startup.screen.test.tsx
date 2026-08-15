import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

describe('Router startup diagnostic screen', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP;
  });

  it('renders through Router without evaluating normal application startup', async () => {
    process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP = 'true';
    jest.doMock('@/normalApp/NormalIndexScreen', () => {
      throw new Error('Session bootstrap and application screens must not load.');
    });
    jest.doMock('@/normalApp/NormalRootLayout', () => {
      throw new Error('Sentry and application providers must not load.');
    });
    jest.doMock('expo-router', () => ({
      Stack: () => require('react').createElement('stack'),
    }));

    let DiagnosticIndexScreen!: React.ComponentType;
    let DiagnosticRootLayout!: React.ComponentType;
    jest.isolateModules(() => {
      DiagnosticIndexScreen = require('../../app/index').default;
      DiagnosticRootLayout = require('../../app/_layout').default;
    });

    let screenTree: any;
    let layoutTree: any;
    await act(async () => {
      screenTree = create(React.createElement(DiagnosticIndexScreen));
      layoutTree = create(React.createElement(DiagnosticRootLayout));
    });

    expect(screenTree.root.findByType('Text').props.children).toBe('OliveOps Router OK');
    expect(layoutTree.root.findAllByType('stack')).toHaveLength(1);
  });
});