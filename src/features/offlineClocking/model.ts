import type { TimeEntry } from '@/types/domain';
import type { EffectiveClockState, OfflineClockCommand, OfflineClockOutPayload, OfflineClockInPayload, OfflineSwitchPayload } from './types';

function localEntryId(localShiftId: string, commandId: string) {
  return `local-clock:${localShiftId}:${commandId}`;
}

function compareCommands(left: OfflineClockCommand, right: OfflineClockCommand) {
  return left.clientOccurredAt.localeCompare(right.clientOccurredAt)
    || left.queuedAt.localeCompare(right.queuedAt)
    || left.id.localeCompare(right.id);
}

export type OfflineCommandDependencies = {
  ordered: OfflineClockCommand[];
  replayable: OfflineClockCommand[];
  actionable: OfflineClockCommand[];
  blocked: OfflineClockCommand[];
  correctionRequested: OfflineClockCommand[];
};

export function analyzeCommandDependencies(commands: OfflineClockCommand[]): OfflineCommandDependencies {
  const ordered = commands
    .filter((command) => command.status !== 'synced')
    .sort(compareCommands);
  const blockedShiftIds = new Set<string>();
  const replayable: OfflineClockCommand[] = [];
  const actionable: OfflineClockCommand[] = [];
  const blocked: OfflineClockCommand[] = [];
  const correctionRequested: OfflineClockCommand[] = [];

  for (const command of ordered) {
    if (blockedShiftIds.has(command.localShiftId)) {
      blocked.push(command);
      continue;
    }
    if (command.status === 'needs_attention') {
      blockedShiftIds.add(command.localShiftId);
      if (command.correctionRequestId) correctionRequested.push(command);
      else actionable.push(command);
      continue;
    }
    replayable.push(command);
  }

  return { ordered, replayable, actionable, blocked, correctionRequested };
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
    workAreaId: payload.workAreaId,
    workAreaNameSnapshot: payload.workAreaNameSnapshot,
    unbillableCategoryId: payload.unbillableCategoryId,
    unbillableCategoryName: undefined,
    clockOut: undefined,
    status: 'clocked_in',
  };
}

export function buildEffectiveClockState(
  serverActiveEntry: TimeEntry | null,
  commands: OfflineClockCommand[],
  serverShiftStartedAt?: string,
): EffectiveClockState {
  const dependencies = analyzeCommandDependencies(commands);
  const pending = dependencies.replayable;
  const needsAttention = dependencies.actionable;
  let activeEntry = serverActiveEntry;
  let activeSource: EffectiveClockState['activeSource'] = serverActiveEntry ? 'server' : null;
  const mappedAttention = serverActiveEntry
    ? needsAttention.find((command) => command.resolvedServerEntryId === serverActiveEntry.id)
    : undefined;
  let localShiftId = mappedAttention?.localShiftId
    ?? (serverActiveEntry ? `server:${serverActiveEntry.id}` : null);
  let shiftStartedAt = serverShiftStartedAt ?? serverActiveEntry?.clockIn;
  let currentSegmentStartedAt = serverActiveEntry?.clockIn;
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
        workAreaId: payload.workAreaId,
        workAreaNameSnapshot: payload.workAreaNameSnapshot,
        unbillableCategoryId: payload.unbillableCategoryId,
        clockIn: command.clientOccurredAt,
        breakMinutes: 0,
        notes: '',
        status: 'clocked_in',
      };
      activeSource = 'offline_pending';
      localShiftId = command.localShiftId;
      shiftStartedAt = command.clientOccurredAt;
      currentSegmentStartedAt = command.clientOccurredAt;
      lastClockOutAt = undefined;
      continue;
    }

    if (command.localShiftId !== localShiftId || !activeEntry) continue;

    if (command.type === 'switch_activity') {
      activeEntry = applyActivity(activeEntry, command, command.logicalPayload as OfflineSwitchPayload);
      currentSegmentStartedAt = command.clientOccurredAt;
      continue;
    }

    const payload = command.logicalPayload as OfflineClockOutPayload;
    activeEntry = null;
    activeSource = null;
    localShiftId = command.localShiftId;
    currentSegmentStartedAt = undefined;
    lastClockOutAt = command.clientOccurredAt;
    void payload;
  }

  const currentShiftConflict = needsAttention.find((command) => command.localShiftId === localShiftId) ?? null;
  const currentShiftPendingCount = localShiftId
    ? pending.filter((command) => command.localShiftId === localShiftId).length
    : 0;
  const currentShiftBlockedCount = localShiftId
    ? dependencies.blocked.filter((command) => command.localShiftId === localShiftId).length
    : 0;
  const effectiveStatus = currentShiftConflict
    ? 'needs_attention'
    : activeEntry
      ? currentShiftPendingCount > 0 ? 'clocked_in_pending' : 'clocked_in_synced'
      : currentShiftPendingCount > 0 ? 'clocked_out_pending' : 'clocked_out_synced';

  return {
    activeEntry,
    activeSource,
    effectiveActiveEntryId: activeEntry?.id ?? null,
    effectiveStatus,
    shiftStartedAt,
    currentSegmentStartedAt,
    currentActivity: activeEntry ? {
      workType: activeEntry.workType,
      jobId: activeEntry.jobId,
      jobIds: activeEntry.jobIds,
      workAreaId: activeEntry.workAreaId,
      workAreaNameSnapshot: activeEntry.workAreaNameSnapshot,
      unbillableCategoryId: activeEntry.unbillableCategoryId,
      unbillableCategoryName: activeEntry.unbillableCategoryName,
    } : null,
    localShiftId,
    pendingCount: pending.length,
    needsAttentionCount: needsAttention.length,
    blockedCount: dependencies.blocked.length,
    correctionRequestedCount: dependencies.correctionRequested.length,
    currentShiftPendingCount,
    currentShiftBlockedCount,
    currentShiftConflict,
    syncStatus: currentShiftConflict ? 'needs_attention' : currentShiftPendingCount > 0 ? 'pending' : 'synced',
    lastClockOutAt,
  };
}

export function nextReplayableCommand(commands: OfflineClockCommand[]) {
  return analyzeCommandDependencies(commands).replayable[0] ?? null;
}
