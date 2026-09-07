import type { TimeEntry } from '@/types/domain';
import type { EmployeeFormSubmission, EmployeeFormSubmissionStatus } from '@/types/forms';
import type { ContentMode } from '@/types/document';

export type ServiceVisitStatus = 'scheduled' | 'in_progress' | 'completed' | 'skipped' | 'cancelled';
export type ServiceVisitBillingStatus = 'included' | 'pending' | 'ready' | 'invoiced' | 'not_billable' | 'pending_usage';
export type ServiceVisitSource = 'recurrence' | 'manual' | 'one_time';

export interface ServiceVisitClockContext {
  jobId: string;
  serviceId: string;
  serviceVisitId: string;
  serviceName?: string;
  propertyName?: string;
}

export type ServiceVisitErrorCode =
  | 'EXPLICIT_VISIT_COMPLETION_REQUIRED'
  | 'INVALID_CLIENT_SUBMISSION_ID'
  | 'JOB_NOT_FOUND'
  | 'NOTE_REQUIRED'
  | 'SERVICE_CONTEXT_INVALID'
  | 'SERVICE_JOB_MISMATCH'
  | 'VISIT_ALREADY_COMPLETED'
  | 'VISIT_CANCELLED'
  | 'VISIT_HAS_ACTIVE_TIME_ENTRIES'
  | 'VISIT_NOT_ASSIGNED'
  | 'VISIT_NOT_FOUND'
  | 'VISIT_REQUIRED_FORMS_OUTSTANDING'
  | 'VISIT_REQUIRED_NOTE_OUTSTANDING'
  | 'VISIT_REQUIRED_PHOTOS_OUTSTANDING'
  | 'VISIT_REVISION_CONFLICT'
  | 'VISIT_SKIPPED'
  | 'VISIT_STATUS_INVALID';

export interface ServiceVisitCrewSummary {
  id: string;
  name: string;
}

export interface ServiceVisitSummary {
  id: string;
  jobId: string;
  serviceId: string;
  jobName: string;
  serviceName: string;
  customerName: string;
  propertyName: string;
  propertyAddress: string;
  scheduledDate: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  scheduleAllDay: boolean;
  crewId?: string;
  crew?: ServiceVisitCrewSummary;
  status: ServiceVisitStatus;
  billingType: string;
  hasRequiredForms: boolean;
  hasSops: boolean;
}

export interface ServiceVisitNote {
  id: string;
  clientSubmissionId: string;
  text: string;
  authorUserId: string;
  authorName?: string;
  createdAt: string;
}

export interface ServiceVisit {
  id: string;
  jobId: string;
  serviceId: string;
  scheduledDate: string;
  originalRecurrenceDate?: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  scheduleAllDay: boolean;
  crewId?: string;
  assignedEmployeeIds: string[];
  assignedEquipmentIds: string[];
  status: ServiceVisitStatus;
  billingTypeSnapshot: string;
  billingStatus: ServiceVisitBillingStatus;
  source: ServiceVisitSource;
  notes: string;
  statusReason?: string;
  completedAt?: string;
  completedByUserId?: string;
  completionClientSubmissionId?: string;
  visitNotes?: ServiceVisitNote[];
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceVisitCompletion {
  requiredFormIds: string[];
  minimumPhotoCount: number;
  noteRequired: boolean;
  completedFormIds: string[];
  missingFormIds: string[];
  photoCount: number;
  noteCount: number;
  activeTimeEntryCount: number;
}

export interface ServiceVisitPhoto {
  id: string;
  fileName: string;
  mimeType: string;
  uploadedAt: string;
}

export interface ServiceVisitFormSummary {
  id: string;
  name: string;
  completionRequirement?: 'reminder' | 'required';
}

export interface ServiceVisitSopSummary {
  sopId: string;
  version: number;
  title: string;
  category: string;
  shortDescription: string;
  contentMode?: ContentMode;
}

export interface ServiceVisitDetailResponse {
  ok: true;
  visit: ServiceVisit;
  job: { id: string; title: string; customerId?: string; propertyId?: string };
  service: { id: string; name: string; description?: string; billingType: string };
  crew?: ServiceVisitCrewSummary;
  timeEntries: Array<Pick<TimeEntry, 'id' | 'employeeId' | 'status' | 'clockIn' | 'clockOut' | 'breakMinutes'> & { employeeName?: string }>;
  forms: ServiceVisitFormSummary[];
  formSubmissions: Array<EmployeeFormSubmission & { status: EmployeeFormSubmissionStatus }>;
  photos: ServiceVisitPhoto[];
  sops: ServiceVisitSopSummary[];
  completion: ServiceVisitCompletion;
}

export interface AddServiceVisitNoteRequest {
  serviceId: string;
  visitId: string;
  clientSubmissionId: string;
  text: string;
}

export interface CompleteServiceVisitRequest {
  serviceId: string;
  visitId: string;
  clientSubmissionId: string;
}

export interface ServiceVisitMutationResponse {
  ok: true;
  visit: ServiceVisit;
  replayed?: boolean;
}

export interface AddServiceVisitNoteResponse extends ServiceVisitMutationResponse {
  note: ServiceVisitNote;
}