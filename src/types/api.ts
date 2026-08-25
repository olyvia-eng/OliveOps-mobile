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
    requiredAfterClockOutForms?: boolean;
    [key: string]: unknown;
  };
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
  unbillableCategoryId?: string;
  requestId: string;
  idempotencyKey: string;
  clientOccurredAt?: string;
}

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
  entityType: 'time-entry';
  entityId: string;
  category: 'clock-in-photo' | 'clock-out-photo';
}

export interface PrepareUploadResponse {
  ok: boolean;
  fileId?: string;
  uploadUrl?: string;
  requiredHeaders?: Record<string, string>;
  expiresAt?: string;
  error?: string;
}
