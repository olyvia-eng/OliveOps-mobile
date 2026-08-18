import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import type {
  EmployeeForm,
  EmployeeFormsResponse,
  EmployeeFormSubmission,
  EmployeeFormSubmissionDetailResponse,
} from '@/types/forms';

type FormsState = {
  toDo: EmployeeForm[];
  available: EmployeeForm[];
  completed: EmployeeFormSubmission[];
  timezone: string | null;
  generatedAt: string | null;
  loadedAt: number | null;
  submissionDetails: Record<string, EmployeeFormSubmissionDetailResponse>;
  flashMessage: string | null;
  setWorkspace: (workspace: EmployeeFormsResponse) => void;
  setSubmissionDetail: (detail: EmployeeFormSubmissionDetailResponse) => void;
  setFlashMessage: (message: string | null) => void;
  resetFormsState: () => void;
};

const FormsContext = createContext<FormsState | undefined>(undefined);

export function FormsProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuthStore();
  const [toDo, setToDo] = useState<EmployeeForm[]>([]);
  const [available, setAvailable] = useState<EmployeeForm[]>([]);
  const [completed, setCompleted] = useState<EmployeeFormSubmission[]>([]);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [submissionDetails, setSubmissionDetails] = useState<Record<string, EmployeeFormSubmissionDetailResponse>>({});
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const previousIdentityRef = useRef<string | null>(null);

  const setWorkspace = useCallback((workspace: EmployeeFormsResponse) => {
    setToDo(workspace.toDo ?? []);
    setAvailable(workspace.available ?? []);
    setCompleted(workspace.completed ?? []);
    setTimezone(workspace.timezone);
    setGeneratedAt(workspace.generatedAt);
    setLoadedAt(Date.now());
  }, []);

  const setSubmissionDetail = useCallback((detail: EmployeeFormSubmissionDetailResponse) => {
    setSubmissionDetails((current) => ({
      ...current,
      [detail.submission.submissionId]: detail,
    }));
  }, []);

  const resetFormsState = useCallback(() => {
    setToDo([]);
    setAvailable([]);
    setCompleted([]);
    setTimezone(null);
    setGeneratedAt(null);
    setLoadedAt(null);
    setSubmissionDetails({});
    setFlashMessage(null);
  }, []);

  useEffect(() => {
    const nextIdentity = status === 'authenticated' && user
      ? `${user.businessId}:${user.id}:${user.employeeId ?? ''}`
      : null;

    if (previousIdentityRef.current !== nextIdentity) {
      resetFormsState();
      previousIdentityRef.current = nextIdentity;
    }
  }, [resetFormsState, status, user]);

  const value = useMemo<FormsState>(() => ({
    toDo,
    available,
    completed,
    timezone,
    generatedAt,
    loadedAt,
    submissionDetails,
    flashMessage,
    setWorkspace,
    setSubmissionDetail,
    setFlashMessage,
    resetFormsState,
  }), [
    available,
    completed,
    flashMessage,
    generatedAt,
    loadedAt,
    resetFormsState,
    setSubmissionDetail,
    setWorkspace,
    submissionDetails,
    timezone,
    toDo,
  ]);

  return <FormsContext.Provider value={value}>{children}</FormsContext.Provider>;
}

export function useFormsStore() {
  const context = useContext(FormsContext);
  if (!context) throw new Error('useFormsStore must be used inside FormsProvider');
  return context;
}