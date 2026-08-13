import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

describe('diagnostic native startup screen', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP;
    jest.resetModules();
  });

  it('renders the success message without loading normal application startup', async () => {
    process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP = 'true';
    jest.doMock('@/app/NormalIndexScreen', () => {
      throw new Error('Normal application startup must not load in diagnostic mode.');
    });
    jest.doMock('@/app/NormalRootLayout', () => {
      throw new Error('Normal providers and Sentry.wrap must not load in diagnostic mode.');
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

    expect(screenTree.root.findByType('Text').props.children).toBe(
      'OliveOps started successfully'
    );
    expect(layoutTree.root.findAllByType('stack')).toHaveLength(1);
  });
});