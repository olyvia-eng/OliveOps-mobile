export type EmployeeFormTrigger =
  | 'before_clock_in'
  | 'after_clock_out'
  | 'before_starting_job'
  | 'after_completing_job'
  | 'after_leaving_job'
  | 'job_completed'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'on_demand';

export type EmployeeRequiredFormTrigger = Exclude<EmployeeFormTrigger, 'on_demand'>;

export type EmployeeFormFieldType =
  | 'section_header'
  | 'paragraph_text'
  | 'single_line_text'
  | 'multi_line_text'
  | 'number'
  | 'currency'
  | 'date'
  | 'time'
  | 'yes_no'
  | 'checkbox'
  | 'multiple_choice'
  | 'dropdown'
  | 'signature'
  | 'employee_selector'
  | 'job_selector'
  | 'customer_selector'
  | 'photo_upload'
  | 'file_upload';

export type EmployeeFormSubmissionStatus = 'draft' | 'submitted' | 'pending_review' | 'approved' | 'rejected';
export type EmployeeFormCompletionRequirement = 'reminder' | 'required';

export interface EmployeeFormAcceptedResponse {
  value: string;
  message?: string;
}

export interface EmployeeFormChoice {
  value: string;
  label: string;
}

export interface EmployeeFormField {
  id: string;
  type: EmployeeFormFieldType;
  label: string;
  helpText?: string;
  required: boolean;
  defaultValue?: string;
  placeholder?: string;
  options?: string[];
  order: number;
  choices?: EmployeeFormChoice[];
  acceptedResponse?: EmployeeFormAcceptedResponse | null;
}

export interface EmployeeFormContext {
  jobId?: string;
  jobName?: string;
  equipmentId?: string;
  equipmentName?: string;
  divisionId?: string;
  divisionName?: string;
}

export interface EmployeeFormSubmissionState {
  completed: boolean;
  submissionId?: string;
  submittedAt?: string;
  status?: EmployeeFormSubmissionStatus;
}

export interface EmployeeForm {
  id: string;
  name: string;
  description?: string;
  category?: string;
  trigger: EmployeeFormTrigger;
  required: boolean;
  completionRequirement?: EmployeeFormCompletionRequirement;
  requiresApproval?: boolean;
  periodKey?: string;
  context?: EmployeeFormContext;
  fields: EmployeeFormField[];
  submissionState: EmployeeFormSubmissionState;
}

export interface EmployeeFormSubmission {
  submissionId: string;
  clientSubmissionId?: string;
  formId: string;
  formName: string;
  submittedAt: string;
  status: EmployeeFormSubmissionStatus;
  trigger: EmployeeFormTrigger;
  context?: EmployeeFormContext;
}

export interface EmployeeFormsResponse {
  ok: true;
  timezone: string;
  generatedAt: string;
  toDo: EmployeeForm[];
  available: EmployeeForm[];
  completed: EmployeeFormSubmission[];
}

export interface EmployeeRequiredFormsResponse {
  ok: true;
  trigger: EmployeeRequiredFormTrigger;
  timezone: string;
  forms: EmployeeForm[];
}

export interface EmployeeFormResponse {
  fieldId: string;
  value: string;
}

export interface SubmitEmployeeFormRequest {
  clientSubmissionId: string;
  formId: string;
  trigger: EmployeeFormTrigger;
  jobId?: string;
  equipmentId?: string;
  divisionId?: string;
  workflowOccurrenceId?: string;
  workflowRequirementId?: string;
  responses: EmployeeFormResponse[];
}

export interface QueuedFormSubmissionFailure {
  workflowRequirementId: string;
  code: 'form_response_requirement_failed';
  error: string;
  fieldId?: string;
}

export interface SubmittedEmployeeForm {
  id: string;
  clientSubmissionId?: string;
  formId: string;
  employeeId: string;
  trigger: EmployeeFormTrigger;
  periodKey?: string;
  submittedAt: string;
  status: Extract<EmployeeFormSubmissionStatus, 'submitted' | 'pending_review' | 'approved'>;
  submittedBy: string;
  submittedByUserId: string;
  responsesCreated: number;
}

export interface SubmitEmployeeFormResponse {
  ok: true;
  submission: SubmittedEmployeeForm;
}

export interface EmployeeFormAnswer {
  fieldId: string;
  label: string;
  type?: EmployeeFormFieldType;
  value?: string;
  fileIds?: string[];
}

export interface EmployeeFormSubmissionDetailResponse {
  ok: true;
  submission: EmployeeFormSubmission;
  form: {
    id: string;
    name: string;
    description?: string;
    category?: string;
  };
  answers: EmployeeFormAnswer[];
}

export interface EmployeeFormsContextFilter {
  jobId?: string;
  equipmentId?: string;
  divisionId?: string;
}