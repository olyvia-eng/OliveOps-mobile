import type {
  Job,
  SessionUser,
  TimeCorrectionRequest,
  TimeCorrectionRequestType,
  TimeEntry,
  TimeEntryWorkType,
} from '@/types/domain';

export interface MobileCapabilities {
  paidDriveTime: boolean;
}

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
  capabilities?: MobileCapabilities;
}

export interface BootstrapResponse {
  ok: boolean;
  jobs?: Job[];
  timeEntries?: TimeEntry[];
  timeCorrections?: TimeCorrectionRequest[];
  employees?: Array<{ id: string }>;
  currentActiveEntryId?: string | null;
  activeShiftWarnings?: {
    possibleForgottenClockOut: boolean;
    thresholdHours: number;
  };
  capabilities?: MobileCapabilities;
  activityConfigs?: ActivityConfig[];
  error?: string;
}

export interface CreateTimeCorrectionRequest {
  timeEntryId?: string;
  employeeId?: string;
  requestType: TimeCorrectionRequestType;
  requestedClockInAt?: string;
  requestedClockOutAt?: string;
  requestedJobId?: string;
  requestedActivityType?: TimeEntryWorkType;
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
  requestId: string;
  idempotencyKey: string;
}

export interface ClockOutRequest {
  entryId: string;
  breakMinutes: number;
  notes: string;
  requestId: string;
  idempotencyKey: string;
  photoAttachmentFileIds?: string[];
  photoAttachmentFileId?: string;
}

export interface SwitchActivityRequest {
  workType: TimeEntryWorkType;
  jobIds: string[];
  requestId: string;
  idempotencyKey: string;
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
