import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

const originalDiagnosticFlag = process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP;

describe('native startup entry', () => {
  afterEach(() => {
    if (originalDiagnosticFlag === undefined) {
      delete process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP;
    } else {
      process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP = originalDiagnosticFlag;
    }
    jest.dontMock('@/config/diagnosticNativeStartup');
    jest.dontMock('@/config/sentry');
    jest.dontMock('expo-router/entry');
    jest.dontMock('react-native');
  });

  it('loads only the diagnostic registration module in diagnostic mode', () => {
    process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP = 'true';
    const startupOrder: string[] = [];

    jest.doMock('@/config/diagnosticNativeStartup', () => {
      startupOrder.push('diagnostic');
      return {};
    });
    jest.doMock('@/config/sentry', () => {
      throw new Error('Sentry must not load in diagnostic mode.');
    });
    jest.doMock('expo-router/entry', () => {
      throw new Error('Expo Router must not load in diagnostic mode.');
    });

    jest.isolateModules(() => {
      require('../../index');
    });

    expect(startupOrder).toEqual(['diagnostic']);
  });

  it('initializes Sentry before Expo Router in normal mode', () => {
    delete process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP;
    const startupOrder: string[] = [];

    jest.doMock('@/config/diagnosticNativeStartup', () => {
      throw new Error('Diagnostic startup must not load in normal mode.');
    });
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

  it('uses only React Native core and registers Expo native module main', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'diagnosticNativeStartup.tsx'),
      'utf8'
    );
    const imports = [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(
      match => match[1]
    );

    expect(imports).toEqual(['react', 'react-native']);
    expect(source).not.toContain('require(');
    expect(source).toContain("AppRegistry.registerComponent('main', () => DiagnosticNativeStartup)");
    expect(source).toContain('<View>');
    expect(source).toContain('<Text>OliveOps native startup OK</Text>');
  });
});