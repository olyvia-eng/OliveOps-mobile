import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

const originalDiagnosticFlag = process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP;

describe('Router startup diagnostic entry', () => {
  afterEach(() => {
    if (originalDiagnosticFlag === undefined) {
      delete process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP;
    } else {
      process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP = originalDiagnosticFlag;
    }
    jest.dontMock('@/config/sentry');
    jest.dontMock('expo-router/entry');
  });

  it('loads Expo Router without Sentry in diagnostic mode', () => {
    process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP = 'true';
    const startupOrder: string[] = [];

    jest.doMock('@/config/sentry', () => {
      throw new Error('Sentry must not load in diagnostic mode.');
    });
    jest.doMock('expo-router/entry', () => {
      startupOrder.push('router');
      return {};
    });

    jest.isolateModules(() => {
      require('../../index');
    });

    expect(startupOrder).toEqual(['router']);
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

  it('keeps diagnostic route wrappers behind minimal static imports', () => {
    const layoutSource = fs.readFileSync(path.join(__dirname, '../../app/_layout.tsx'), 'utf8');
    const indexSource = fs.readFileSync(path.join(__dirname, '../../app/index.tsx'), 'utf8');
    const imports = (source: string) =>
      [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(match => match[1]);

    expect(imports(layoutSource)).toEqual(['expo-router']);
    expect(imports(indexSource)).toEqual(['react-native']);
    expect(indexSource).toContain('<Text>OliveOps Router OK</Text>');
  });
});