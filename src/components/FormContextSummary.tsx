import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/colors';
import type { EmployeeFormContext } from '@/types/forms';

export function FormContextSummary({ context }: { context?: EmployeeFormContext }) {
  const rows = [
    context?.jobName ? { label: 'Job', value: context.jobName } : null,
    context?.equipmentName ? { label: 'Equipment', value: context.equipmentName } : null,
    context?.divisionName ? { label: 'Division', value: context.divisionName } : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row));

  if (rows.length === 0) return null;

  return (
    <View style={styles.container}>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  row: { gap: 2 },
  label: { color: colors.textMuted, fontSize: typography.caption, fontWeight: typography.bold, textTransform: 'uppercase' },
  value: { color: colors.textPrimary, fontSize: typography.body, fontWeight: typography.semibold },
});