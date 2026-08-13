import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockInit = jest.fn();

jest.mock('@sentry/react-native', () => ({
  init: (...args: unknown[]) => mockInit(...args),
}));

import { initializeSentry } from '@/config/sentry';

describe('Sentry native initialization handoff', () => {
  beforeEach(() => {
    mockInit.mockReset();
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://public@example.ingest.sentry.io/1';
  });

  it('keeps native capture enabled without reinitializing the native SDK from JavaScript', () => {
    initializeSentry();

    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
        enableNative: true,
        enableNativeCrashHandling: true,
        autoInitializeNativeSdk: false,
      })
    );
  });
});