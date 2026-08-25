import type { ClockInRequest, ClockOutRequest, SwitchActivityRequest } from '@/types/api';
import type { Job, TimeEntry, UnbillableCategory } from '@/types/domain';

export const OFFLINE_CLOCK_SCHEMA_VERSION = 1 as const;

export type OfflineClockStatus = 'pending' | 'syncing' | 'needs_attention' | 'synced';
export type EffectiveClockStatus =
  | 'clocked_out_synced'
  | 'clocked_out_pending'
  | 'clocked_in_synced'
  | 'clocked_in_pending'
  | 'needs_attention';

export type OfflineClockInPayload = Omit<ClockInRequest, 'requestId' | 'idempotencyKey' | 'clientOccurredAt'>;
export type OfflineSwitchPayload = Omit<SwitchActivityRequest, 'requestId' | 'idempotencyKey' | 'clientOccurredAt'>;
export type OfflineClockOutPayload = Omit<
  ClockOutRequest,
  'requestId' | 'idempotencyKey' | 'clientOccurredAt' | 'entryId' | 'photoAttachmentFileId' | 'photoAttachmentFileIds'
> & {
  entryId?: string;
};

export type OfflineClockCommand = {
  schemaVersion: typeof OFFLINE_CLOCK_SCHEMA_VERSION;
  id: string;
  identityKey: string;
  employeeId: string;
  businessId: string;
  localShiftId: string;
  type: 'clock_in' | 'switch_activity' | 'clock_out';
  logicalPayload: OfflineClockInPayload | OfflineSwitchPayload | OfflineClockOutPayload;
  requestId: string;
  idempotencyKey: string;
  clientOccurredAt: string;
  queuedAt: string;
  syncedAt?: string;
  status: OfflineClockStatus;
  retryCount: number;
  lastErrorCode?: string;
  lastErrorCategory?: string;
  resolvedServerEntryId?: string;
  correctionRequestId?: string;
  correctionRequestedAt?: string;
};

export type OfflineShiftMapping = {
  identityKey: string;
  localShiftId: string;
  serverEntryId: string;
};

export type OfflineClockCache = {
  schemaVersion: typeof OFFLINE_CLOCK_SCHEMA_VERSION;
  identityKey: string;
  updatedAt: string;
  jobs: Array<Pick<Job, 'id' | 'title' | 'status'>>;
  unbillableCategories: Array<Pick<UnbillableCategory, 'id' | 'name' | 'active'>>;
  driveTimeAvailable: boolean;
  jobWorkAvailable: boolean;
  unbillableAvailable: boolean;
  requiredBeforeClockInForms?: boolean;
  requiredAfterClockOutForms?: boolean;
};

export type EffectiveClockState = {
  activeEntry: TimeEntry | null;
  effectiveActiveEntryId: string | null;
  effectiveStatus: EffectiveClockStatus;
  shiftStartedAt?: string;
  currentSegmentStartedAt?: string;
  currentActivity: Pick<
    TimeEntry,
    'workType' | 'jobId' | 'jobIds' | 'unbillableCategoryId' | 'unbillableCategoryName'
  > | null;
  localShiftId: string | null;
  pendingCount: number;
  needsAttentionCount: number;
  blockedCount: number;
  correctionRequestedCount: number;
  currentShiftPendingCount: number;
  currentShiftBlockedCount: number;
  currentShiftConflict: OfflineClockCommand | null;
  syncStatus: 'synced' | 'pending' | 'needs_attention';
  lastClockOutAt?: string;
};
