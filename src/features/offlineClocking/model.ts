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
  const pending = unresolved.filter((command) => command.status !== 'needs_attention');
  const needsAttention = unresolved.filter((command) => command.status === 'needs_attention');
  let activeEntry = serverActiveEntry;
  let localShiftId = serverActiveEntry ? `server:${serverActiveEntry.id}` : null;
  let lastClockOutAt: string | undefined;

  for (const command of pending) {
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

  const currentShiftConflict = needsAttention.find((command) => command.localShiftId === localShiftId) ?? null;
  const currentShiftPendingCount = localShiftId
    ? pending.filter((command) => command.localShiftId === localShiftId).length
    : 0;

  return {
    activeEntry,
    localShiftId,
    pendingCount: pending.length,
    needsAttentionCount: needsAttention.length,
    currentShiftPendingCount,
    currentShiftConflict,
    syncStatus: currentShiftConflict ? 'needs_attention' : currentShiftPendingCount > 0 ? 'pending' : 'synced',
    lastClockOutAt,
  };
}

export function blocksFollowingCommands(command: OfflineClockCommand) {
  return command.status === 'needs_attention';
}

export function nextReplayableCommand(commands: OfflineClockCommand[]) {
  const blockedShiftIds = new Set<string>();
  const ordered = commands
    .filter((command) => command.status !== 'synced')
    .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt) || left.id.localeCompare(right.id));

  for (const command of ordered) {
    if (blocksFollowingCommands(command)) {
      blockedShiftIds.add(command.localShiftId);
      continue;
    }
    if (!blockedShiftIds.has(command.localShiftId)) return command;
  }

  return null;
}
