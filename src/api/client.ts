import { ENV } from '@/config/env';
import { fetchWithTimeout } from '@/services/fetchWithTimeout';
import { notifySessionExpired } from '@/services/sessionExpiry';
import { ApiError } from '@/types/errors';

const API_REQUEST_TIMEOUT_MS = 30_000;

type RequestInitWithAuth = RequestInit & {
  accessToken?: string;
};

function buildUrl(path: string) {
  if (!ENV.apiBaseUrl) {
    throw new ApiError('API base URL is not configured.', 500, 'API_BASE_URL_MISSING');
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return `${ENV.apiBaseUrl}${path}`;
}

async function readJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, init: RequestInitWithAuth = {}): Promise<T> {
  const url = buildUrl(path);
  const headers = new Headers(init.headers ?? {});
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'no-store, no-cache, max-age=0');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');

  if (init.accessToken) {
    headers.set('Authorization', `Bearer ${init.accessToken}`);
  }

  const response = await fetchWithTimeout(url, {
    ...init,
    cache: 'no-store',
    headers,
    credentials: 'include',
  }, API_REQUEST_TIMEOUT_MS);

  const payload = await readJson(response);

  if (response.status === 304) {
    throw new ApiError(
      'Cached API responses are not valid for authenticated application data.',
      response.status,
      'API_RESPONSE_NOT_MODIFIED',
    );
  }

  if (!response.ok || payload?.ok === false) {
    if (response.status === 401 && init.accessToken) {
      notifySessionExpired();
    }
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`;
    throw new ApiError(
      message,
      response.status,
      typeof payload?.code === 'string'
        ? payload.code
        : typeof payload?.status === 'string'
          ? payload.status
          : undefined,
      typeof payload?.fieldId === 'string' ? payload.fieldId : undefined,
      payload,
    );
  }

  if (payload === null) {
    throw new ApiError(
      'API response did not contain valid JSON.',
      response.status,
      'API_RESPONSE_INVALID_JSON',
    );
  }

  return payload as T;
}
