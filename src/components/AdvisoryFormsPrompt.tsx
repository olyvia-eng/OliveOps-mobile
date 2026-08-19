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
}: {
  forms: EmployeeForm[];
  heading: string;
  message?: string;
  completeLabel?: string;
  skipLabel: string;
  onComplete: (form: EmployeeForm) => void;
  onSkip: () => void;
}) {
  const first = forms[0];
  if (!first) return null;

  return (
    <View style={styles.container} accessibilityRole="summary">
      <Text style={styles.heading}>{heading}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <View style={styles.formSummary}>
        <Text style={styles.formName}>{first.name}</Text>
        {first.category ? <Text style={styles.category}>{first.category}</Text> : null}
        <Text style={styles.reason}>{getFormTriggerLabel(first.trigger)}</Text>
        {forms.length > 1 ? <Text style={styles.more}>{`+ ${forms.length - 1} more`}</Text> : null}
      </View>
      <PrimaryActionButton label={completeLabel} onPress={() => onComplete(first)} />
      <SecondaryButton label={skipLabel} onPress={onSkip} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md },
  heading: { color: colors.textPrimary, fontSize: typography.title, fontWeight: typography.bold },
  message: { color: colors.textSecondary, fontSize: typography.bodySmall, lineHeight: 20 },
  formSummary: { gap: 3, paddingVertical: spacing.sm },
  formName: { color: colors.textPrimary, fontSize: typography.body, fontWeight: typography.bold },
  category: { color: colors.textMuted, fontSize: typography.caption, fontWeight: typography.semibold, textTransform: 'uppercase' },
  reason: { color: colors.primary, fontSize: typography.bodySmall, fontWeight: typography.bold },
  more: { color: colors.textSecondary, fontSize: typography.bodySmall },
});