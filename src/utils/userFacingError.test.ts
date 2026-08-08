import { describe, expect, it } from '@jest/globals';
import { ApiError } from '@/types/errors';
import { toUserFacingError } from '@/utils/userFacingError';

describe('toUserFacingError', () => {
  it('returns a safe session message for unauthorized API responses', () => {
    const error = new ApiError('Bearer token abc123 was rejected by internal auth middleware.', 401, 'UNAUTHORIZED');

    expect(toUserFacingError(error, 'Clock-in failed. Please try again.')).toBe(
      'Your session has expired. Please log in again.'
    );
  });

  it('does not expose backend API error details', () => {
    const error = new ApiError('S3 upload bucket oliveops-private failed.', 500, 'STORAGE_INTERNAL');

    expect(toUserFacingError(error, 'Photo upload failed. Please try again.')).toBe(
      'Photo upload failed. Please try again.'
    );
  });

  it('does not expose arbitrary exception details', () => {
    const error = new Error('Database connection string was invalid.');

    expect(toUserFacingError(error, 'Could not load correction requests. Please try again.')).toBe(
      'Could not load correction requests. Please try again.'
    );
  });

  it('uses the operation-specific fallback for unknown values', () => {
    expect(toUserFacingError({ secret: 'internal' }, 'Switch activity failed. Please try again.')).toBe(
      'Switch activity failed. Please try again.'
    );
  });
});