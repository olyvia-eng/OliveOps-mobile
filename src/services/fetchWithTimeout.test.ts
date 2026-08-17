import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fetchWithTimeout } from '@/services/fetchWithTimeout';

describe('fetchWithTimeout', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('aborts a request that exceeds its timeout', async () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch' as any).mockImplementation((_input: unknown, init: RequestInit) => (
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })
    ));

    const request = fetchWithTimeout('https://app.oliveops.ca/api/bootstrap', {}, 1000);
    const expectation = expect(request).rejects.toMatchObject({
      status: 408,
      code: 'REQUEST_TIMEOUT',
    });
    await jest.advanceTimersByTimeAsync(1000);

    await expectation;
  });
});