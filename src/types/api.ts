import type { Job, SessionUser, TimeEntry, TimeEntryWorkType } from '@/types/domain';

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
  jobs?: Job[];
  timeEntries?: TimeEntry[];
  employees?: Array<{ id: string }>;
  error?: string;
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
  photoAttachmentFileId?: string;
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
