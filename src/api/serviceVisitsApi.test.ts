import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { addServiceVisitNote, completeServiceVisit, loadServiceVisitDetail } from '@/api/serviceVisitsApi';
import { ApiError } from '@/types/errors';

jest.mock('@/config/env', () => ({ ENV: { apiBaseUrl: 'http://localhost:3000' } }));

function mockResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: jest.fn().mockResolvedValue(body) } as any;
}

describe('serviceVisitsApi contract', () => {
  beforeEach(() => jest.restoreAllMocks());

  it('loads employee-safe Visit detail and completion requirements', async () => {
    const detail = {
      ok: true,
      visit: { id: 'visit-1', jobId: 'job-1', serviceId: 'service-1', status: 'scheduled' },
      job: { id: 'job-1', title: 'Property service' },
      service: { id: 'service-1', name: 'Weekly mowing', description: 'Mow and trim.', billingType: 'per_visit' },
      crew: { id: 'crew-1', name: 'North Crew' },
      timeEntries: [], forms: [], formSubmissions: [], photos: [],
      sops: [{ sopId: 'sop-1', version: 3, title: 'Mower operation', category: 'Equipment', shortDescription: 'Daily procedure.', contentMode: 'structured' }],
      completion: { requiredFormIds: ['form-1'], minimumPhotoCount: 1, noteRequired: true, completedFormIds: [], missingFormIds: ['form-1'], photoCount: 0, noteCount: 0, activeTimeEntryCount: 0 },
    };
    (global as any).fetch = jest.fn().mockResolvedValue(mockResponse(200, detail));

    const response = await loadServiceVisitDetail('job-1', 'visit-1', 'token-1');

    expect(response.service.description).toBe('Mow and trim.');
    expect(response.crew?.name).toBe('North Crew');
    expect(response.sops[0]).toMatchObject({ sopId: 'sop-1', version: 3 });
    expect(response.completion.missingFormIds).toEqual(['form-1']);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/service-visits?action=detail&jobId=job-1&visitId=visit-1'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('adds a Visit note with an immutable client submission ID', async () => {
    const payload = { serviceId: 'service-1', visitId: 'visit-1', clientSubmissionId: 'note-device-1', text: 'Back gate locked.' };
    (global as any).fetch = jest.fn().mockResolvedValue(mockResponse(201, {
      ok: true,
      note: { id: 'note-1', ...payload, authorUserId: 'user-1', authorName: 'Alex', createdAt: '2026-09-07T12:00:00.000Z' },
      visit: { id: 'visit-1' },
    }));

    const response = await addServiceVisitNote('job-1', payload, 'token-1');

    expect(response.note.text).toBe('Back gate locked.');
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string)).toEqual(payload);
  });

  it('completes a Visit and accepts an idempotent replay response', async () => {
    const payload = { serviceId: 'service-1', visitId: 'visit-1', clientSubmissionId: 'complete-device-1' };
    (global as any).fetch = jest.fn().mockResolvedValue(mockResponse(200, {
      ok: true, replayed: true, visit: { id: 'visit-1', status: 'completed' },
    }));

    const response = await completeServiceVisit('job-1', payload, 'token-1');

    expect(response.replayed).toBe(true);
    expect(response.visit.status).toBe('completed');
  });

  it.each([
    'VISIT_HAS_ACTIVE_TIME_ENTRIES',
    'VISIT_REQUIRED_FORMS_OUTSTANDING',
    'VISIT_REQUIRED_PHOTOS_OUTSTANDING',
    'VISIT_REQUIRED_NOTE_OUTSTANDING',
    'VISIT_STATUS_INVALID',
    'VISIT_NOT_ASSIGNED',
    'VISIT_REVISION_CONFLICT',
    'VISIT_NOT_FOUND',
    'INVALID_CLIENT_SUBMISSION_ID',
  ])('preserves machine-readable completion error %s', async (code) => {
    (global as any).fetch = jest.fn().mockResolvedValue(mockResponse(409, { ok: false, code, error: 'Safe error.' }));

    await expect(completeServiceVisit('job-1', {
      serviceId: 'service-1', visitId: 'visit-1', clientSubmissionId: 'complete-device-1',
    })).rejects.toMatchObject<ApiError>({ code, status: 409 });
  });
});