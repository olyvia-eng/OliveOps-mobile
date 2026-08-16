import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

describe('Expo root startup diagnostic screen', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP;
  });

  it('registers and renders without evaluating Router or normal application startup', async () => {
    process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP = 'true';
    let RegisteredRoot!: React.ComponentType;
    jest.doMock('expo', () => ({
      registerRootComponent: (component: React.ComponentType) => {
        RegisteredRoot = component;
      },
    }));

    jest.isolateModules(() => {
      require('../../src/config/diagnosticExpoRoot');
    });

    let screenTree: any;
    await act(async () => {
      screenTree = create(React.createElement(RegisteredRoot));
    });

    expect(screenTree.root.findByType('Text').props.children).toBe('OliveOps Router OK');
  });
});