import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { ScreenHeader } from '@/components/MobilePrimitives';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { TimeOffDateField } from '@/components/TimeOffDateField';
import { validateTimeOffDraft, type TimeOffDraftErrors } from '@/features/timeOff/model';
import { getTimeOffTypeLabel } from '@/features/timeOff/presentation';
import { useTimeOffActions } from '@/hooks/useTimeOffActions';
import { useTimeOffStore } from '@/store/timeOffStore';
import { colors, radii, spacing, typography } from '@/theme/colors';
import type { TimeOffRequestType } from '@/types/timeOff';

const requestTypes: TimeOffRequestType[] = ['vacation', 'sick', 'personal', 'unpaid', 'other'];

export default function RequestTimeOffScreen() {
  const { draft, setDraft, submissionAttempt } = useTimeOffStore();
  const { create, submitting } = useTimeOffActions();
  const [errors, setErrors] = useState<TimeOffDraftErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function update<K extends keyof typeof draft>(key: K, value: typeof draft[K]) {
    setDraft({ ...draft, [key]: value });
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSubmitError(null);
  }

  async function submit() {
    const nextErrors = validateTimeOffDraft(draft);
    setErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;
    const result = await create(draft);
    if (!result.ok) {
      setSubmitError(result.error ?? 'Could not submit this time-off request.');
      return;
    }
    setSubmitted(true);
    router.replace('/time-off');
  }

  return (
    <Screen testID="request-time-off-screen">
      <ScreenHeader title="Request Time Off" subtitle="Full-day requests use inclusive calendar dates" />

      <View style={styles.field}>
        <Text style={styles.label}>Request Type *</Text>
        <View style={styles.options} accessibilityRole="radiogroup">
          {requestTypes.map((type) => {
            const selected = draft.requestType === type;
            return (
              <Pressable
                key={type}
                testID={`time-off-type-${type}`}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: submitting || submitted }}
                disabled={submitting || submitted}
                onPress={() => update('requestType', type)}
                style={[styles.option, selected ? styles.optionSelected : null]}
              >
                <Text style={[styles.optionText, selected ? styles.optionTextSelected : null]}>
                  {selected ? '✓ ' : ''}{getTimeOffTypeLabel(type)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <TimeOffDateField
        label="Start Date"
        value={draft.startDate}
        error={errors.startDate}
        disabled={submitting || submitted}
        testID="time-off-start-date"
        onChange={(value) => update('startDate', value)}
      />
      <TimeOffDateField
        label="End Date"
        value={draft.endDate}
        error={errors.endDate}
        disabled={submitting || submitted}
        testID="time-off-end-date"
        onChange={(value) => update('endDate', value)}
      />

      <View style={styles.field}>
        <Text style={styles.label}>Reason / Note</Text>
        <TextInput
          testID="time-off-note"
          accessibilityLabel="Reason or note"
          style={[styles.input, styles.note, errors.employeeNote ? styles.inputError : null]}
          value={draft.employeeNote}
          editable={!submitting && !submitted}
          multiline
          maxLength={2000}
          onChangeText={(value) => update('employeeNote', value)}
          placeholder="Optional"
          placeholderTextColor={colors.inputPlaceholder}
        />
        {errors.employeeNote ? <Text style={styles.error}>{errors.employeeNote}</Text> : null}
      </View>

      {submissionAttempt ? (
        <StatusBanner tone="info" message="A previous submission may be processing. Retry uses the same submission key." />
      ) : null}
      {submitError ? <StatusBanner tone="error" message={submitError} /> : null}
      {submitted ? <StatusBanner tone="success" message="Submitted" /> : null}
      <PrimaryActionButton
        label={submitted ? 'Submitted' : submitting ? 'Submitting...' : 'Submit Request'}
        disabled={submitting || submitted}
        onPress={() => { void submit(); }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { color: colors.textPrimary, fontSize: typography.bodySmall, fontWeight: typography.semibold },
  options: { gap: spacing.sm },
  option: { minHeight: 48, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: spacing.md },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.oliveTint },
  optionText: { color: colors.textPrimary, fontSize: typography.body },
  optionTextSelected: { color: colors.primary, fontWeight: typography.bold },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: spacing.md, fontSize: typography.body },
  note: { minHeight: 112, paddingTop: spacing.md, textAlignVertical: 'top' },
  inputError: { borderColor: colors.error },
  error: { color: colors.error, fontSize: typography.caption },
});
