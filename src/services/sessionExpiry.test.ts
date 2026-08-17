import { describe, expect, it, jest } from '@jest/globals';
import { notifySessionExpired, registerSessionExpiryHandler } from '@/services/sessionExpiry';

describe('sessionExpiry', () => {
  it('notifies the active handler and unregisters it safely', () => {
    const handler = jest.fn();
    const unregister = registerSessionExpiryHandler(handler);

    notifySessionExpired();
    expect(handler).toHaveBeenCalledTimes(1);

    unregister();
    notifySessionExpired();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});