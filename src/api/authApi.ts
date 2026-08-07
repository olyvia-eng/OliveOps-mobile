import { ENDPOINTS } from '@/api/endpoints';
import { apiRequest } from '@/api/client';
import type { AuthSessionResponse } from '@/types/api';

export async function login(email: string, password: string): Promise<AuthSessionResponse> {
  return apiRequest<AuthSessionResponse>(ENDPOINTS.authLogin, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
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
