import type {
  Job,
  SessionUser,
  TimeCorrectionRequest,
  TimeCorrectionRequestType,
  TimeEntry,
  TimeEntryWorkType,
  UnbillableCategory,
} from '@/types/domain';
import type { EmployeeForm, EmployeeFormContext } from '@/types/forms';

export interface ActivityConfig {
  type: TimeEntryWorkType;
  requiresJob: boolean;
  requiresCategory: boolean;
  categories?: Array<{ id: string; label: string }>;
}

export const WORK_AREA_CLOCKING_CONTRACT_VERSION = 2 as const;

export interface ApiEnvelope<T> {
  ok: boolean;
  error?: string;
  message?: string;
  code?: string;
  data?: T;
}

export interface AuthSessionResponse {
  ok: boolean;
  user?: SessionUser;
  error?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
}

export interface BootstrapResponse {
  ok: boolean;
  timezone?: string;
  jobs?: Job[];
  timeEntries?: TimeEntry[];
  timeCorrections?: TimeCorrectionRequest[];
  employees?: Array<{ id: string }>;
  currentActiveEntryId?: string | null;
  activeShiftWarnings?: {
    possibleForgottenClockOut: boolean;
    thresholdHours: number;
  };
  activityConfigs?: ActivityConfig[];
  capabilities?: {
    requiredBeforeClockInForms?: boolean;
    requiredAfterClockOutForms?: boolean;
    workAreaClockingVersion?: number;
    adjustClockInTime?: boolean;
    editShiftWorkAreas?: boolean;
    [key: string]: unknown;
  };
  pendingClockInWorkflow?: PendingClockInWorkflow | null;
  pendingClockOutWorkflow?: PendingClockOutWorkflow | null;
  error?: string;
}

export interface CreateTimeCorrectionRequest {
  requestId: string;
  idempotencyKey: string;
  timeEntryId?: string;
  employeeId?: string;
  requestType: TimeCorrectionRequestType;
  requestedClockInAt?: string;
  requestedClockOutAt?: string;
  requestedJobId?: string;
  requestedWorkAreaId?: string;
  clockingContractVersion?: number;
  requestedActivityType?: TimeEntryWorkType;
  requestedUnbillableCategoryId?: string;
  requestedUnbillableCategoryName?: string;
  reason: string;
}

export interface CreateTimeCorrectionResponse {
  ok: boolean;
  correction: TimeCorrectionRequest;
}

export interface ListTimeCorrectionsResponse {
  ok: boolean;
  items: TimeCorrectionRequest[];
}

export interface EffectiveTimeEntriesResponse {
  ok: boolean;
  items: TimeEntry[];
}

export interface ClockInRequest {
  employeeId: string;
  workType: TimeEntryWorkType;
  jobIds: string[];
  workAreaId?: string;
  clockingContractVersion?: number;
  unbillableCategoryId?: string;
  requestId: string;
  idempotencyKey: string;
  clientOccurredAt?: string;
}

export interface PendingClockInRequirement {
  requirementId: string;
  formId: string;
  completed?: boolean;
  form?: EmployeeForm;
  formPackage?: EmployeeForm;
  context?: EmployeeFormContext;
  name?: string;
  description?: string;
  category?: string;
  fields?: EmployeeForm['fields'];
  submissionState?: EmployeeForm['submissionState'];
}

export interface ClockInIntent {
  employeeId: string;
  workType: TimeEntryWorkType;
  jobIds: string[];
  workAreaId?: string | null;
  workAreaNameSnapshot?: string | null;
  clockingContractVersion?: number;
  unbillableCategoryId?: string;
}

export interface PendingClockInWorkflow {
  status: 'clock_in_pending_required_forms';
  blocked: true;
  workflowOccurrenceId: string;
  requiredFormCount: number;
  completedRequiredFormCount: number;
  remainingRequiredFormCount: number;
  requiredForms: PendingClockInRequirement[];
  remainingForms: PendingClockInRequirement[];
  reminderForms: EmployeeForm[];
  clockInIntent: ClockInIntent;
}

export type ClockInResponse =
  | { ok: boolean; status?: 'clock_in_completed'; timeEntry: TimeEntry; reminderForms?: EmployeeForm[] }
  | ({ ok: boolean } & PendingClockInWorkflow);

export type PendingClockInResponse =
  | { ok: boolean; blocked: false; status: 'no_pending_clock_in'; workflow: null }
  | ({ ok: boolean } & PendingClockInWorkflow);

export interface FinalizeClockInRequest {
  workflowOccurrenceId: string;
}

export type FinalizeClockInResponse =
  | { ok: boolean; status: 'clock_in_completed'; timeEntry: TimeEntry }
  | { ok: boolean; status: 'clock_in_already_finalized'; timeEntry?: TimeEntry }
  | { ok: boolean; status: 'required_forms_outstanding' | 'clock_in_workflow_not_found' | 'clock_in_workflow_forbidden' }
  | ({ ok: boolean } & PendingClockInWorkflow);

export interface ClockOutRequest {
  entryId: string;
  breakMinutes: number;
  notes: string;
  requestId: string;
  idempotencyKey: string;
  clientOccurredAt?: string;
  photoAttachmentFileIds?: string[];
  photoAttachmentFileId?: string;
}

export interface PendingClockOutRequirement {
  workflowRequirementId: string;
  id?: string;
  formId?: string;
  completed?: boolean;
  form?: EmployeeForm;
  formPackage?: EmployeeForm;
  context?: EmployeeFormContext;
  name?: string;
  description?: string;
  category?: string;
  trigger?: 'after_clock_out';
  required?: boolean;
  completionRequirement?: 'required';
  fields?: EmployeeForm['fields'];
  submissionState?: EmployeeForm['submissionState'];
}

export interface PendingClockOutWorkflow {
  status: 'clock_out_pending_required_forms';
  blocked: true;
  workflowOccurrenceId: string;
  intendedClockOutAt: string;
  requiredFormCount?: number;
  completedFormCount?: number;
  remainingFormCount?: number;
  requiredCount?: number;
  completedCount?: number;
  remainingCount?: number;
  requirements?: PendingClockOutRequirement[];
  requiredForms?: PendingClockOutRequirement[];
  formPackages?: EmployeeForm[];
  requiredFormPackages?: PendingClockOutRequirement[];
  reminderForms?: EmployeeForm[];
}

export type ClockOutResponse =
  | { ok: boolean; status?: 'clock_out_completed' | 'clock_out_already_finalized'; timeEntry?: TimeEntry; reminderForms?: EmployeeForm[] }
  | ({ ok: boolean } & PendingClockOutWorkflow);

export type PendingClockOutResponse =
  | { ok: boolean; status: 'no_pending_clock_out' }
  | ({ ok: boolean } & PendingClockOutWorkflow);

export interface FinalizeClockOutRequest {
  workflowOccurrenceId: string;
}

export interface SwitchActivityRequest {
  workType: TimeEntryWorkType;
  jobIds: string[];
  workAreaId?: string;
  clockingContractVersion?: number;
  unbillableCategoryId?: string;
  requestId: string;
  idempotencyKey: string;
  clientOccurredAt?: string;
}

export interface ActiveUnbillableCategoriesResponse {
  ok: boolean;
  items: UnbillableCategory[];
}

export interface PrepareUploadRequest {
  action: 'prepare-upload';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  entityType: 'time-entry' | 'form-attachment';
  entityId: string;
  category: 'clock-in-photo' | 'clock-out-photo' | 'photo';
  formId?: string;
  fieldId?: string;
  clientSubmissionId?: string;
  workflowOccurrenceId?: string;
  workflowRequirementId?: string;
  jobId?: string;
  equipmentId?: string;
  divisionId?: string;
}

export interface PrepareUploadResponse {
  ok: boolean;
  fileId?: string;
  uploadUrl?: string;
  requiredHeaders?: Record<string, string>;
  expiresAt?: string;
  error?: string;
}
