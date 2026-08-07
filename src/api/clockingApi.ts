import { apiRequest } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type {
  BootstrapResponse,
  ClockInRequest,
  ClockOutRequest,
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
