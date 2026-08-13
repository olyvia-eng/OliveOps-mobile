import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockRouterEntryLoaded = jest.fn();
const mockReactNativeHandler = jest.fn();
let mockInstalledHandler: ((error: unknown, isFatal: boolean) => void) | undefined;
let mockHandlerAtRouterLoad: ((error: unknown, isFatal: boolean) => void) | undefined;

jest.mock('expo-router/entry', () => {
  mockHandlerAtRouterLoad = mockInstalledHandler;
  mockRouterEntryLoaded();
  return {};
});

describe('temporary TestFlight startup diagnostic entry', () => {
  const originalErrorUtils = globalThis.ErrorUtils;
  const originalAlert = globalThis.alert;

  beforeEach(() => {
    jest.resetModules();
    mockRouterEntryLoaded.mockReset();
    mockReactNativeHandler.mockReset();
    mockInstalledHandler = mockReactNativeHandler;
    mockHandlerAtRouterLoad = undefined;
    globalThis.ErrorUtils = {
      getGlobalHandler: () => mockReactNativeHandler,
      setGlobalHandler: handler => {
        mockInstalledHandler = handler;
      },
    } as typeof globalThis.ErrorUtils;
    globalThis.alert = jest.fn();
  });

  afterEach(() => {
    globalThis.ErrorUtils = originalErrorUtils;
    globalThis.alert = originalAlert;
  });

  it('installs the handler before loading Expo Router', () => {
    jest.isolateModules(() => {
      require('../../index');
    });

    expect(mockRouterEntryLoaded).toHaveBeenCalledTimes(1);
    expect(mockHandlerAtRouterLoad).toBeDefined();
    expect(mockHandlerAtRouterLoad).not.toBe(mockReactNativeHandler);
  });

  it('shows sanitized fatal details without forwarding to React Native fatal termination', () => {
    jest.isolateModules(() => {
      require('../../index');
    });

    mockInstalledHandler?.(
      new Error('Startup failed token=secret-value for person@example.com'),
      true
    );

    expect(globalThis.alert).toHaveBeenCalledWith(expect.stringContaining('OliveOps Startup Error'));
    expect(globalThis.alert).toHaveBeenCalledWith(expect.stringContaining('Fatal: true'));
    expect(globalThis.alert).toHaveBeenCalledWith(expect.stringContaining('token=[REDACTED]'));
    expect(globalThis.alert).toHaveBeenCalledWith(expect.stringContaining('[REDACTED EMAIL]'));
    expect(globalThis.alert).not.toHaveBeenCalledWith(expect.stringContaining('secret-value'));
    expect(mockReactNativeHandler).not.toHaveBeenCalled();
  });

  it('continues forwarding nonfatal errors to React Native', () => {
    jest.isolateModules(() => {
      require('../../index');
    });

    const error = new Error('Nonfatal diagnostic');
    mockInstalledHandler?.(error, false);

    expect(mockReactNativeHandler).toHaveBeenCalledWith(error, false);
  });

  it('shows a fatal error even after an earlier nonfatal diagnostic', () => {
    jest.isolateModules(() => {
      require('../../index');
    });

    mockInstalledHandler?.(new Error('Earlier rejection'), false);
    mockInstalledHandler?.(new Error('Fatal startup failure'), true);

    expect(globalThis.alert).toHaveBeenCalledTimes(2);
    expect(globalThis.alert).toHaveBeenLastCalledWith(expect.stringContaining('Fatal startup failure'));
  });
});
