import { apiRequest } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { MySopDetailResponse, MySopListResponse } from '@/types/sop';

function withQuery(endpoint: string, values: Record<string, string>) {
  const params = new URLSearchParams(endpoint.split('?')[1] ?? '');
  for (const [key, value] of Object.entries(values)) params.set(key, value);
  return `${endpoint.split('?')[0]}?${params.toString()}`;
}

export function loadMySops(accessToken?: string): Promise<MySopListResponse> {
  return apiRequest<MySopListResponse>(ENDPOINTS.sopsMyList, { method: 'GET', accessToken });
}

export function loadMySopDetail(sopId: string, accessToken?: string): Promise<MySopDetailResponse> {
  return apiRequest<MySopDetailResponse>(withQuery(ENDPOINTS.sopsMyDetail, { sopId }), { method: 'GET', accessToken });
}