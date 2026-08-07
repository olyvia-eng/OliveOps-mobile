import { ENV } from '@/config/env';
import { ApiError } from '@/types/errors';

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

  if (init.accessToken) {
    headers.set('Authorization', `Bearer ${init.accessToken}`);
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });

  const payload = await readJson(response);

  if (!response.ok || payload?.ok === false) {
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, payload?.code);
  }

  return payload as T;
}
