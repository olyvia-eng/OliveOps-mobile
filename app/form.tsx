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
import { createRequestMeta } from '@/services/requestGuards';
import { useAuthStore } from '@/store/authStore';
import { useFormsStore } from '@/store/formsStore';
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
  const params = useLocalSearchParams<{ list?: string; formId?: string; trigger?: string; jobId?: string; equipmentId?: string; divisionId?: string; returnTo?: string }>();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { toDo, available } = useFormsStore();
  const { refreshForms, submitForm, submitting } = useFormsActions();
  const candidates = params.list === 'available' ? available : toDo;
  const matchedForm = useMemo(() => candidates.find((item) => matchesParams(item, params)) ?? null, [candidates, params]);
  const formSnapshotRef = useRef<EmployeeForm | null>(null);
  const submissionInProgressRef = useRef(false);
  if (matchedForm) formSnapshotRef.current = matchedForm;
  const form = matchedForm ?? (submissionInProgressRef.current ? formSnapshotRef.current : null);
  const initialValues = useMemo(() => initialFormValues(form?.fields ?? []), [form]);
  const [values, setValues] = useState<EmployeeFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<EmployeeFormFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [submittedFormName, setSubmittedFormName] = useState<string | null>(null);
  const submittedRef = useRef(false);
  const clientSubmissionRef = useRef<{ identity: string; value: string } | null>(null);
  const refreshedMissingRef = useRef(false);
  const submissionIdentity = form && user
    ? `${user.businessId}:${user.id}:${user.employeeId ?? ''}:${form.id}:${form.trigger}:${form.context?.jobId ?? ''}:${form.context?.equipmentId ?? ''}:${form.context?.divisionId ?? ''}`
    : '';

  if (submissionIdentity && clientSubmissionRef.current?.identity !== submissionIdentity) {
    clientSubmissionRef.current = {
      identity: submissionIdentity,
      value: createRequestMeta(submissionIdentity).idempotencyKey,
    };
  }

  useEffect(() => {
    setValues(initialValues);
    setFieldErrors({});
  }, [initialValues]);

  useEffect(() => {
    if (form || refreshedMissingRef.current) return;
    refreshedMissingRef.current = true;
    setRefreshing(true);
    void refreshForms({ force: true }).finally(() => setRefreshing(false));
  }, [form, refreshForms]);

  const dirty = JSON.stringify(values) !== JSON.stringify(initialValues);

  useEffect(() => navigation.addListener('beforeRemove', (event: { preventDefault: () => void; data: { action: unknown } }) => {
    if (!dirty || submittedRef.current) return;
    event.preventDefault();
    Alert.alert('Discard changes?', 'Your answers have not been submitted.', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(event.data.action as never) },
    ]);
  }), [dirty, navigation]);

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
    const result = await submitForm({
      clientSubmissionId: clientSubmissionRef.current?.value ?? createRequestMeta(submissionIdentity).idempotencyKey,
      formId: form.id,
      trigger: form.trigger,
      jobId: form.context?.jobId,
      equipmentId: form.context?.equipmentId,
      divisionId: form.context?.divisionId,
      responses: buildFormResponses(orderedFields, values),
    });
    if (!result.ok) {
      submissionInProgressRef.current = false;
      setError(result.error ?? 'Could not submit this form. Your answers are still here.');
      if ('fieldErrors' in result && result.fieldErrors) setFieldErrors(result.fieldErrors);
      return;
    }

    submittedRef.current = true;
  submissionInProgressRef.current = false;
  setSubmittedFormName(form.name);
  }

  return (
    <Screen testID="employee-form-scroll">
      <ScreenHeader title={form.name} subtitle={form.description} action={form.required ? <StatusBadge label="Required" tone="active" /> : undefined} />
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