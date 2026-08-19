import { StyleSheet, Text, View } from 'react-native';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { getFormTriggerLabel } from '@/features/forms/formPresentation';
import { colors, spacing, typography } from '@/theme/colors';
import type { EmployeeForm } from '@/types/forms';

export function AdvisoryFormsPrompt({
  forms,
  heading,
  message,
  completeLabel = 'Complete Form',
  skipLabel,
  onComplete,
  onSkip,
  completedCount = 0,
  totalCount = forms.length,
  cancelLabel,
  onCancel,
}: {
  forms: EmployeeForm[];
  heading: string;
  message?: string;
  completeLabel?: string;
  skipLabel: string;
  onComplete: (form: EmployeeForm) => void;
  onSkip: () => void;
  completedCount?: number;
  totalCount?: number;
  cancelLabel?: string;
  onCancel?: () => void;
}) {
  const first = forms[0];
  if (!first) return null;

  return (
    <View style={styles.container} accessibilityRole="summary">
      <Text style={styles.heading}>{heading}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {completedCount > 0 ? <Text style={styles.progress}>{`✓ ${completedCount} of ${totalCount} completed`}</Text> : null}
      <View style={styles.formsList}>
        {forms.map((form) => (
          <View key={`${form.id}:${form.trigger}:${form.context?.jobId ?? ''}:${form.context?.equipmentId ?? ''}:${form.context?.divisionId ?? ''}`} style={styles.formSummary}>
            <View style={styles.formTitleRow}>
              <Text style={styles.pendingMark}>○</Text>
              <Text style={styles.formName}>{form.name}</Text>
            </View>
            {form.description ? <Text style={styles.description}>{form.description}</Text> : null}
            {form.category ? <Text style={styles.category}>{form.category}</Text> : null}
            <Text style={styles.reason}>{getFormTriggerLabel(form.trigger)}</Text>
          </View>
        ))}
      </View>
      <PrimaryActionButton label={completeLabel} onPress={() => onComplete(first)} />
      <SecondaryButton label={skipLabel} onPress={onSkip} />
      {cancelLabel && onCancel ? <SecondaryButton label={cancelLabel} onPress={onCancel} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md },
  heading: { color: colors.textPrimary, fontSize: typography.title, fontWeight: typography.bold },
  message: { color: colors.textSecondary, fontSize: typography.bodySmall, lineHeight: 20 },
  formsList: { gap: spacing.xs },
  formSummary: { gap: 3, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  formTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pendingMark: { color: colors.textMuted, fontSize: typography.body },
  formName: { flex: 1, color: colors.textPrimary, fontSize: typography.body, fontWeight: typography.bold },
  description: { color: colors.textSecondary, fontSize: typography.bodySmall, lineHeight: 20 },
  progress: { color: colors.success, fontSize: typography.bodySmall, fontWeight: typography.bold },
  category: { color: colors.textMuted, fontSize: typography.caption, fontWeight: typography.semibold, textTransform: 'uppercase' },
  reason: { color: colors.primary, fontSize: typography.bodySmall, fontWeight: typography.bold },
});