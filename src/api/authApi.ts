import { ENDPOINTS } from '@/api/endpoints';
import { apiRequest } from '@/api/client';
import type { AuthSessionResponse } from '@/types/api';
import type { SessionUser } from '@/types/domain';
import { ApiError } from '@/types/errors';

type MobileLoginResponse = AuthSessionResponse & {
  user: SessionUser;
  accessToken: string;
};

export async function login(email: string, password: string): Promise<MobileLoginResponse> {
  const response = await apiRequest<AuthSessionResponse>(ENDPOINTS.authMobileLogin, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (!response.user || !response.accessToken) {
    throw new ApiError('Mobile login response did not include a usable session.', 502, 'MOBILE_AUTH_UNAVAILABLE');
  }

  return response as MobileLoginResponse;
}

export async function getSession(accessToken?: string): Promise<AuthSessionResponse> {
  return apiRequest<AuthSessionResponse>(ENDPOINTS.authSession, {
    method: 'GET',
    accessToken,
  });
}

export async function logout(accessToken?: string): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(ENDPOINTS.authLogout, {
    method: 'POST',
    accessToken,
  });
}
