import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import type { TimeOffRequest, TimeOffRequestType } from '@/types/timeOff';

export type TimeOffDraft = {
  requestType: TimeOffRequestType;
  startDate: string;
  endDate: string;
  employeeNote: string;
};

export type TimeOffSubmissionAttempt = {
  fingerprint: string;
  idempotencyKey: string;
};

type TimeOffContextValue = {
  requests: TimeOffRequest[];
  details: Record<string, TimeOffRequest>;
  loaded: boolean;
  listError: string | null;
  flashMessage: string | null;
  draft: TimeOffDraft;
  submissionAttempt: TimeOffSubmissionAttempt | null;
  setRequests: (requests: TimeOffRequest[]) => void;
  upsertRequest: (request: TimeOffRequest) => void;
  setListError: (message: string | null) => void;
  setFlashMessage: (message: string | null) => void;
  setDraft: (draft: TimeOffDraft) => void;
  setSubmissionAttempt: (attempt: TimeOffSubmissionAttempt | null) => void;
  resetTimeOffState: () => void;
};

const emptyDraft: TimeOffDraft = {
  requestType: 'vacation',
  startDate: '',
  endDate: '',
  employeeNote: '',
};

const TimeOffContext = createContext<TimeOffContextValue | undefined>(undefined);

function newestFirst(requests: TimeOffRequest[]) {
  return requests.slice().sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
}

export function TimeOffProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuthStore();
  const [requests, setRequestState] = useState<TimeOffRequest[]>([]);
  const [details, setDetails] = useState<Record<string, TimeOffRequest>>({});
  const [loaded, setLoaded] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<TimeOffDraft>(emptyDraft);
  const [submissionAttempt, setSubmissionAttempt] = useState<TimeOffSubmissionAttempt | null>(null);
  const previousIdentityRef = useRef<string | null>(null);

  const setRequests = useCallback((next: TimeOffRequest[]) => {
    const sorted = newestFirst(next);
    setRequestState(sorted);
    setDetails(Object.fromEntries(sorted.map((request) => [request.id, request])));
    setLoaded(true);
    setListError(null);
  }, []);

  const upsertRequest = useCallback((request: TimeOffRequest) => {
    setRequestState((current) => newestFirst([
      request,
      ...current.filter((item) => item.id !== request.id),
    ]));
    setDetails((current) => ({ ...current, [request.id]: request }));
  }, []);

  const resetTimeOffState = useCallback(() => {
    setRequestState([]);
    setDetails({});
    setLoaded(false);
    setListError(null);
    setFlashMessage(null);
    setDraft(emptyDraft);
    setSubmissionAttempt(null);
  }, []);

  useEffect(() => {
    const nextIdentity = status === 'authenticated' && user
      ? `${user.businessId}:${user.id}:${user.employeeId ?? ''}`
      : null;
    if (previousIdentityRef.current !== nextIdentity) {
      resetTimeOffState();
      previousIdentityRef.current = nextIdentity;
    }
  }, [resetTimeOffState, status, user]);

  const value = useMemo<TimeOffContextValue>(() => ({
    requests,
    details,
    loaded,
    listError,
    flashMessage,
    draft,
    submissionAttempt,
    setRequests,
    upsertRequest,
    setListError,
    setFlashMessage,
    setDraft,
    setSubmissionAttempt,
    resetTimeOffState,
  }), [
    details,
    draft,
    flashMessage,
    listError,
    loaded,
    requests,
    resetTimeOffState,
    setRequests,
    submissionAttempt,
    upsertRequest,
  ]);

  return <TimeOffContext.Provider value={value}>{children}</TimeOffContext.Provider>;
}

export function useTimeOffStore() {
  const context = useContext(TimeOffContext);
  if (!context) throw new Error('useTimeOffStore must be used inside TimeOffProvider');
  return context;
}
