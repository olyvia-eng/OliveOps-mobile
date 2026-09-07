import { apiRequest } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type {
  AddServiceVisitNoteRequest,
  AddServiceVisitNoteResponse,
  CompleteServiceVisitRequest,
  ServiceVisitDetailResponse,
  ServiceVisitMutationResponse,
} from '@/types/serviceVisit';

function visitEndpoint(action: 'detail' | 'add-note' | 'complete', jobId: string, visitId: string) {
  const params = new URLSearchParams({ action, jobId, visitId });
  return `${ENDPOINTS.serviceVisits}?${params.toString()}`;
}

export function loadServiceVisitDetail(jobId: string, visitId: string, accessToken?: string) {
  return apiRequest<ServiceVisitDetailResponse>(visitEndpoint('detail', jobId, visitId), {
    method: 'GET',
    accessToken,
  });
}

export function addServiceVisitNote(jobId: string, payload: AddServiceVisitNoteRequest, accessToken?: string) {
  return apiRequest<AddServiceVisitNoteResponse>(visitEndpoint('add-note', jobId, payload.visitId), {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
  });
}

export function completeServiceVisit(jobId: string, payload: CompleteServiceVisitRequest, accessToken?: string) {
  return apiRequest<ServiceVisitMutationResponse>(visitEndpoint('complete', jobId, payload.visitId), {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
  });
}