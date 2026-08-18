import { apiRequest } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type {
  EmployeeFormsContextFilter,
  EmployeeFormsResponse,
  EmployeeFormSubmissionDetailResponse,
  EmployeeRequiredFormsResponse,
  EmployeeRequiredFormTrigger,
  SubmitEmployeeFormRequest,
  SubmitEmployeeFormResponse,
} from '@/types/forms';

function withQuery(endpoint: string, values: Record<string, string | undefined>) {
  const params = new URLSearchParams(endpoint.split('?')[1] ?? '');
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  return `${endpoint.split('?')[0]}?${params.toString()}`;
}

function contextQuery(filters: EmployeeFormsContextFilter = {}) {
  return {
    jobId: filters.jobId,
    equipmentId: filters.equipmentId,
    divisionId: filters.divisionId,
  };
}

export function loadEmployeeForms(
  accessToken?: string,
  filters: EmployeeFormsContextFilter = {},
): Promise<EmployeeFormsResponse> {
  return apiRequest<EmployeeFormsResponse>(withQuery(ENDPOINTS.employeeForms, contextQuery(filters)), {
    method: 'GET',
    accessToken,
  });
}

export function loadRequiredForms(
  trigger: EmployeeRequiredFormTrigger,
  accessToken?: string,
  filters: EmployeeFormsContextFilter = {},
): Promise<EmployeeRequiredFormsResponse> {
  return apiRequest<EmployeeRequiredFormsResponse>(withQuery(ENDPOINTS.employeeRequiredForms, {
    trigger,
    ...contextQuery(filters),
  }), {
    method: 'GET',
    accessToken,
  });
}

export function loadEmployeeSubmission(
  submissionId: string,
  accessToken?: string,
): Promise<EmployeeFormSubmissionDetailResponse> {
  return apiRequest<EmployeeFormSubmissionDetailResponse>(withQuery(ENDPOINTS.employeeFormSubmission, {
    id: submissionId,
  }), {
    method: 'GET',
    accessToken,
  });
}

export function submitEmployeeForm(
  payload: SubmitEmployeeFormRequest,
  accessToken?: string,
): Promise<SubmitEmployeeFormResponse> {
  return apiRequest<SubmitEmployeeFormResponse>(ENDPOINTS.employeeFormSubmit, {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
  });
}