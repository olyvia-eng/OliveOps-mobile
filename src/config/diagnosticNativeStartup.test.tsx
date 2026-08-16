import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

const originalDiagnosticFlag = process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP;

describe('Expo root startup diagnostic entry', () => {
  afterEach(() => {
    if (originalDiagnosticFlag === undefined) {
      delete process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP;
    } else {
      process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP = originalDiagnosticFlag;
    }
    jest.dontMock('@/config/sentry');
    jest.dontMock('@/config/diagnosticExpoRoot');
    jest.dontMock('expo-router/entry');
  });

  it('loads the Expo root diagnostic without Sentry or Router in diagnostic mode', () => {
    process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP = 'true';
    const startupOrder: string[] = [];

    jest.doMock('@/config/sentry', () => {
      throw new Error('Sentry must not load in diagnostic mode.');
    });
    jest.doMock('expo-router/entry', () => {
      throw new Error('Expo Router must not load in diagnostic mode.');
    });
    jest.doMock('@/config/diagnosticExpoRoot', () => {
      startupOrder.push('expo-root');
      return {};
    });

    jest.isolateModules(() => {
      require('../../index');
    });

    expect(startupOrder).toEqual(['expo-root']);
  });

  it('initializes Sentry before Expo Router in normal mode', () => {
    delete process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP;
    const startupOrder: string[] = [];

    jest.doMock('@/config/sentry', () => ({
      initializeSentry: () => startupOrder.push('sentry'),
    }));
    jest.doMock('expo-router/entry', () => {
      startupOrder.push('router');
      return {};
    });

    jest.isolateModules(() => {
      require('../../index');
    });

    expect(startupOrder).toEqual(['sentry', 'router']);
  });

  it('keeps the Expo root diagnostic limited to React, React Native, and Expo', () => {
    const source = fs.readFileSync(path.join(__dirname, 'diagnosticExpoRoot.tsx'), 'utf8');
    const imports = (source: string) =>
      [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(match => match[1]);

    expect(imports(source)).toEqual(['react', 'expo', 'react-native']);
    expect(source).toContain('registerRootComponent(DiagnosticExpoRoot)');
    expect(source).toContain('<Text>OliveOps Router OK</Text>');
  });
});