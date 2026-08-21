import type { TimeEntry } from '@/types/domain';
import type { EffectiveClockState, OfflineClockCommand, OfflineClockOutPayload, OfflineClockInPayload, OfflineSwitchPayload } from './types';

function localEntryId(localShiftId: string, commandId: string) {
  return `local-clock:${localShiftId}:${commandId}`;
}

function applyActivity(
  current: TimeEntry,
  command: OfflineClockCommand,
  payload: OfflineSwitchPayload,
): TimeEntry {
  return {
    ...current,
    id: localEntryId(command.localShiftId, command.id),
    workType: payload.workType,
    jobId: payload.jobIds[0],
    jobIds: payload.jobIds,
    unbillableCategoryId: payload.unbillableCategoryId,
    unbillableCategoryName: undefined,
    clockIn: command.clientOccurredAt,
    clockOut: undefined,
    status: 'clocked_in',
  };
}

export function buildEffectiveClockState(
  serverActiveEntry: TimeEntry | null,
  commands: OfflineClockCommand[],
): EffectiveClockState {
  const unresolved = commands
    .filter((command) => command.status !== 'synced')
    .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt) || left.id.localeCompare(right.id));
  const needsAttentionCount = unresolved.filter((command) => command.status === 'needs_attention').length;
  let activeEntry = serverActiveEntry;
  let localShiftId = serverActiveEntry
    ? unresolved[0]?.localShiftId ?? `server:${serverActiveEntry.id}`
    : null;
  let lastClockOutAt: string | undefined;

  for (const command of unresolved) {
    if (command.status === 'needs_attention') break;
    if (command.type === 'clock_in') {
      const payload = command.logicalPayload as OfflineClockInPayload;
      activeEntry = {
        id: localEntryId(command.localShiftId, command.id),
        employeeId: command.employeeId,
        workType: payload.workType,
        jobId: payload.jobIds[0],
        jobIds: payload.jobIds,
        unbillableCategoryId: payload.unbillableCategoryId,
        clockIn: command.clientOccurredAt,
        breakMinutes: 0,
        notes: '',
        status: 'clocked_in',
      };
      localShiftId = command.localShiftId;
      lastClockOutAt = undefined;
      continue;
    }

    if (command.localShiftId !== localShiftId || !activeEntry) continue;

    if (command.type === 'switch_activity') {
      activeEntry = applyActivity(activeEntry, command, command.logicalPayload as OfflineSwitchPayload);
      continue;
    }

    const payload = command.logicalPayload as OfflineClockOutPayload;
    activeEntry = null;
    localShiftId = command.localShiftId;
    lastClockOutAt = command.clientOccurredAt;
    void payload;
  }

  return {
    activeEntry,
    localShiftId,
    pendingCount: unresolved.length,
    needsAttentionCount,
    syncStatus: needsAttentionCount > 0 ? 'needs_attention' : unresolved.length > 0 ? 'pending' : 'synced',
    lastClockOutAt,
  };
}

export function blocksFollowingCommands(command: OfflineClockCommand) {
  return command.status === 'needs_attention';
}
