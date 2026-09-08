import { describe, expect, it } from '@jest/globals';
import { normalizeCompanyFeatures } from '@/features/companyFeatures';

describe('normalizeCompanyFeatures', () => {
  it.each([
    [undefined, { projects: true, recurringServices: true, snowOperations: false }],
    [null, { projects: true, recurringServices: true, snowOperations: false }],
    [{}, { projects: true, recurringServices: true, snowOperations: false }],
    [{ snowOperations: true }, { projects: true, recurringServices: true, snowOperations: true }],
    [
      { projects: false, recurringServices: true, snowOperations: false },
      { projects: false, recurringServices: true, snowOperations: false },
    ],
    [
      { projects: 'false', recurringServices: 0, snowOperations: 'true' },
      { projects: true, recurringServices: true, snowOperations: false },
    ],
  ])('normalizes %p to effective company defaults', (input, expected) => {
    expect(normalizeCompanyFeatures(input)).toEqual(expected);
  });
});