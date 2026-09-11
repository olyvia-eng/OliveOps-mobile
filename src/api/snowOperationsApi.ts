import { apiRequest } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type {
  SnowAssignmentResponse,
  SnowCommandBase,
  SnowCommandContext,
  SnowCommandResponse,
  SnowFieldAction,
  SnowServiceTypesResponse,
} from '@/types/snowOperations';

function snowEndpoint(action: string, context: Partial<SnowCommandContext> = {}) {
  const params = new URLSearchParams({ action });
  for (const [key, value] of Object.entries(context)) {
    if (value) params.set(key, value);
  }
  return `${ENDPOINTS.snowOperations}?${params.toString()}`;
}

export function loadMyActiveSnowRoute(accessToken?: string) {
  return apiRequest<SnowAssignmentResponse>(snowEndpoint('my-active-route'), { method: 'GET', accessToken });
}

export function loadSnowServiceTypes(accessToken?: string) {
  return apiRequest<SnowServiceTypesResponse>(snowEndpoint('service-types'), { method: 'GET', accessToken });
}

export function startSnowRoute(context: Pick<SnowCommandContext, 'eventId' | 'routeId'>, payload: Pick<SnowCommandBase, 'clientSubmissionId'>, accessToken?: string) {
  return apiRequest<SnowCommandResponse>(snowEndpoint('start-route', context), {
    method: 'POST', body: JSON.stringify(payload), accessToken,
  });
}

export function completeSnowRoute(context: Pick<SnowCommandContext, 'eventId' | 'routeId'>, payload: Pick<SnowCommandBase, 'clientSubmissionId'>, accessToken?: string) {
  return apiRequest<SnowCommandResponse>(snowEndpoint('complete-route', context), {
    method: 'POST', body: JSON.stringify(payload), accessToken,
  });
}

export function runSnowFieldCommand(
  action: SnowFieldAction,
  context: SnowCommandContext,
  payload: SnowCommandBase & { serviceTypeId?: string; fileId?: string; reason?: string; points?: import('@/types/snowOperations').SnowBreadcrumbPoint[] },
  accessToken?: string,
) {
  return apiRequest<SnowCommandResponse>(snowEndpoint(action, context), {
    method: 'POST', body: JSON.stringify(payload), accessToken,
  });
}