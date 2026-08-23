import type { OfflineClockCommand, OfflineClockInPayload, OfflineSwitchPayload } from './types';
import type { TimeEntryWorkType } from '@/types/domain';

export function getOfflineCommandActionLabel(type: OfflineClockCommand['type']) {
  if (type === 'clock_in') return 'Clock In';
  if (type === 'switch_activity') return 'Switch Activity';
  return 'Clock Out';
}

export function getOfflineCommandReason(code?: string) {
  if (code === 'offline_job_unauthorized') return 'You no longer have access to this job.';
  if (code === 'offline_event_order_conflict') return 'This time change conflicts with another recorded time entry.';
  if (code === 'offline_shift_state_conflict') return 'Your saved shift changed before this offline action could sync.';
  if (code === 'offline_event_too_old') return 'This offline change is too old to sync automatically.';
  if (code === 'offline_event_in_future') return 'This offline change appears to be in the future.';
  if (code === 'offline_event_invalid_timestamp') return 'The saved time could not be validated.';
  if (code === 'clock_idempotency_conflict') return 'This saved change no longer matches the original request.';
  if (code === 'offline_shift_dependency') return 'The saved shift dependency could not be resolved on this device.';
  if (code === 'offline_queue_schema_unsupported') return 'This saved change was created by an unsupported app version.';
  return 'This saved time change could not be synced automatically.';
}

export function resolveOfflineCommandActivity(
  target: OfflineClockCommand,
  commands: OfflineClockCommand[],
  fallback?: { workType: TimeEntryWorkType; jobIds?: string[]; unbillableCategoryId?: string } | null,
) {
  let activity = fallback ?? null;
  const ordered = commands
    .filter((command) => command.localShiftId === target.localShiftId)
    .filter((command) => command.clientOccurredAt <= target.clientOccurredAt)
    .sort((left, right) => left.clientOccurredAt.localeCompare(right.clientOccurredAt));

  for (const command of ordered) {
    if (command.type === 'clock_in') {
      const payload = command.logicalPayload as OfflineClockInPayload;
      activity = {
        workType: payload.workType,
        jobIds: payload.jobIds,
        unbillableCategoryId: payload.unbillableCategoryId,
      };
    } else if (command.type === 'switch_activity') {
      const payload = command.logicalPayload as OfflineSwitchPayload;
      activity = {
        workType: payload.workType,
        jobIds: payload.jobIds,
        unbillableCategoryId: payload.unbillableCategoryId,
      };
    }
  }

  return activity;
}