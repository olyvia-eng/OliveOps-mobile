import { describe, expect, it } from '@jest/globals';
import { filterSops } from './presentation';
import type { SopVersion } from '@/types/sop';

const sops = [
  { sopId: 'one', title: 'Lockout Procedure', category: 'Safety', shortDescription: 'Equipment isolation' },
  { sopId: 'two', title: 'Daily Cleanup', category: 'Operations', shortDescription: 'End of shift housekeeping' },
] as SopVersion[];

describe('SOP list filtering', () => {
  it('searches title, description, and category case-insensitively', () => {
    expect(filterSops(sops, 'ISOLATION', 'All').map((item) => item.sopId)).toEqual(['one']);
    expect(filterSops(sops, 'operations', 'All').map((item) => item.sopId)).toEqual(['two']);
  });

  it('combines category and text filters without changing source order', () => {
    expect(filterSops(sops, 'procedure', 'Safety').map((item) => item.sopId)).toEqual(['one']);
    expect(filterSops(sops, 'cleanup', 'Safety')).toEqual([]);
  });
});