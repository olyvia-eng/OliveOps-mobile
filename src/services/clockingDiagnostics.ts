import * as Sentry from '@sentry/react-native';
import type { BootstrapResponse, PendingClockInWorkflow } from '@/types/api';
import type { TimeEntry } from '@/types/domain';

type OfflineTraceState = {
  pendingClockInCount: number;
  syntheticActivePresent: boolean;
  effectiveActiveSource: string;
};

export function captureClockingBootstrapTrace(
  bootstrap: BootstrapResponse,
  employeeId?: string,
) {
  const activeEntry = bootstrap.timeEntries?.find((entry) => entry.id === bootstrap.currentActiveEntryId);
  const employeeEntries = bootstrap.timeEntries?.filter((entry) => entry.employeeId === employeeId) ?? [];
  Sentry.captureMessage('clocking_bootstrap_trace', {
    level: 'info',
    contexts: {
      clocking_bootstrap_trace: {
        currentActiveEntryIdPresent: Boolean(bootstrap.currentActiveEntryId),
        activeShiftPresent: Boolean(bootstrap.currentActiveEntryId),
        activeEntryIdPresent: Boolean(bootstrap.currentActiveEntryId),
        referencedTimeEntryPresent: Boolean(activeEntry),
        referencedTimeEntryStatus: activeEntry?.status ?? 'unavailable',
        employeeClockedInTimeEntryCount: employeeEntries.filter((entry) => entry.status === 'clocked_in').length,
        pendingMandatoryWorkflowPresent: Boolean(bootstrap.pendingClockInWorkflow),
        remainingRequiredFormCount: bootstrap.pendingClockInWorkflow?.remainingRequiredFormCount ?? 0,
      },
    },
  });
}

export function captureClockInFinalizeTrace(input: {
  workflow: PendingClockInWorkflow;
  httpStatus: number;
  resultStatus: string;
  backendErrorCode?: string;
  responseTimeEntry?: TimeEntry;
  currentActiveEntryId: string | null;
  timeEntries: TimeEntry[];
  recoveryBootstrap?: BootstrapResponse;
  offline: OfflineTraceState;
  networkState: string;
}) {
  const currentEntry = input.timeEntries.find((entry) => entry.id === input.currentActiveEntryId)
    ?? (input.responseTimeEntry?.id === input.currentActiveEntryId ? input.responseTimeEntry : undefined);
  const serverActiveEntryId = input.recoveryBootstrap?.currentActiveEntryId ?? null;
  const serverActiveEntry = input.recoveryBootstrap?.timeEntries?.find((entry) => entry.id === serverActiveEntryId);
  Sentry.captureMessage('clock_in_finalize_trace', {
    level: input.httpStatus >= 400 || input.backendErrorCode ? 'warning' : 'info',
    contexts: {
      clock_in_finalize_trace: {
        workflowOccurrenceId: input.workflow.workflowOccurrenceId,
        httpStatus: input.httpStatus,
        resultStatus: input.resultStatus,
        backendErrorCode: input.backendErrorCode ?? 'none',
        responseTimeEntryPresent: Boolean(input.responseTimeEntry),
        responseTimeEntryId: input.responseTimeEntry?.id ?? 'unavailable',
        responseTimeEntryStatus: input.responseTimeEntry?.status ?? 'unavailable',
        currentActiveEntryId: input.currentActiveEntryId ?? 'unavailable',
        currentActiveEntryResolved: Boolean(currentEntry),
        resolvedTimeEntryStatus: currentEntry?.status ?? 'unavailable',
        serverActiveShiftPresent: Boolean(serverActiveEntryId),
        serverActiveEntryId: serverActiveEntryId ?? 'unavailable',
        serverActiveEntryResolved: Boolean(serverActiveEntry),
        pendingMandatoryWorkflowPresent: Boolean(input.recoveryBootstrap?.pendingClockInWorkflow ?? input.workflow),
        requiredFormCount: input.workflow.requiredFormCount,
        completedRequiredFormCount: input.workflow.completedRequiredFormCount,
        remainingRequiredFormCount: input.workflow.remainingRequiredFormCount,
        workflowStatus: input.workflow.status,
        workType: input.workflow.clockInIntent.workType,
        workAreaIdPresent: Boolean(input.workflow.clockInIntent.workAreaId),
        clockingContractVersion: input.workflow.clockInIntent.clockingContractVersion ?? 0,
        offlinePendingClockInCommandCount: input.offline.pendingClockInCount,
        offlineSyntheticActivePresent: input.offline.syntheticActivePresent,
        effectiveActiveSource: input.offline.effectiveActiveSource,
        networkState: input.networkState,
      },
    },
  });
}