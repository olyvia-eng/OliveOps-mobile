import { describe, expect, it } from '@jest/globals';
import { normalizeContentMode } from '@/types/document';

describe('normalizeContentMode', () => {
  it('uses document mode only when explicitly declared', () => {
    expect(normalizeContentMode('document')).toBe('document');
    expect(normalizeContentMode('structured')).toBe('structured');
    expect(normalizeContentMode(undefined)).toBe('structured');
  });
});