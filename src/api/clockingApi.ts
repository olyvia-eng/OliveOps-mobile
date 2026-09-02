import { apiRequest } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type {
  ActiveUnbillableCategoriesResponse,
  BootstrapResponse,
  ClockInRequest,
  ClockInResponse,
  ClockOutRequest,
  ClockOutResponse,
  FinalizeClockInRequest,
  FinalizeClockInResponse,
  FinalizeClockOutRequest,
  PendingClockInResponse,
  PendingClockOutResponse,
  CurrentShiftWorkAreaTimelineResponse,
  ReconcileCurrentShiftWorkAreasRequest,
  ReconcileCurrentShiftWorkAreasResponse,
  SwitchActivityRequest,
} from '@/types/api';
import type { TimeEntry } from '@/types/domain';

const bootstrapRequests = new Map<string, Promise<BootstrapResponse>>();

export function loadBootstrap(
  accessToken?: string,
  options: { force?: boolean } = {},
): Promise<BootstrapResponse> {
  const requestKey = accessToken ?? '';
  const inFlightRequest = options.force ? undefined : bootstrapRequests.get(requestKey);
  if (inFlightRequest) return inFlightRequest;

  const request = apiRequest<BootstrapResponse>(ENDPOINTS.bootstrap, {
    method: 'GET',
    accessToken,
  });

  if (!options.force) {
    bootstrapRequests.set(requestKey, request);
  }
  void request.then(
    () => {
      if (!options.force && bootstrapRequests.get(requestKey) === request) {
        bootstrapRequests.delete(requestKey);
      }
    },
    () => {
      if (!options.force && bootstrapRequests.get(requestKey) === request) {
        bootstrapRequests.delete(requestKey);
      }
    }
  );

  return request;
}

export async function clockIn(payload: ClockInRequest, accessToken?: string): Promise<ClockInResponse> {
  return apiRequest<ClockInResponse>(ENDPOINTS.clockIn, {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
  });
}

export async function loadPendingClockIn(accessToken?: string): Promise<PendingClockInResponse> {
  return apiRequest<PendingClockInResponse>(ENDPOINTS.pendingClockIn, {
    method: 'GET',
    accessToken,
  });
}

export async function finalizeClockIn(
  payload: FinalizeClockInRequest,
  accessToken?: string,
): Promise<FinalizeClockInResponse> {
  return apiRequest<FinalizeClockInResponse>(ENDPOINTS.finalizeClockIn, {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
  });
}

export async function clockOut(payload: ClockOutRequest, accessToken?: string): Promise<ClockOutResponse> {
  return apiRequest<ClockOutResponse>(ENDPOINTS.clockOut, {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
  });
}

export async function loadPendingClockOut(accessToken?: string): Promise<PendingClockOutResponse> {
  return apiRequest<PendingClockOutResponse>(ENDPOINTS.pendingClockOut, {
    method: 'GET',
    accessToken,
  });
}

export async function finalizeClockOut(
  payload: FinalizeClockOutRequest,
  accessToken?: string,
): Promise<ClockOutResponse> {
  return apiRequest<ClockOutResponse>(ENDPOINTS.finalizeClockOut, {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
  });
}

export async function switchActivity(payload: SwitchActivityRequest, accessToken?: string): Promise<{ ok: boolean; timeEntry: TimeEntry }> {
  return apiRequest<{ ok: boolean; timeEntry: TimeEntry }>(ENDPOINTS.switchActivity, {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
  });
}

export async function loadCurrentShiftWorkAreaTimeline(accessToken?: string): Promise<CurrentShiftWorkAreaTimelineResponse> {
  return apiRequest<CurrentShiftWorkAreaTimelineResponse>(ENDPOINTS.currentShiftWorkAreaTimeline, {
    method: 'GET',
    accessToken,
  });
}

export async function reconcileCurrentShiftWorkAreas(
  payload: ReconcileCurrentShiftWorkAreasRequest,
  accessToken?: string,
): Promise<ReconcileCurrentShiftWorkAreasResponse> {
  return apiRequest<ReconcileCurrentShiftWorkAreasResponse>(ENDPOINTS.reconcileCurrentShiftWorkAreas, {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
  });
}

export async function loadActiveUnbillableCategories(accessToken?: string): Promise<ActiveUnbillableCategoriesResponse> {
  return apiRequest<ActiveUnbillableCategoriesResponse>(ENDPOINTS.activeUnbillableCategories, {
    method: 'GET',
    accessToken,
  });
}
