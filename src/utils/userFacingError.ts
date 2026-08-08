import { ApiError } from '@/types/errors';

export function toUserFacingError(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.status === 401) {
    return 'Your session has expired. Please log in again.';
  }

  return fallback;
}