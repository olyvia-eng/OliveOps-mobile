import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockRegisterRootComponent = jest.fn();
const mockRouterEntryLoaded = jest.fn();

jest.mock('expo', () => ({
  registerRootComponent: (...args: unknown[]) => mockRegisterRootComponent(...args),
}));

jest.mock('expo-router/entry', () => {
  mockRouterEntryLoaded();
  return {};
});

describe('application entry', () => {
  const originalFlag = process.env.EXPO_PUBLIC_DIAGNOSTIC_MINIMAL_BOOT;

  beforeEach(() => {
    jest.resetModules();
    mockRegisterRootComponent.mockReset();
    mockRouterEntryLoaded.mockReset();
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.EXPO_PUBLIC_DIAGNOSTIC_MINIMAL_BOOT;
    } else {
      process.env.EXPO_PUBLIC_DIAGNOSTIC_MINIMAL_BOOT = originalFlag;
    }
  });

  it('registers only the minimal React Native screen when diagnostic mode is enabled', () => {
    process.env.EXPO_PUBLIC_DIAGNOSTIC_MINIMAL_BOOT = 'true';

    jest.isolateModules(() => {
      require('../../index');
    });

    expect(mockRegisterRootComponent).toHaveBeenCalledTimes(1);
    expect(mockRouterEntryLoaded).not.toHaveBeenCalled();

    const MinimalDiagnosticApp = mockRegisterRootComponent.mock.calls[0][0] as () => React.ReactElement;
    const tree = MinimalDiagnosticApp();
    expect(JSON.stringify(tree)).toContain('OliveOps');
    expect(JSON.stringify(tree)).toContain('Minimal diagnostic build loaded successfully.');
  });

  it.each([undefined, 'false'])('loads the unchanged Expo Router entry when the flag is %s', (flag) => {
    if (flag === undefined) {
      delete process.env.EXPO_PUBLIC_DIAGNOSTIC_MINIMAL_BOOT;
    } else {
      process.env.EXPO_PUBLIC_DIAGNOSTIC_MINIMAL_BOOT = flag;
    }

    jest.isolateModules(() => {
      require('../../index');
    });

    expect(mockRouterEntryLoaded).toHaveBeenCalledTimes(1);
    expect(mockRegisterRootComponent).not.toHaveBeenCalled();
  });
});
