import { apiRequest } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type {
  CancelTimeOffResponse,
  CreateTimeOffRequest,
  CreateTimeOffResponse,
  ListTimeOffResponse,
  TimeOffDetailResponse,
} from '@/types/timeOff';

const base = ENDPOINTS.timeOffRequests;

export function createMyTimeOffRequest(payload: CreateTimeOffRequest, accessToken?: string) {
  return apiRequest<CreateTimeOffResponse>(`${base}?action=create`, {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
  });
}

export function listMyTimeOffRequests(accessToken?: string) {
  return apiRequest<ListTimeOffResponse>(`${base}?action=mine`, { accessToken });
}

export function getMyTimeOffRequest(requestId: string, accessToken?: string) {
  return apiRequest<TimeOffDetailResponse>(`${base}?action=detail&id=${encodeURIComponent(requestId)}`, { accessToken });
}

export function cancelMyTimeOffRequest(requestId: string, accessToken?: string) {
  return apiRequest<CancelTimeOffResponse>(`${base}?action=cancel&id=${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    accessToken,
  });
}