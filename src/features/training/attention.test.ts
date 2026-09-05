import { describe, expect, it } from '@jest/globals';
import { getBootstrapTrainingAttention } from '@/features/training/attention';

describe('getBootstrapTrainingAttention', () => {
  it('keeps legacy bootstrap responses from clearing cached attention', () => {
    expect(getBootstrapTrainingAttention({ ok: true })).toBeNull();
  });

  it('normalizes overdue and due-soon counters', () => {
    expect(getBootstrapTrainingAttention({
      ok: true,
      trainingAttentionCount: 7,
      overdueTrainingCount: 3,
      dueSoonTrainingCount: 4,
    })).toEqual({ overdueCount: 3, dueSoonCount: 4 });
  });

  it('uses the aggregate as a backward-compatible fallback', () => {
    expect(getBootstrapTrainingAttention({ ok: true, trainingAttentionCount: 5 })).toEqual({
      overdueCount: 0,
      dueSoonCount: 5,
    });
  });
});