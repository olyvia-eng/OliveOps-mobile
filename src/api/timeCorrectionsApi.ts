import { apiRequest } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type {
  CreateTimeCorrectionRequest,
  CreateTimeCorrectionResponse,
  EffectiveTimeEntriesResponse,
  ListTimeCorrectionsResponse,
} from '@/types/api';

export async function createTimeCorrection(
  payload: CreateTimeCorrectionRequest,
  accessToken?: string,
): Promise<CreateTimeCorrectionResponse> {
  return apiRequest<CreateTimeCorrectionResponse>(ENDPOINTS.timeCorrectionsCreate, {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
  });
}

export async function listMyTimeCorrections(accessToken?: string): Promise<ListTimeCorrectionsResponse> {
  return apiRequest<ListTimeCorrectionsResponse>(ENDPOINTS.timeCorrectionsList, {
    method: 'GET',
    accessToken,
  });
}

export async function listEffectiveTimeEntries(accessToken?: string): Promise<EffectiveTimeEntriesResponse> {
  return apiRequest<EffectiveTimeEntriesResponse>(ENDPOINTS.timeCorrectionsEffectiveTimeEntries, {
    method: 'GET',
    accessToken,
  });
}
