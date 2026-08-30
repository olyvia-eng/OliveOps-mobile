import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDismissTo = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    dismissTo: (...args: unknown[]) => mockDismissTo(...args),
  },
}));

import { returnToParentOrReplace, returnToParentThenPush } from '@/utils/navigation';

describe('returnToParentOrReplace', () => {
  beforeEach(async () => {
    await Promise.resolve();
    mockDismissTo.mockClear();
  });

  it('dismisses to an existing parent or replaces the current route when absent', () => {
    returnToParentOrReplace('/time-off');

    expect(mockDismissTo).toHaveBeenCalledWith('/time-off');
  });

  it('ignores repeated completion calls during the same navigation transition', () => {
    returnToParentOrReplace('/active-shift');
    returnToParentOrReplace('/active-shift');

    expect(mockDismissTo).toHaveBeenCalledTimes(1);
  });

  it('collapses a workflow to its parent before opening the destination', () => {
    const mockPush = jest.fn();
    const { router } = jest.requireMock('expo-router') as { router: { push?: typeof mockPush } };
    router.push = mockPush;

    returnToParentThenPush('/home', '/active-shift');

    expect(mockDismissTo).toHaveBeenCalledWith('/home');
    expect(mockPush).toHaveBeenCalledWith('/active-shift');
  });
});