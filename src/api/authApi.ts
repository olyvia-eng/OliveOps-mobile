import { ENDPOINTS } from '@/api/endpoints';
import { apiRequest } from '@/api/client';
import type { AuthSessionResponse } from '@/types/api';
import { ApiError } from '@/types/errors';

function isInvalidAuthActionError(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  return error.status === 400 && /invalid auth action/i.test(error.message);
}

export async function login(email: string, password: string): Promise<AuthSessionResponse> {
  try {
    return await apiRequest<AuthSessionResponse>(ENDPOINTS.authMobileLogin, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  } catch (error) {
    if (!isInvalidAuthActionError(error)) {
      throw error;
    }

    const fallback = await apiRequest<AuthSessionResponse>(ENDPOINTS.authLogin, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (!fallback.accessToken) {
      throw new ApiError('Mobile sign-in is currently unavailable. Please try again shortly.', 503, 'MOBILE_AUTH_UNAVAILABLE');
    }

    return fallback;
  }
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
