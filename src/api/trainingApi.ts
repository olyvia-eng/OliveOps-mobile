import { apiRequest } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type {
  CompleteTrainingRequest,
  CompleteTrainingResponse,
  MyTrainingDetailResponse,
  MyTrainingHistoryResponse,
  MyTrainingListResponse,
} from '@/types/training';

function withQuery(endpoint: string, values: Record<string, string>) {
  const params = new URLSearchParams(endpoint.split('?')[1] ?? '');
  for (const [key, value] of Object.entries(values)) params.set(key, value);
  return `${endpoint.split('?')[0]}?${params.toString()}`;
}

export function loadMyTraining(accessToken?: string): Promise<MyTrainingListResponse> {
  return apiRequest<MyTrainingListResponse>(ENDPOINTS.trainingMyList, {
    method: 'GET',
    accessToken,
  });
}

export function loadMyTrainingDetail(
  assignmentId: string,
  accessToken?: string,
): Promise<MyTrainingDetailResponse> {
  return apiRequest<MyTrainingDetailResponse>(withQuery(ENDPOINTS.trainingMyDetail, { assignmentId }), {
    method: 'GET',
    accessToken,
  });
}

export function loadMyTrainingHistory(accessToken?: string): Promise<MyTrainingHistoryResponse> {
  return apiRequest<MyTrainingHistoryResponse>(ENDPOINTS.trainingMyHistory, {
    method: 'GET',
    accessToken,
  });
}

export function completeTraining(
  payload: CompleteTrainingRequest,
  accessToken?: string,
): Promise<CompleteTrainingResponse> {
  return apiRequest<CompleteTrainingResponse>(ENDPOINTS.trainingComplete, {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
  });
}