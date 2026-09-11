import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, jest } from '@jest/globals';

const mockRefreshWorkContext = jest.fn().mockResolvedValue({ ok: true });
const mockRefreshAssignments = jest.fn().mockResolvedValue({ ok: true });
const mockReplayServiceVisitOutbox = jest.fn().mockResolvedValue(undefined);
const mockReplaySnowOutbox = jest.fn().mockResolvedValue(undefined);
let appStateListener: ((state: string) => void) | null = null;

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    accessToken: 'token-1', status: 'authenticated',
    user: { businessId: 'business-1', id: 'user-1', employeeId: 'employee-1' },
  }),
}));
jest.mock('@/hooks/useClockingActions', () => ({
  useClockingActions: () => ({ refreshWorkContext: mockRefreshWorkContext }),
}));
jest.mock('@/hooks/useTrainingActions', () => ({
  useTrainingActions: () => ({ refreshAssignments: mockRefreshAssignments }),
}));
jest.mock('@/services/serviceVisitOutbox', () => ({
  replayServiceVisitOutbox: (...args: unknown[]) => mockReplayServiceVisitOutbox(...args),
}));
jest.mock('@/services/snowOperationsOutbox', () => ({
  replaySnowOutbox: (...args: unknown[]) => mockReplaySnowOutbox(...args),
}));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn(() => jest.fn()) },
}));
jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn((_event, listener) => {
      appStateListener = listener;
      return { remove: jest.fn() };
    }),
  },
  NativeModules: {},
  Platform: { select: (values: any) => values.ios ?? values.default },
  TurboModuleRegistry: { get: () => null },
}));

import { AppLifecycleSync } from './AppLifecycleSync';

describe('AppLifecycleSync', () => {
  it('owns one work-context refresh for a background to active transition', async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AppLifecycleSync />); });
    mockRefreshWorkContext.mockClear();
    mockRefreshAssignments.mockClear();

    await act(async () => appStateListener?.('active'));
    expect(mockRefreshWorkContext).not.toHaveBeenCalled();

    await act(async () => appStateListener?.('background'));
    await act(async () => appStateListener?.('active'));

    expect(mockRefreshWorkContext).toHaveBeenCalledTimes(1);
    expect(mockRefreshAssignments).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
  });
});