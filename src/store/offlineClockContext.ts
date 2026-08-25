import { createContext, useContext } from 'react';
import type { OfflineClockCache, OfflineClockCommand, OfflineClockInPayload, OfflineClockOutPayload, OfflineSwitchPayload } from '@/features/offlineClocking/types';
import type { buildEffectiveClockState } from '@/features/offlineClocking/model';
import type { ActivityConfig } from '@/types/api';
import type { Job, TimeEntry, UnbillableCategory } from '@/types/domain';

export type OfflineClockSubmitMeta = { requestId: string; idempotencyKey: string; clientOccurredAt: string };
export type OfflineClockRecordedResult = { ok: true; pendingSync: boolean } | { ok: false; error: string };

export type OfflineClockContextValue = {
  hydrated: boolean;
  commands: OfflineClockCommand[];
  cache: OfflineClockCache | null;
  effectiveState: ReturnType<typeof buildEffectiveClockState>;
  effectiveTimeEntries: TimeEntry[];
  effectiveCurrentActiveEntryId: string | null;
  submitClockIn: (payload: OfflineClockInPayload, meta: OfflineClockSubmitMeta) => Promise<OfflineClockRecordedResult>;
  submitSwitchActivity: (payload: OfflineSwitchPayload, meta: OfflineClockSubmitMeta) => Promise<OfflineClockRecordedResult>;
  submitClockOut: (payload: OfflineClockOutPayload, meta: OfflineClockSubmitMeta) => Promise<OfflineClockRecordedResult>;
  updateEligibilityCache: (update: {
    jobs?: Job[];
    unbillableCategories?: UnbillableCategory[];
    activityConfigs?: ActivityConfig[];
    requiredAfterClockOutForms?: boolean;
  }) => Promise<void>;
  resolveCommandWithCorrection: (commandId: string, correctionRequestId: string) => Promise<void>;
  syncNow: () => Promise<void>;
};

export const OfflineClockContext = createContext<OfflineClockContextValue | undefined>(undefined);

export function useOptionalOfflineClockStore() {
  return useContext(OfflineClockContext);
}

export function getOfflineConflictMessage(code?: string) {
  if (code === 'offline_queue_schema_unsupported') return 'This saved time change was created by an unsupported app version. Submit a time correction.';
  if (code === 'offline_job_unauthorized') return 'This time change could not sync because the job is no longer available to you.';
  if (code === 'offline_event_too_old') return 'This offline time change is over 24 hours old. Submit a time correction.';
  if (code === 'offline_event_in_future') return 'This time change appears to be in the future. Check your device time or submit a correction.';
  return 'This offline time change conflicts with your current time record. Submit a time correction.';
}