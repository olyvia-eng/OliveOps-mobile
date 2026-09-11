import type { SopVersion } from '@/types/sop';

export function filterSops(sops: SopVersion[], query: string, category: string) {
  const normalized = query.trim().toLowerCase();
  return sops.filter((item) => (category === 'All' || item.category === category)
    && (!normalized || `${item.title} ${item.shortDescription} ${item.category}`.toLowerCase().includes(normalized)));
}