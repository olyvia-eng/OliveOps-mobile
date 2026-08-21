import type { ClockInRequest, ClockOutRequest, SwitchActivityRequest } from '@/types/api';
import type { Job, TimeEntry, UnbillableCategory } from '@/types/domain';

export const OFFLINE_CLOCK_SCHEMA_VERSION = 1 as const;

export type OfflineClockStatus = 'pending' | 'syncing' | 'needs_attention' | 'synced';

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
  lastErrorCategory?: string;
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
};

export type EffectiveClockState = {
  activeEntry: TimeEntry | null;
  localShiftId: string | null;
  pendingCount: number;
  needsAttentionCount: number;
  syncStatus: 'synced' | 'pending' | 'needs_attention';
  lastClockOutAt?: string;
};
