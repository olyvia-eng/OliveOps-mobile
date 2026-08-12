import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  getStartupCheckpoints,
  recordStartupCheckpoint,
  resetStartupCheckpointsForTests,
} from '@/services/startupDiagnostics';

describe('startupDiagnostics', () => {
  beforeEach(() => {
    resetStartupCheckpointsForTests();
  });

  it('records only fixed startup checkpoints in memory and console', () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    recordStartupCheckpoint('ROOT_LAYOUT_RENDER');
    recordStartupCheckpoint('SESSION_BOOTSTRAP_START');

    expect(getStartupCheckpoints()).toEqual([
      'ROOT_LAYOUT_RENDER',
      'SESSION_BOOTSTRAP_START',
    ]);
    expect(consoleSpy.mock.calls).toEqual([
      ['[OliveOps startup]', 'ROOT_LAYOUT_RENDER'],
      ['[OliveOps startup]', 'SESSION_BOOTSTRAP_START'],
    ]);
    consoleSpy.mockRestore();
  });
});