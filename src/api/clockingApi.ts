import { apiRequest } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type {
  ActiveUnbillableCategoriesResponse,
  BootstrapResponse,
  ClockInRequest,
  ClockOutRequest,
  SwitchActivityRequest,
} from '@/types/api';
import type { TimeEntry } from '@/types/domain';

export async function loadBootstrap(accessToken?: string): Promise<BootstrapResponse> {
  return apiRequest<BootstrapResponse>(ENDPOINTS.bootstrap, {
    method: 'GET',
    accessToken,
  });
}

export async function clockIn(payload: ClockInRequest, accessToken?: string): Promise<{ ok: boolean; timeEntry: TimeEntry }> {
  return apiRequest<{ ok: boolean; timeEntry: TimeEntry }>(ENDPOINTS.clockIn, {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
  });
}

export async function clockOut(payload: ClockOutRequest, accessToken?: string): Promise<{ ok: boolean; timeEntry?: TimeEntry }> {
  return apiRequest<{ ok: boolean; timeEntry?: TimeEntry }>(ENDPOINTS.clockOut, {
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

export async function loadActiveUnbillableCategories(accessToken?: string): Promise<ActiveUnbillableCategoriesResponse> {
  return apiRequest<ActiveUnbillableCategoriesResponse>(ENDPOINTS.activeUnbillableCategories, {
    method: 'GET',
    accessToken,
  });
}
