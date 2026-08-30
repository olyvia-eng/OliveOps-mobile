import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { FormContextSummary } from '@/components/FormContextSummary';
import { FormFieldRenderer } from '@/components/FormFieldRenderer';
import { ScreenHeader, StatusBadge } from '@/components/MobilePrimitives';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import {
  buildFormResponses,
  hasRequiredUnsupportedField,
  initialFormValues,
  type EmployeeFormFieldErrors,
  type EmployeeFormValues,
  validateFormValues,
} from '@/features/forms/formValidation';
import { useFormsActions } from '@/hooks/useFormsActions';
import { useClockingActions } from '@/hooks/useClockingActions';
import { createFormClientSubmissionId } from '@/services/requestGuards';
import { isOnline } from '@/services/connectivity';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { useFormsStore } from '@/store/formsStore';
import { useFormsWorkflowStore } from '@/store/formsWorkflowStore';
import { pendingClockInRequirementForm, usePendingClockInStore } from '@/store/pendingClockInStore';
import {
  requirementForm,
  usePendingClockOutStore,
  workflowRequirements,
} from '@/store/pendingClockOutStore';
import { colors, spacing, typography } from '@/theme/colors';
import type { EmployeeForm } from '@/types/forms';
import { returnToParentOrReplace, returnToParentThenPush } from '@/utils/navigation';

type MandatoryFinalizationKind = 'clock_in' | 'clock_out';
type FinalizationState = 'idle' | 'finalizing' | 'failed';
type MandatoryFormSnapshot = { routeKey: string; form: EmployeeForm };
type InitialValuesSnapshot = { routeKey: string; values: EmployeeFormValues };

function matchesParams(form: EmployeeForm, params: Record<string, string | string[] | undefined>) {
  return form.id === params.formId
    && form.trigger === params.trigger
    && (params.jobId ?? '') === (form.context?.jobId ?? '')
    && (params.equipmentId ?? '') === (form.context?.equipmentId ?? '')
    && (params.divisionId ?? '') === (form.context?.divisionId ?? '');
}

export default function FormScreen() {
  const params = useLocalSearchParams<{ list?: string; formId?: string; trigger?: string; jobId?: string; equipmentId?: string; divisionId?: string; returnTo?: string; workflowId?: string; workflowOccurrenceId?: string; workflowRequirementId?: string }>();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { businessTimeZone } = useClockingStore();
  const { toDo, available } = useFormsStore();
  const { workflow, completeCurrentForm } = useFormsWorkflowStore();
  const { refreshForms, submitForm, submitting } = useFormsActions();
  const { refreshWorkContext } = useClockingActions();
  const pendingClockIn = usePendingClockInStore();
  const pendingClockOut = usePendingClockOutStore();
  const mandatoryRouteKey = params.workflowOccurrenceId && params.workflowRequirementId
    ? `${params.workflowOccurrenceId}:${params.workflowRequirementId}`
    : null;
  const mandatoryKind: MandatoryFinalizationKind | null = mandatoryRouteKey
    ? params.trigger === 'before_clock_in'
      ? 'clock_in'
      : params.trigger === 'after_clock_out'
        ? 'clock_out'
        : null
    : null;
  const mandatoryClockInRequirement = params.workflowOccurrenceId === pendingClockIn.workflow?.workflowOccurrenceId
    && params.workflowRequirementId === pendingClockIn.currentRequirement?.requirementId
    ? pendingClockIn.currentRequirement
    : null;
  const mandatoryClockOutRequirement = params.workflowOccurrenceId === pendingClockOut.workflow?.workflowOccurrenceId
    && params.workflowRequirementId === pendingClockOut.currentRequirement?.workflowRequirementId
    ? pendingClockOut.currentRequirement
    : null;
  const liveMandatoryForm = mandatoryClockInRequirement
    ? pendingClockInRequirementForm(mandatoryClockInRequirement)
    : requirementForm(mandatoryClockOutRequirement);
  const stableMandatoryFormRef = useRef<MandatoryFormSnapshot | null>(null);
  if (stableMandatoryFormRef.current?.routeKey !== mandatoryRouteKey) {
    stableMandatoryFormRef.current = null;
  }
  const availableMandatoryForm = liveMandatoryForm?.id === params.formId ? liveMandatoryForm : null;
  if (mandatoryRouteKey && !stableMandatoryFormRef.current && availableMandatoryForm) {
    stableMandatoryFormRef.current = { routeKey: mandatoryRouteKey, form: availableMandatoryForm };
  }
  const stableMandatoryForm = stableMandatoryFormRef.current?.routeKey === mandatoryRouteKey
    ? stableMandatoryFormRef.current.form
    : null;
  const candidates = params.list === 'available' ? available : toDo;
  const workflowForm = params.workflowId && workflow?.id === params.workflowId
    ? workflow.forms[workflow.completedCount] ?? null
    : null;
  const matchedForm = useMemo(
    () => mandatoryRouteKey
      ? stableMandatoryForm
      : workflowForm && matchesParams(workflowForm, params)
        ? workflowForm
        : candidates.find((item) => matchesParams(item, params)) ?? null,
    [candidates, mandatoryRouteKey, params, stableMandatoryForm, workflowForm],
  );
  const formRouteIdentity = mandatoryRouteKey
    ?? `${params.list ?? ''}:${params.workflowId ?? ''}:${params.formId ?? ''}:${params.trigger ?? ''}:${params.jobId ?? ''}:${params.equipmentId ?? ''}:${params.divisionId ?? ''}`;
  const formSnapshotRef = useRef<{ identity: string; form: EmployeeForm } | null>(null);
  const submissionInProgressRef = useRef(false);
  if (formSnapshotRef.current?.identity !== formRouteIdentity) formSnapshotRef.current = null;
  if (matchedForm) formSnapshotRef.current = { identity: formRouteIdentity, form: matchedForm };
  const [mandatorySubmissionAccepted, setMandatorySubmissionAccepted] = useState(false);
  const [finalizationKind, setFinalizationKind] = useState<MandatoryFinalizationKind | null>(null);
  const [finalizationState, setFinalizationState] = useState<FinalizationState>('idle');
  const form = stableMandatoryForm
    ?? matchedForm
    ?? (submissionInProgressRef.current || mandatorySubmissionAccepted ? formSnapshotRef.current?.form ?? null : null);
  const orderedFields = useMemo(
    () => [...(form?.fields ?? [])].sort((left, right) => left.order - right.order),
    [form],
  );
  const mandatoryStore = mandatoryKind === 'clock_in' ? pendingClockIn : pendingClockOut;
  const queuedMandatorySubmission = mandatoryKind && params.workflowRequirementId
    ? mandatoryStore.queuedSubmissionFor?.(params.workflowRequirementId) ?? null
    : null;
  const queuedValues = useMemo(() => Object.fromEntries(
    (queuedMandatorySubmission?.responses ?? []).map((response) => [response.fieldId, response.value]),
  ), [queuedMandatorySubmission]);
  const generatedInitialValues = useMemo(
    () => initialFormValues(orderedFields, queuedValues, new Date(), businessTimeZone),
    [businessTimeZone, orderedFields, queuedValues],
  );
  const mandatoryInitialValuesRef = useRef<InitialValuesSnapshot | null>(null);
  if (mandatoryInitialValuesRef.current?.routeKey !== mandatoryRouteKey) {
    mandatoryInitialValuesRef.current = null;
  }
  if (mandatoryRouteKey && form && !mandatoryInitialValuesRef.current) {
    mandatoryInitialValuesRef.current = { routeKey: mandatoryRouteKey, values: generatedInitialValues };
  }
  const initialValues = mandatoryRouteKey
    ? mandatoryInitialValuesRef.current?.values ?? generatedInitialValues
    : generatedInitialValues;
  const [values, setValues] = useState<EmployeeFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<EmployeeFormFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [submittedFormName, setSubmittedFormName] = useState<string | null>(null);
  const [clockInCompleted, setClockInCompleted] = useState(false);
  const [clockOutCompleted, setClockOutCompleted] = useState(false);
  const [queuedOffline, setQueuedOffline] = useState(false);
  const submittedRef = useRef(false);
  const initializedAttemptRef = useRef('');
  const clientSubmissionRef = useRef<{ identity: string; value: string } | null>(null);
  const refreshedMissingRef = useRef<string | null>(null);
  const submissionFailure = mandatoryKind ? mandatoryStore.submissionFailure : null;
  const submissionIdentity = form && user
    ? `${user.businessId}:${user.id}:${user.employeeId ?? ''}:${mandatoryRouteKey ?? ''}:${form.id}:${form.trigger}:${form.context?.jobId ?? ''}:${form.context?.equipmentId ?? ''}:${form.context?.divisionId ?? ''}`
    : '';

  if (submissionIdentity && clientSubmissionRef.current?.identity !== submissionIdentity) {
    clientSubmissionRef.current = {
      identity: submissionIdentity,
      value: createFormClientSubmissionId(),
    };
  }

  useLayoutEffect(() => {
    if (!submissionIdentity || initializedAttemptRef.current === submissionIdentity) return;
    initializedAttemptRef.current = submissionIdentity;
    submittedRef.current = false;
    submissionInProgressRef.current = false;
    setMandatorySubmissionAccepted(false);
    setFinalizationKind(null);
    setFinalizationState('idle');
    setValues(initialValues);
    setFieldErrors({});
  }, [initialValues, submissionIdentity]);

  useEffect(() => {
    if (form || refreshedMissingRef.current === formRouteIdentity) return;
    refreshedMissingRef.current = formRouteIdentity;
    setRefreshing(true);
    void refreshForms({ force: true }).finally(() => setRefreshing(false));
  }, [form, formRouteIdentity, refreshForms]);

  useEffect(() => {
    if (!submissionFailure || submissionFailure.workflowRequirementId !== params.workflowRequirementId) return;
    setError(submissionFailure.error);
    if (submissionFailure.fieldId) {
      setFieldErrors((current) => ({ ...current, [submissionFailure.fieldId!]: submissionFailure.error }));
    }
  }, [params.workflowRequirementId, submissionFailure]);

  const dirty = JSON.stringify(values) !== JSON.stringify(initialValues);

  useEffect(() => navigation.addListener('beforeRemove', (event: { preventDefault: () => void; data: { action: unknown } }) => {
    if (mandatoryKind && !submittedRef.current) {
      event.preventDefault();
      Alert.alert(
        mandatoryKind === 'clock_in' ? 'Clock in pending' : 'Clock out pending',
        mandatoryKind === 'clock_in'
          ? 'Complete this required form before clocking in.'
          : 'Complete this required form to finish clocking out.',
        [
        { text: 'Continue Form', style: 'cancel' },
        ],
      );
      return;
    }
    if (!dirty || submittedRef.current) return;
    event.preventDefault();
    Alert.alert('Discard changes?', 'Your answers have not been submitted.', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(event.data.action as never) },
    ]);
  }), [dirty, mandatoryKind, navigation]);

  if (clockInCompleted) {
    return (
      <Screen>
        <ScreenHeader title="Clocked in" subtitle="Your required pre-shift forms were submitted and your shift is active." />
        <StatusBanner tone="success" message="Clock-in completed successfully." />
        <PrimaryActionButton label="View Active Shift" onPress={() => returnToParentThenPush('/home', '/active-shift')} />
      </Screen>
    );
  }

  if (clockOutCompleted) {
    return (
      <Screen>
        <ScreenHeader title="Clocked out" subtitle="Your required forms were submitted and your shift is complete." />
        <StatusBanner tone="success" message="Clock-out submitted successfully." />
        <PrimaryActionButton label="Done" onPress={() => returnToParentOrReplace('/home')} />
      </Screen>
    );
  }

  if (queuedOffline) {
    const clockInPending = mandatoryKind === 'clock_in';
    return (
      <Screen>
        <ScreenHeader title="Required form saved" subtitle={clockInPending ? 'Clock in is still pending.' : 'Clock out is still pending.'} />
        <StatusBanner tone="offline" message={clockInPending
          ? 'Reconnect to submit this form and finish clocking in.'
          : 'Reconnect to submit this form and finish clocking out.'} />
        <PrimaryActionButton label="Return Home" onPress={() => returnToParentOrReplace('/home')} />
      </Screen>
    );
  }

  if (submittedFormName) {
    const returnLabel = params.returnTo === '/clock-in'
      ? 'Continue to Clock In'
      : params.returnTo === '/switch-activity'
        ? 'Continue Activity Switch'
        : params.returnTo === '/active-shift'
          ? 'Return to Active Shift'
          : params.returnTo === '/home'
            ? 'Return Home'
            : 'Back to Forms';
    const returnPath = params.returnTo || '/forms';
    return (
      <Screen>
        <ScreenHeader title="Form submitted" subtitle={`${submittedFormName} has been submitted successfully.`} />
        <StatusBanner tone="success" message="Submission complete" />
        <PrimaryActionButton label={returnLabel} onPress={() => returnToParentOrReplace(returnPath as never)} />
        {returnPath === '/home'
          ? <SecondaryButton label="View Forms" onPress={() => returnToParentOrReplace('/forms')} />
          : <SecondaryButton label="Home" onPress={() => returnToParentOrReplace('/home')} />}
      </Screen>
    );
  }

  if (!form) {
    return (
      <Screen>
        <ScreenHeader title="Form unavailable" subtitle="This form may have changed or no longer be assigned to you." />
        {refreshing ? <StatusBanner tone="info" message="Refreshing Forms..." /> : null}
        <PrimaryActionButton label="Back to Forms" onPress={() => returnToParentOrReplace('/forms')} />
      </Screen>
    );
  }

  const unsupportedRequired = hasRequiredUnsupportedField(orderedFields);

  async function finishMandatoryWorkflow(kind: MandatoryFinalizationKind) {
    const finalizationStore = kind === 'clock_in' ? pendingClockIn : pendingClockOut;
    setError(null);
    setFinalizationState('finalizing');
    const finalized = await finalizationStore.finalize();
    if (!finalized.ok) {
      submissionInProgressRef.current = false;
      setFinalizationState('failed');
      setError(finalized.error);
      return;
    }

    submissionInProgressRef.current = false;
    if (kind === 'clock_in') setClockInCompleted(true);
    else setClockOutCompleted(true);
    setFinalizationKind(null);
    setFinalizationState('idle');
    try {
      await refreshWorkContext();
    } catch {
      // Finalization succeeded; the next app refresh will reconcile clock state.
    }
  }

  async function onSubmit() {
    if (!form) return;
    const validationErrors = validateFormValues(orderedFields, values);
    setFieldErrors(validationErrors);
    setError(null);
    if (Object.keys(validationErrors).length > 0) {
      setError('Complete the highlighted fields before submitting.');
      return;
    }
    if (unsupportedRequired) {
      setError('This form has a required field that this mobile Forms version cannot complete.');
      return;
    }

    submissionInProgressRef.current = true;
    const clientSubmissionId = mandatoryKind && params.workflowRequirementId
      ? await mandatoryStore.submissionIdFor(params.workflowRequirementId)
      : clientSubmissionRef.current?.value ?? createFormClientSubmissionId();
    const payload = {
      clientSubmissionId,
      formId: form.id,
      trigger: form.trigger,
      jobId: form.context?.jobId,
      equipmentId: form.context?.equipmentId,
      divisionId: form.context?.divisionId,
      ...(mandatoryKind && params.workflowOccurrenceId && params.workflowRequirementId ? {
        workflowOccurrenceId: params.workflowOccurrenceId,
        workflowRequirementId: params.workflowRequirementId,
      } : {}),
      responses: buildFormResponses(orderedFields, values),
    };
    if (mandatoryKind && !await isOnline()) {
      await mandatoryStore.queueSubmission(payload);
      submittedRef.current = true;
      setQueuedOffline(true);
      return;
    }
    if (mandatoryKind && queuedMandatorySubmission) {
      await mandatoryStore.queueSubmission(payload);
    }
    const result = await submitForm(payload);
    if (!result.ok) {
      const resultCode = 'code' in result ? result.code : undefined;
      if (mandatoryKind && resultCode === 'workflow_requirement_already_completed') {
        // Continue through authoritative workflow recovery below.
      } else {
        if (mandatoryKind && resultCode === 'workflow_context_mismatch') {
          await mandatoryStore.recover();
        }
        submissionInProgressRef.current = false;
        setError(result.error ?? 'Could not submit this form. Your answers are still here.');
        if ('fieldErrors' in result && result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
    }

    if (mandatoryKind) {
      await mandatoryStore.completeQueuedSubmission?.(clientSubmissionId);
      submittedRef.current = true;
      setMandatorySubmissionAccepted(true);
      const refreshedClockIn = mandatoryKind === 'clock_in'
        ? await pendingClockIn.refreshAfterSubmission()
        : null;
      const refreshedClockOut = mandatoryKind === 'clock_out'
        ? await pendingClockOut.refreshAfterSubmission()
        : null;
      const nextClockInRequirement = refreshedClockIn?.remainingForms[0] ?? null;
      const nextClockOutRequirement = mandatoryKind === 'clock_out'
        ? workflowRequirements(refreshedClockOut).find((item) => !item.completed) ?? null
        : null;
      const nextRequirement = nextClockInRequirement ?? nextClockOutRequirement;
      if (nextRequirement) {
        const nextForm = mandatoryKind === 'clock_in'
          ? pendingClockInRequirementForm(nextClockInRequirement)
          : requirementForm(nextClockOutRequirement);
        if (!nextForm) {
          submissionInProgressRef.current = false;
          setError('The next required form is unavailable. Reconnect and try again.');
          return;
        }
        submittedRef.current = true;
        submissionInProgressRef.current = false;
        router.replace({
          pathname: '/form',
          params: {
            formId: nextForm.id,
            trigger: mandatoryKind === 'clock_in' ? 'before_clock_in' : 'after_clock_out',
            workflowOccurrenceId: refreshedClockIn?.workflowOccurrenceId ?? refreshedClockOut?.workflowOccurrenceId,
            workflowRequirementId: mandatoryKind === 'clock_in'
              ? nextClockInRequirement?.requirementId
              : nextClockOutRequirement?.workflowRequirementId,
          },
        });
        return;
      }
      setFinalizationKind(mandatoryKind);
      await finishMandatoryWorkflow(mandatoryKind);
      return;
    }

    if (!result.ok) {
      submissionInProgressRef.current = false;
      setError(result.error ?? 'Could not submit this form. Your answers are still here.');
      if ('fieldErrors' in result && result.fieldErrors) setFieldErrors(result.fieldErrors);
      return;
    }

    submittedRef.current = true;
    submissionInProgressRef.current = false;
    if (workflow && workflow.id === params.workflowId) {
      completeCurrentForm(workflow.id);
      router.back();
      return;
    }
    setSubmittedFormName(form.name);
  }

  return (
    <Screen testID="employee-form-scroll">
      <ScreenHeader
        title={form.name}
        subtitle={form.description}
        action={form.completionRequirement === 'required' || form.required
          ? <StatusBadge label="Required" tone="active" />
          : undefined}
      />
      <FormContextSummary context={form.context} />
      {orderedFields.map((field) => (
        <FormFieldRenderer
          key={field.id}
          field={field}
          value={values[field.id] ?? ''}
          error={fieldErrors[field.id]}
          disabled={submitting || mandatorySubmissionAccepted}
          onChange={(value) => {
            setValues((current) => ({ ...current, [field.id]: value }));
            if (submissionFailure?.fieldId === field.id) setError(null);
            setFieldErrors((current) => {
              if (!current[field.id]) return current;
              const next = { ...current };
              delete next[field.id];
              return next;
            });
          }}
        />
      ))}
      {unsupportedRequired ? <StatusBanner tone="info" message="A required field needs a newer mobile Forms version. This form cannot be submitted here yet." /> : null}
      {error ? <StatusBanner tone="error" message={error} /> : null}
      <PrimaryActionButton
        label={mandatorySubmissionAccepted
          ? (finalizationState === 'failed' && finalizationKind
              ? `Retry Finish Clock ${finalizationKind === 'clock_in' ? 'In' : 'Out'}`
              : 'Finishing...')
          : submitting
            ? 'Submitting...'
            : error
              ? 'Retry Submit'
              : 'Submit Form'}
        disabled={submitting || Boolean(mandatorySubmissionAccepted && finalizationState !== 'failed') || unsupportedRequired}
        onPress={() => {
          if (finalizationState === 'failed' && finalizationKind) void finishMandatoryWorkflow(finalizationKind);
          else void onSubmit();
        }}
      />
      <Text style={styles.requiredHint}>* Required field</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  requiredHint: { color: colors.textMuted, fontSize: typography.caption, marginTop: spacing.xs },
});