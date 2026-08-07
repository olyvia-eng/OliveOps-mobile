import { apiRequest } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type {
  ActivityConfig,
  BootstrapResponse,
  ClockInRequest,
  ClockOutRequest,
  MobileCapabilities,
  SwitchActivityRequest,
} from '@/types/api';
import type { TimeEntry } from '@/types/domain';

export type BootstrapResponseWithConfig = BootstrapResponse & {
  capabilities?: MobileCapabilities;
  activityConfigs?: ActivityConfig[];
};

export async function loadBootstrap(accessToken?: string): Promise<BootstrapResponseWithConfig> {
  return apiRequest<BootstrapResponseWithConfig>(ENDPOINTS.bootstrap, {
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
