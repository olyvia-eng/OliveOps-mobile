import { describe, expect, it } from '@jest/globals';
import { beginRequest, createRequestMeta, endRequest } from '@/services/requestGuards';

describe('requestGuards', () => {
  it('prevents duplicate clock-in submissions', () => {
    const key = 'clock-in:emp-1';
    expect(beginRequest(key)).toBe(true);
    expect(beginRequest(key)).toBe(false);
    endRequest(key);
    expect(beginRequest(key)).toBe(true);
    endRequest(key);
  });

  it('prevents duplicate clock-out submissions', () => {
    const key = 'clock-out:entry-1';
    expect(beginRequest(key)).toBe(true);
    expect(beginRequest(key)).toBe(false);
    endRequest(key);
  });

  it('creates request and idempotency metadata', () => {
    const meta = createRequestMeta('entry-1');
    expect(meta.requestId).toContain('entry-1');
    expect(meta.idempotencyKey).toContain(meta.requestId);
  });
});
