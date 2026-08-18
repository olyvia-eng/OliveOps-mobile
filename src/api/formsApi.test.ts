import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  loadEmployeeForms,
  loadEmployeeSubmission,
  loadRequiredForms,
  submitEmployeeForm,
} from '@/api/formsApi';
import { registerSessionExpiryHandler } from '@/services/sessionExpiry';

jest.mock('@/config/env', () => ({
  ENV: { apiBaseUrl: 'https://app.oliveops.ca' },
}));

function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as any;
}

describe('formsApi', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads the employee Forms workspace with authorized context filters', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValue(mockResponse(200, {
      ok: true,
      timezone: 'America/Toronto',
      generatedAt: '2026-08-18T12:00:00.000Z',
      toDo: [],
      available: [],
      completed: [],
    }));

    await loadEmployeeForms('token-1', { jobId: 'job 1', equipmentId: 'eq-1' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.oliveops.ca/api/employee?action=forms&jobId=job+1&equipmentId=eq-1',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('loads required Forms for a documented trigger', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValue(mockResponse(200, {
      ok: true,
      trigger: 'before_starting_job',
      timezone: 'America/Toronto',
      forms: [],
    }));

    await loadRequiredForms('before_starting_job', 'token-1', { jobId: 'job-1' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.oliveops.ca/api/employee?action=required&trigger=before_starting_job&jobId=job-1',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('loads an employee-owned completed submission', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValue(mockResponse(200, {
      ok: true,
      submission: { submissionId: 'sub-1' },
      form: { id: 'form-1', name: 'Daily Report' },
      answers: [],
    }));

    await loadEmployeeSubmission('sub/1', 'token-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.oliveops.ca/api/employee?action=submission&id=sub%2F1',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('submits only the documented employee Form payload', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValue(mockResponse(201, {
      ok: true,
      submission: { id: 'sub-1' },
    }));

    await submitEmployeeForm({
      clientSubmissionId: 'form-attempt-1',
      formId: 'form-1',
      trigger: 'daily',
      jobId: 'job-1',
      responses: [{ fieldId: 'field-1', value: 'Completed west trench' }],
    }, 'token-1');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(fetchMock.mock.calls[0][0]).toBe('https://app.oliveops.ca/api/employee?action=submit');
    expect(body).toEqual({
      clientSubmissionId: 'form-attempt-1',
      formId: 'form-1',
      trigger: 'daily',
      jobId: 'job-1',
      responses: [{ fieldId: 'field-1', value: 'Completed west trench' }],
    });
    expect(body).not.toHaveProperty('businessId');
    expect(body).not.toHaveProperty('employeeId');
    expect(body).not.toHaveProperty('status');
  });

  it('preserves centralized session invalidation on 401', async () => {
    const expired = jest.fn();
    const unregister = registerSessionExpiryHandler(expired);
    jest.spyOn(global, 'fetch' as any).mockResolvedValue(mockResponse(401, {
      ok: false,
      error: 'Unauthorized',
    }));

    await expect(loadEmployeeForms('expired-token')).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledTimes(1);
    unregister();
  });

  it('surfaces forbidden access without exposing response objects', async () => {
    jest.spyOn(global, 'fetch' as any).mockResolvedValue(mockResponse(403, {
      ok: false,
      error: 'Form is not assigned to this employee.',
    }));

    await expect(loadEmployeeSubmission('sub-1', 'token-1')).rejects.toMatchObject({
      status: 403,
      message: 'Form is not assigned to this employee.',
    });
  });

  it('preserves network failures for the feature error mapper', async () => {
    jest.spyOn(global, 'fetch' as any).mockRejectedValue(new TypeError('Network request failed'));

    await expect(loadEmployeeForms('token-1')).rejects.toBeInstanceOf(TypeError);
  });

  it('preserves server field validation metadata', async () => {
    jest.spyOn(global, 'fetch' as any).mockResolvedValue(mockResponse(400, {
      ok: false,
      error: 'Work completed: This field is required.',
      fieldId: 'field-1',
    }));

    await expect(submitEmployeeForm({
      clientSubmissionId: 'form-attempt-2',
      formId: 'form-1',
      trigger: 'daily',
      responses: [],
    }, 'token-1')).rejects.toMatchObject({
      status: 400,
      fieldId: 'field-1',
    });
  });

  it('surfaces already-completed conflicts for reconciliation', async () => {
    jest.spyOn(global, 'fetch' as any).mockResolvedValue(mockResponse(409, {
      ok: false,
      error: 'This form has already been submitted. Refresh and try again.',
    }));

    await expect(submitEmployeeForm({
      clientSubmissionId: 'form-attempt-3',
      formId: 'form-1',
      trigger: 'daily',
      responses: [],
    }, 'token-1')).rejects.toMatchObject({ status: 409 });
  });
});