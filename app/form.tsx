import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  requirementForm,
  usePendingClockOutStore,
  workflowRequirements,
} from '@/store/pendingClockOutStore';
import { colors, spacing, typography } from '@/theme/colors';
import type { EmployeeForm } from '@/types/forms';

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
  const pendingClockOut = usePendingClockOutStore();
  const mandatoryRequirement = params.workflowOccurrenceId === pendingClockOut.workflow?.workflowOccurrenceId
    && params.workflowRequirementId === pendingClockOut.currentRequirement?.workflowRequirementId
    ? pendingClockOut.currentRequirement
    : null;
  const mandatoryForm = requirementForm(mandatoryRequirement);
  const candidates = params.list === 'available' ? available : toDo;
  const workflowForm = params.workflowId && workflow?.id === params.workflowId
    ? workflow.forms[workflow.completedCount] ?? null
    : null;
  const matchedForm = useMemo(
    () => mandatoryForm && mandatoryForm.id === params.formId
      ? mandatoryForm
      : workflowForm && matchesParams(workflowForm, params)
      ? workflowForm
      : candidates.find((item) => matchesParams(item, params)) ?? null,
    [candidates, mandatoryForm, params, workflowForm],
  );
  const formSnapshotRef = useRef<EmployeeForm | null>(null);
  const submissionInProgressRef = useRef(false);
  if (matchedForm) formSnapshotRef.current = matchedForm;
  const form = matchedForm ?? (submissionInProgressRef.current ? formSnapshotRef.current : null);
  const initialValues = useMemo(
    () => initialFormValues(form?.fields ?? [], {}, new Date(), businessTimeZone),
    [businessTimeZone, form],
  );
  const [values, setValues] = useState<EmployeeFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<EmployeeFormFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [submittedFormName, setSubmittedFormName] = useState<string | null>(null);
  const [clockOutCompleted, setClockOutCompleted] = useState(false);
  const [queuedOffline, setQueuedOffline] = useState(false);
  const submittedRef = useRef(false);
  const initializedAttemptRef = useRef('');
  const clientSubmissionRef = useRef<{ identity: string; value: string } | null>(null);
  const refreshedMissingRef = useRef(false);
  const submissionIdentity = form && user
    ? `${user.businessId}:${user.id}:${user.employeeId ?? ''}:${form.id}:${form.trigger}:${form.context?.jobId ?? ''}:${form.context?.equipmentId ?? ''}:${form.context?.divisionId ?? ''}`
    : '';

  if (submissionIdentity && clientSubmissionRef.current?.identity !== submissionIdentity) {
    clientSubmissionRef.current = {
      identity: submissionIdentity,
      value: createFormClientSubmissionId(),
    };
  }

  useEffect(() => {
    if (!submissionIdentity || initializedAttemptRef.current === submissionIdentity) return;
    initializedAttemptRef.current = submissionIdentity;
    setValues(initialValues);
    setFieldErrors({});
  }, [initialValues, submissionIdentity]);

  useEffect(() => {
    if (form || refreshedMissingRef.current) return;
    refreshedMissingRef.current = true;
    setRefreshing(true);
    void refreshForms({ force: true }).finally(() => setRefreshing(false));
  }, [form, refreshForms]);

  const dirty = JSON.stringify(values) !== JSON.stringify(initialValues);

  useEffect(() => navigation.addListener('beforeRemove', (event: { preventDefault: () => void; data: { action: unknown } }) => {
    if (mandatoryRequirement && !submittedRef.current) {
      event.preventDefault();
      Alert.alert('Clock out pending', 'Complete this required form to finish clocking out.', [
        { text: 'Continue Form', style: 'cancel' },
      ]);
      return;
    }
    if (!dirty || submittedRef.current) return;
    event.preventDefault();
    Alert.alert('Discard changes?', 'Your answers have not been submitted.', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(event.data.action as never) },
    ]);
  }), [dirty, mandatoryRequirement, navigation]);

  if (clockOutCompleted) {
    return (
      <Screen>
        <ScreenHeader title="Clocked out" subtitle="Your required forms were submitted and your shift is complete." />
        <StatusBanner tone="success" message="Clock-out submitted successfully." />
        <PrimaryActionButton label="Done" onPress={() => router.replace('/home')} />
      </Screen>
    );
  }

  if (queuedOffline) {
    return (
      <Screen>
        <ScreenHeader title="Required form saved" subtitle="Clock out is still pending." />
        <StatusBanner tone="offline" message="Reconnect to submit this form and finish clocking out." />
        <PrimaryActionButton label="Return Home" onPress={() => router.replace('/home')} />
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
        <PrimaryActionButton label={returnLabel} onPress={() => router.replace(returnPath as never)} />
        {returnPath === '/home'
          ? <SecondaryButton label="View Forms" onPress={() => router.replace('/forms')} />
          : <SecondaryButton label="Home" onPress={() => router.replace('/home')} />}
      </Screen>
    );
  }

  if (!form) {
    return (
      <Screen>
        <ScreenHeader title="Form unavailable" subtitle="This form may have changed or no longer be assigned to you." />
        {refreshing ? <StatusBanner tone="info" message="Refreshing Forms..." /> : null}
        <PrimaryActionButton label="Back to Forms" onPress={() => router.replace('/forms')} />
      </Screen>
    );
  }

  const orderedFields = [...form.fields].sort((left, right) => left.order - right.order);
  const unsupportedRequired = hasRequiredUnsupportedField(orderedFields);

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
    const clientSubmissionId = mandatoryRequirement
      ? await pendingClockOut.submissionIdFor(mandatoryRequirement.workflowRequirementId)
      : clientSubmissionRef.current?.value ?? createFormClientSubmissionId();
    const payload = {
      clientSubmissionId,
      formId: form.id,
      trigger: form.trigger,
      jobId: form.context?.jobId,
      equipmentId: form.context?.equipmentId,
      divisionId: form.context?.divisionId,
      ...(mandatoryRequirement ? {
        workflowOccurrenceId: pendingClockOut.workflow?.workflowOccurrenceId,
        workflowRequirementId: mandatoryRequirement.workflowRequirementId,
      } : {}),
      responses: buildFormResponses(orderedFields, values),
    };
    if (mandatoryRequirement && !await isOnline()) {
      await pendingClockOut.queueSubmission(payload);
      submittedRef.current = true;
      setQueuedOffline(true);
      return;
    }
    const result = await submitForm(payload);
    if (!result.ok) {
      const resultCode = 'code' in result ? result.code : undefined;
      if (mandatoryRequirement && resultCode === 'workflow_requirement_already_completed') {
        // Continue through authoritative workflow recovery below.
      } else {
        if (mandatoryRequirement && resultCode === 'workflow_context_mismatch') {
          await pendingClockOut.recover();
        }
        submissionInProgressRef.current = false;
        setError(result.error ?? 'Could not submit this form. Your answers are still here.');
        if ('fieldErrors' in result && result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
    }

    if (mandatoryRequirement) {
      const refreshed = await pendingClockOut.refreshAfterSubmission();
      const nextRequirement = workflowRequirements(refreshed).find((item) => !item.completed);
      if (nextRequirement) {
        const nextForm = requirementForm(nextRequirement);
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
            trigger: 'after_clock_out',
            workflowOccurrenceId: refreshed?.workflowOccurrenceId,
            workflowRequirementId: nextRequirement.workflowRequirementId,
          },
        });
        return;
      }
      const finalized = await pendingClockOut.finalize();
      if (!finalized.ok) {
        submissionInProgressRef.current = false;
        setError(finalized.error);
        return;
      }
      await refreshWorkContext();
      submittedRef.current = true;
      submissionInProgressRef.current = false;
      setClockOutCompleted(true);
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
          disabled={submitting}
          onChange={(value) => {
            setValues((current) => ({ ...current, [field.id]: value }));
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
        label={submitting ? 'Submitting...' : error ? 'Retry Submit' : 'Submit Form'}
        disabled={submitting || unsupportedRequired}
        onPress={() => { void onSubmit(); }}
      />
      <Text style={styles.requiredHint}>* Required field</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  requiredHint: { color: colors.textMuted, fontSize: typography.caption, marginTop: spacing.xs },
});