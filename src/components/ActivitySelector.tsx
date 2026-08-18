import { StyleSheet, Text, View } from 'react-native';
import { ListRow, SectionHeader } from '@/components/MobilePrimitives';
import { colors, radii, spacing, typography } from '@/theme/colors';
import type { TimeEntryWorkType } from '@/types/domain';

const options: Array<{
  type: TimeEntryWorkType;
  icon: string;
  label: string;
  description: string;
}> = [
  { type: 'job', icon: '▣', label: 'Job Work', description: 'Working at a customer or job site' },
  { type: 'drive_time', icon: '→', label: 'Drive Time', description: 'Driving between jobs, shop, or site' },
  { type: 'non_billable', icon: '○', label: 'Unbillable', description: 'Shop work, meetings, training, etc.' },
];

export function ActivitySelector({
  heading,
  selectedType,
  onSelect,
  testIDPrefix = 'activity-option',
}: {
  heading: string;
  selectedType: TimeEntryWorkType | null;
  onSelect: (type: TimeEntryWorkType) => void;
  testIDPrefix?: string;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader title={heading} />
      <View style={styles.list}>
        {options.map((option) => (
          <ListRow
            key={option.type}
            testID={`${testIDPrefix}-${option.type}`}
            title={option.label}
            subtitle={option.description}
            selected={selectedType === option.type}
            onPress={() => onSelect(option.type)}
            leading={(
              <View style={[styles.icon, selectedType === option.type && styles.iconSelected]}>
                <Text style={[styles.iconText, selectedType === option.type && styles.iconTextSelected]}>{option.icon}</Text>
              </View>
            )}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  list: { borderRadius: radii.lg, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  icon: { width: 34, height: 34, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  iconSelected: { backgroundColor: colors.primary },
  iconText: { color: colors.textSecondary, fontSize: typography.body, fontWeight: typography.bold },
  iconTextSelected: { color: colors.primaryText },
});