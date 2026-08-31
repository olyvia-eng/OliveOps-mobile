import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Sentry from '@sentry/react-native';
import * as clockingApi from '@/api/clockingApi';
import { buildEffectiveClockState, nextReplayableCommand } from '@/features/offlineClocking/model';
import {
  OFFLINE_CLOCK_SCHEMA_VERSION,
  SUPPORTED_OFFLINE_CLOCK_SCHEMA_VERSIONS,
  type OfflineClockCache,
  type OfflineClockCommand,
  type OfflineClockInPayload,
  type OfflineClockOutPayload,
  type OfflineSwitchPayload,
} from '@/features/offlineClocking/types';
import { getCurrentShiftSegments, resolveCurrentActiveEntry } from '@/features/clocking/presentation';
import { scopeJobsForSession, scopeTimeEntriesForSession } from '@/features/clocking/scoping';
import { beginRequest, endRequest } from '@/services/requestGuards';
import {
  completeOfflineCommand,
  insertOfflineCommand,
  loadOfflineClockCache,
  loadOfflineCommands,
  loadShiftMapping,
  saveOfflineClockCache,
  updateOfflineCommand,
} from '@/services/offlineClockStorage';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import {
  OfflineClockContext,
  type OfflineClockContextValue,
  type OfflineClockRecordedResult as RecordedResult,
  type OfflineClockSubmitMeta as SubmitMeta,
} from '@/store/offlineClockContext';
import type { ClockInRequest, ClockOutRequest, PendingClockInWorkflow, SwitchActivityRequest } from '@/types/api';
import type { ApiError } from '@/types/errors';

const NEEDS_ATTENTION_CODES = new Set([
  'offline_event_invalid_timestamp',
  'offline_event_too_old',
  'offline_event_in_future',
  'offline_event_order_conflict',
  'offline_shift_state_conflict',
  'offline_job_unauthorized',
  'clock_idempotency_conflict',
]);
const LOCAL_NEEDS_ATTENTION_CODES = new Set(['offline_shift_dependency']);

const BACKOFF_MS = [0, 5_000, 15_000, 60_000, 5 * 60_000];

function identityFor(user: ReturnType<typeof useAuthStore>['user']) {
  if (!user?.employeeId) return null;
  return `${user.businessId}:${user.id}:${user.employeeId}`;
}

function opaqueId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
}

function errorCode(error: unknown) {
  const code = (error as ApiError | undefined)?.code;
  return typeof code === 'string' ? code.toLowerCase() : undefined;
}

function isRetryable(error: unknown) {
  const status = (error as ApiError | undefined)?.status;
  return typeof status !== 'number' || status === 408 || status >= 500;
}

export function OfflineClockProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, status, user } = useAuthStore();
  const clocking = useClockingStore();
  const identityKey = identityFor(user);
  const [commands, setCommands] = useState<OfflineClockCommand[]>([]);
  const [cache, setCache] = useState<OfflineClockCache | null>(null);
  const cacheRef = useRef<OfflineClockCache | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [pendingClockInWorkflow, setPendingClockInWorkflow] = useState<PendingClockInWorkflow | null>(null);
  const syncPromiseRef = useRef<Promise<void> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const identityRef = useRef(identityKey);
  identityRef.current = identityKey;
  cacheRef.current = cache;

  const serverActiveEntry = useMemo(
    () => resolveCurrentActiveEntry(clocking.timeEntries, user?.employeeId, clocking.currentActiveEntryId),
    [clocking.currentActiveEntryId, clocking.timeEntries, user?.employeeId],
  );
  const serverShiftStartedAt = useMemo(
    () => getCurrentShiftSegments(
      clocking.timeEntries,
      user?.employeeId,
      clocking.currentActiveEntryId,
    )[0]?.clockIn,
    [clocking.currentActiveEntryId, clocking.timeEntries, user?.employeeId],
  );
  const effectiveState = useMemo(
    () => buildEffectiveClockState(serverActiveEntry, commands, serverShiftStartedAt),
    [commands, serverActiveEntry, serverShiftStartedAt],
  );
  const effectiveTimeEntries = useMemo(() => {
    if (!effectiveState.activeEntry) {
      if (effectiveState.pendingCount === 0) return clocking.timeEntries;
      return clocking.timeEntries.map((entry) => entry.id === serverActiveEntry?.id
        ? { ...entry, status: 'clocked_out' as const, clockOut: effectiveState.lastClockOutAt ?? entry.clockOut }
        : entry);
    }
    const remaining = clocking.timeEntries.filter((entry) => entry.id !== serverActiveEntry?.id);
    return [effectiveState.activeEntry, ...remaining];
  }, [clocking.timeEntries, effectiveState, serverActiveEntry?.id]);

  const replaceCommand = useCallback((next: OfflineClockCommand) => {
    setCommands((current) => current.map((command) => command.id === next.id ? next : command));
  }, []);

  const updateEligibilityCache = useCallback(async (update: {
    jobs?: typeof clocking.jobs;
    unbillableCategories?: typeof clocking.unbillableCategories;
    activityConfigs?: NonNullable<typeof clocking.activityConfigs>;
    requiredBeforeClockInForms?: boolean;
    requiredAfterClockOutForms?: boolean;
  }) => {
    if (!identityKey || status !== 'authenticated') return;
    const previous = cacheRef.current?.identityKey === identityKey ? cacheRef.current : null;
    const next: OfflineClockCache = {
      schemaVersion: OFFLINE_CLOCK_SCHEMA_VERSION,
      identityKey,
      updatedAt: new Date().toISOString(),
      jobs: update.jobs?.map(({ id, title, status: jobStatus, hasOperationalWorkAreas, eligibleOperationalWorkAreas }) => ({
        id,
        title,
        status: jobStatus,
        hasOperationalWorkAreas,
        eligibleOperationalWorkAreas: eligibleOperationalWorkAreas?.map(({ id: workAreaId, name, status: workAreaStatus }) => ({
          id: workAreaId,
          name,
          status: workAreaStatus,
        })),
      }))
        ?? previous?.jobs
        ?? [],
      unbillableCategories: update.unbillableCategories?.map(({ id, name, active }) => ({ id, name, active }))
        ?? previous?.unbillableCategories
        ?? [],
      driveTimeAvailable: update.activityConfigs?.some((item) => item.type === 'drive_time')
        ?? previous?.driveTimeAvailable
        ?? true,
      jobWorkAvailable: update.activityConfigs?.some((item) => item.type === 'job')
        ?? previous?.jobWorkAvailable
        ?? true,
      unbillableAvailable: update.activityConfigs?.some((item) => item.type === 'non_billable')
        ?? previous?.unbillableAvailable
        ?? false,
      requiredBeforeClockInForms: update.requiredBeforeClockInForms
        ?? previous?.requiredBeforeClockInForms,
      requiredAfterClockOutForms: update.requiredAfterClockOutForms
        ?? previous?.requiredAfterClockOutForms,
    };
    cacheRef.current = next;
    setCache(next);
    await saveOfflineClockCache(next);
  }, [identityKey, status]);

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    setCommands([]);
    setCache(null);
    setPendingClockInWorkflow(null);
    if (!identityKey || status !== 'authenticated') {
      setHydrated(true);
      return () => { cancelled = true; };
    }
    void Promise.all([loadOfflineCommands(identityKey), loadOfflineClockCache(identityKey)]).then(async ([stored, storedCache]) => {
      if (cancelled || identityRef.current !== identityKey) return;
      const obsoleteShiftIds = new Set(stored
        .filter((command) => command.lastErrorCode === 'required_before_clock_in_forms')
        .map((command) => command.localShiftId));
      for (const command of stored) {
        if (obsoleteShiftIds.has(command.localShiftId)) await completeOfflineCommand(command);
      }
      if (cancelled || identityRef.current !== identityKey) return;
      const supported = stored
        .filter((command) => !obsoleteShiftIds.has(command.localShiftId))
        .map((command) => SUPPORTED_OFFLINE_CLOCK_SCHEMA_VERSIONS.has(command.schemaVersion)
        ? command
        : { ...command, status: 'needs_attention' as const, lastErrorCategory: 'unsupported_schema' });
      setCommands(supported);
      setCache(storedCache);
      setHydrated(true);
    }).catch(() => {
      if (cancelled) return;
      setHydrated(true);
      Sentry.captureMessage('offline_clock_queue_decode_error', 'error');
    });
    return () => { cancelled = true; };
  }, [identityKey, status]);

  const syncNow = useCallback(async () => {
    if (syncPromiseRef.current) return syncPromiseRef.current;
    if (!identityKey || status !== 'authenticated' || !user?.employeeId || !accessToken) return;

    const run = async () => {
      let completedAny = false;
      while (true) {
        const queued = await loadOfflineCommands(identityKey);
        const stored = nextReplayableCommand(queued);
        if (!stored) {
          if (completedAny && identityRef.current === identityKey) {
            try {
              const payload = await clockingApi.loadBootstrap(accessToken, { force: true });
              if (identityRef.current !== identityKey) return;
              clocking.setJobs(scopeJobsForSession(payload.jobs ?? [], user));
              clocking.setBusinessTimeZone(payload.timezone);
              clocking.setTimeEntries(scopeTimeEntriesForSession(payload.timeEntries ?? [], user));
              clocking.setTimeCorrections(payload.timeCorrections ?? []);
              clocking.setCurrentActiveEntryId(payload.currentActiveEntryId ?? null);
              clocking.setActiveShiftWarnings(payload.activeShiftWarnings);
              clocking.setActivityConfigs(payload.activityConfigs);
              await updateEligibilityCache({
                jobs: scopeJobsForSession(payload.jobs ?? [], user),
                activityConfigs: payload.activityConfigs ?? [],
                requiredBeforeClockInForms: payload.capabilities
                  ? payload.capabilities.requiredBeforeClockInForms === true
                  : undefined,
                requiredAfterClockOutForms: payload.capabilities
                  ? payload.capabilities.requiredAfterClockOutForms === true
                  : false,
              });
            } catch {
              Sentry.captureMessage('offline_clock_bootstrap_reconcile_failed', 'warning');
            }
          }
          return;
        }
        if (identityRef.current !== identityKey) return;

        const syncing = { ...stored, status: 'syncing' as const, retryCount: stored.retryCount + 1 };
        let attempted = syncing;
        await updateOfflineCommand(attempted);
        replaceCommand(attempted);
        const guardKey = `clocking:${stored.employeeId}`;
        if (!beginRequest(guardKey)) {
          const pending = { ...syncing, status: 'pending' as const };
          await updateOfflineCommand(pending);
          replaceCommand(pending);
          return;
        }

        try {
          if (stored.type === 'clock_in') {
            const response = await clockingApi.clockIn({
              ...(stored.logicalPayload as OfflineClockInPayload),
              requestId: stored.requestId,
              idempotencyKey: stored.idempotencyKey,
              clientOccurredAt: stored.clientOccurredAt,
            } satisfies ClockInRequest, accessToken);
            if (response.status === 'clock_in_pending_required_forms') {
              const provisionalShiftCommands = queued.filter((command) => command.localShiftId === stored.localShiftId);
              for (const command of provisionalShiftCommands) {
                await completeOfflineCommand(command.id === stored.id ? syncing : command);
              }
              completedAny = true;
              setCommands((current) => current.filter((command) => command.localShiftId !== stored.localShiftId));
              setPendingClockInWorkflow(response);
              continue;
            }
            await completeOfflineCommand(syncing, {
              identityKey,
              localShiftId: stored.localShiftId,
              serverEntryId: response.timeEntry.id,
            });
            clocking.upsertTimeEntry(response.timeEntry);
            clocking.setCurrentActiveEntryId(response.timeEntry.id);
          } else if (stored.type === 'switch_activity') {
            const response = await clockingApi.switchActivity({
              ...(stored.logicalPayload as OfflineSwitchPayload),
              requestId: stored.requestId,
              idempotencyKey: stored.idempotencyKey,
              clientOccurredAt: stored.clientOccurredAt,
            } satisfies SwitchActivityRequest, accessToken);
            await completeOfflineCommand(attempted, {
              identityKey,
              localShiftId: stored.localShiftId,
              serverEntryId: response.timeEntry.id,
            });
            clocking.upsertTimeEntry(response.timeEntry);
            clocking.setCurrentActiveEntryId(response.timeEntry.id);
          } else {
            const payload = stored.logicalPayload as OfflineClockOutPayload;
            const entryId = payload.entryId ?? await loadShiftMapping(identityKey, stored.localShiftId);
            if (!entryId) throw Object.assign(new Error('Offline shift dependency is unresolved.'), { code: 'offline_shift_dependency' });
            attempted = { ...syncing, resolvedServerEntryId: entryId };
            await updateOfflineCommand(attempted);
            replaceCommand(attempted);
            const response = await clockingApi.clockOut({
              ...payload,
              entryId,
              requestId: stored.requestId,
              idempotencyKey: stored.idempotencyKey,
              clientOccurredAt: stored.clientOccurredAt,
            } satisfies ClockOutRequest, accessToken);
            await completeOfflineCommand(attempted);
            if (response.status !== 'clock_out_pending_required_forms') {
              if ('timeEntry' in response && response.timeEntry) clocking.upsertTimeEntry(response.timeEntry);
              clocking.setCurrentActiveEntryId(null);
            }
          }
          completedAny = true;
          setCommands((current) => current.filter((command) => command.id !== stored.id));
        } catch (error) {
          const code = errorCode(error);
          if (NEEDS_ATTENTION_CODES.has(code ?? '') || LOCAL_NEEDS_ATTENTION_CODES.has(code ?? '')) {
            const attention = { ...attempted, status: 'needs_attention' as const, lastErrorCategory: code ?? 'offline_clock_conflict' };
            await updateOfflineCommand(attention);
            replaceCommand(attention);
            Sentry.captureMessage(code ?? 'offline_clock_sync_conflict', 'warning');
          } else {
            const pending = { ...attempted, status: 'pending' as const, lastErrorCategory: code ?? 'network_unavailable' };
            await updateOfflineCommand(pending);
            replaceCommand(pending);
            if (isRetryable(error)) {
              const delay = BACKOFF_MS[Math.min(pending.retryCount, BACKOFF_MS.length - 1)];
              if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
              retryTimerRef.current = setTimeout(() => { void syncNow(); }, delay);
            }
          }
          return;
        } finally {
          endRequest(guardKey);
        }
      }
    };

    syncPromiseRef.current = run()
      .catch(() => {
        Sentry.captureMessage('offline_clock_sync_infrastructure_failed', 'error');
      })
      .finally(() => {
        syncPromiseRef.current = null;
      });
    return syncPromiseRef.current;
  }, [accessToken, clocking, identityKey, replaceCommand, status, updateEligibilityCache, user]);

  useEffect(() => {
    if (!hydrated || status !== 'authenticated') return;
    void syncNow();
    const networkSubscription = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) void syncNow();
    });
    const appSubscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void syncNow();
    });
    return () => {
      networkSubscription();
      appSubscription.remove();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [hydrated, status, syncNow]);

  const record = useCallback(async (
    type: OfflineClockCommand['type'],
    localShiftId: string,
    logicalPayload: OfflineClockCommand['logicalPayload'],
    meta: SubmitMeta,
  ): Promise<RecordedResult> => {
    if (!identityKey || !user?.employeeId) return { ok: false, error: 'Employee profile is not linked to this account.' };
    if (!hydrated) return { ok: false, error: 'Saved clocking changes are still loading. Please try again.' };
    const guardKey = `clocking:${user.employeeId}`;
    if (!beginRequest(guardKey)) return { ok: false, error: 'Another clocking action is already in progress.' };
    const command: OfflineClockCommand = {
      schemaVersion: OFFLINE_CLOCK_SCHEMA_VERSION,
      id: meta.idempotencyKey,
      identityKey,
      employeeId: user.employeeId,
      businessId: user.businessId,
      localShiftId,
      type,
      logicalPayload,
      requestId: meta.requestId,
      idempotencyKey: meta.idempotencyKey,
      clientOccurredAt: meta.clientOccurredAt,
      queuedAt: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
    };
    try {
      await insertOfflineCommand(command);
      if (identityRef.current === identityKey) {
        setCommands((current) => current.some((item) => item.id === command.id) ? current : [...current, command]);
      }
    } catch {
      Sentry.captureMessage('offline_clock_queue_write_failed', 'error');
      return { ok: false, error: 'This clocking change could not be saved on this device. Please try again.' };
    } finally {
      endRequest(guardKey);
    }
    await syncNow();
    let remaining = await loadOfflineCommands(identityKey);
    let recorded = remaining.find((item) => item.id === command.id);
    if (recorded?.status === 'pending' && recorded.retryCount === 0) {
      await syncNow();
      remaining = await loadOfflineCommands(identityKey);
      recorded = remaining.find((item) => item.id === command.id);
    }
    return { ok: true, pendingSync: Boolean(recorded) };
  }, [hydrated, identityKey, syncNow, user?.businessId, user?.employeeId]);

  const submitClockIn = useCallback((payload: OfflineClockInPayload, meta: SubmitMeta) => {
    if (effectiveState.activeEntry) {
      return Promise.resolve({ ok: false, error: 'You are already clocked in.' } as RecordedResult);
    }
    return record('clock_in', opaqueId('local-shift'), payload, meta);
  }, [effectiveState.activeEntry, record]);
  const submitSwitchActivity = useCallback((payload: OfflineSwitchPayload, meta: SubmitMeta) => {
    if (!effectiveState.localShiftId) return Promise.resolve({ ok: false, error: 'No active shift found.' } as RecordedResult);
    return record('switch_activity', effectiveState.localShiftId, payload, meta);
  }, [effectiveState.localShiftId, record]);
  const submitClockOut = useCallback((payload: OfflineClockOutPayload, meta: SubmitMeta) => {
    if (!effectiveState.localShiftId) return Promise.resolve({ ok: false, error: 'No active shift found.' } as RecordedResult);
    return record('clock_out', effectiveState.localShiftId, payload, meta);
  }, [effectiveState.localShiftId, record]);

  const resolveCommandWithCorrection = useCallback(async (commandId: string, correctionRequestId: string) => {
    if (!identityKey) return;
    const command = commands.find((item) => item.id === commandId && item.status === 'needs_attention');
    if (!command || command.correctionRequestId) return;
    const resolved = {
      ...command,
      correctionRequestId,
      correctionRequestedAt: new Date().toISOString(),
    };
    await updateOfflineCommand(resolved);
    replaceCommand(resolved);
  }, [commands, identityKey, replaceCommand]);

  const acknowledgePendingClockInWorkflow = useCallback(() => setPendingClockInWorkflow(null), []);

  const value = useMemo<OfflineClockContextValue>(() => ({
    hydrated,
    commands,
    cache,
    effectiveState,
    effectiveTimeEntries,
    effectiveCurrentActiveEntryId: effectiveState.effectiveActiveEntryId,
    pendingClockInWorkflow,
    acknowledgePendingClockInWorkflow,
    submitClockIn,
    submitSwitchActivity,
    submitClockOut,
    updateEligibilityCache,
    resolveCommandWithCorrection,
    syncNow,
  }), [acknowledgePendingClockInWorkflow, cache, commands, effectiveState, effectiveTimeEntries, hydrated, pendingClockInWorkflow, resolveCommandWithCorrection, submitClockIn, submitClockOut, submitSwitchActivity, syncNow, updateEligibilityCache]);

  return <OfflineClockContext.Provider value={value}>{children}</OfflineClockContext.Provider>;
}

export function useOfflineClockStore() {
  const context = useContext(OfflineClockContext);
  if (!context) throw new Error('useOfflineClockStore must be used inside OfflineClockProvider');
  return context;
}

