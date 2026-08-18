import { ApiError } from '@/types/errors';

export function toFormsError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please log in again.';
    if (error.status === 403) return 'This form is not available to your employee account.';
    if (error.status === 404) return 'This form is no longer available.';
    if (error.status === 409) return 'This form may already be completed. Refreshing Forms will confirm its status.';
    if (error.status === 408 || error.code === 'REQUEST_TIMEOUT') {
      return 'The request timed out. Your answers are still here.';
    }
    if (error.status === 400) return 'Some answers need attention before this form can be submitted.';
  }

  return fallback;
}