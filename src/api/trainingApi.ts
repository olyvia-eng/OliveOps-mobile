import { apiRequest } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type {
  CompleteTrainingRequest,
  CompleteTrainingResponse,
  MyTrainingDetailResponse,
  MyTrainingHistoryResponse,
  MyTrainingListResponse,
} from '@/types/training';

const listRequests = new Map<string, Promise<MyTrainingListResponse>>();
const historyRequests = new Map<string, Promise<MyTrainingHistoryResponse>>();

function withQuery(endpoint: string, values: Record<string, string>) {
  const params = new URLSearchParams(endpoint.split('?')[1] ?? '');
  for (const [key, value] of Object.entries(values)) params.set(key, value);
  return `${endpoint.split('?')[0]}?${params.toString()}`;
}

function singleFlight<T>(
  requests: Map<string, Promise<T>>,
  accessToken: string | undefined,
  force: boolean,
  requestFactory: () => Promise<T>,
) {
  const key = accessToken ?? '';
  const existing = force ? undefined : requests.get(key);
  if (existing) return existing;
  const request = requestFactory();
  if (!force) requests.set(key, request);
  void request.finally(() => {
    if (!force && requests.get(key) === request) requests.delete(key);
  }).catch(() => undefined);
  return request;
}

export function loadMyTraining(
  accessToken?: string,
  options: { force?: boolean } = {},
): Promise<MyTrainingListResponse> {
  return singleFlight(listRequests, accessToken, options.force === true, () => apiRequest<MyTrainingListResponse>(ENDPOINTS.trainingMyList, {
    method: 'GET',
    accessToken,
  }));
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

export function loadMyTrainingHistory(
  accessToken?: string,
  options: { force?: boolean } = {},
): Promise<MyTrainingHistoryResponse> {
  return singleFlight(historyRequests, accessToken, options.force === true, () => apiRequest<MyTrainingHistoryResponse>(ENDPOINTS.trainingMyHistory, {
    method: 'GET',
    accessToken,
  }));
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