import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme/colors';

export function ScreenHeader({ title, eyebrow, subtitle, action }: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={styles.screenTitle}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function SectionCard({ children, selected = false, testID }: PropsWithChildren<{
  selected?: boolean;
  testID?: string;
}>) {
  return <View testID={testID} style={[styles.sectionCard, selected && styles.sectionCardSelected]}>{children}</View>;
}

export function InfoRow({ label, value, emphasis = false }: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, emphasis && styles.infoValueEmphasis]}>{value}</Text>
    </View>
  );
}

export function SegmentedControl<T extends string>({ options, value, onChange, testIDPrefix = 'segment' }: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  testIDPrefix?: string;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.segmentedControl}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            testID={`${testIDPrefix}-${option.value}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.segment, selected && styles.segmentSelected, pressed && styles.pressed]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ActionCard({ children, onPress, selected = false, accessibilityLabel, testID }: PropsWithChildren<{
  onPress?: () => void;
  selected?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}>) {
  const content = (
    <View style={[styles.actionCard, selected && styles.actionCardSelected]}>
      {children}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {content}
    </Pressable>
  );
}

export function ListRow({ title, subtitle, detail, leading, selected = false, onPress, testID }: {
  title: string;
  subtitle?: string;
  detail?: string;
  leading?: ReactNode;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected } : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, selected && styles.listRowSelected, pressed && styles.pressed]}
    >
      {leading}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      {onPress ? <Text style={[styles.chevron, selected && styles.selectedMark]}>{selected ? '✓' : '›'}</Text> : null}
    </Pressable>
  );
}

export function StatusBadge({ label, tone = 'neutral' }: {
  label: string;
  tone?: 'neutral' | 'active' | 'success' | 'error';
}) {
  return (
    <View style={[styles.badge, badgeTone[tone]]}>
      <Text style={[styles.badgeText, badgeTextTone[tone]]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  headerText: { flex: 1, gap: spacing.xs },
  eyebrow: { color: colors.primary, fontSize: typography.caption, fontWeight: typography.bold, textTransform: 'uppercase' },
  screenTitle: { color: colors.textPrimary, fontSize: typography.screenTitle, fontWeight: typography.bold },
  subtitle: { color: colors.textSecondary, fontSize: typography.bodySmall, lineHeight: 20 },
  sectionHeader: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.title, fontWeight: typography.bold },
  sectionCard: { borderRadius: radii.lg, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.sm },
  sectionCardSelected: { borderColor: colors.primary, backgroundColor: colors.oliveTint },
  infoRow: { minHeight: 32, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.lg },
  infoLabel: { flex: 1, color: colors.textSecondary, fontSize: typography.bodySmall },
  infoValue: { flex: 2, color: colors.textPrimary, fontSize: typography.bodySmall, fontWeight: typography.medium, textAlign: 'right' },
  infoValueEmphasis: { fontWeight: typography.bold },
  segmentedControl: { flexDirection: 'row', borderRadius: radii.md, backgroundColor: colors.surfaceMuted, padding: 3 },
  segment: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radii.sm, paddingHorizontal: spacing.sm },
  segmentSelected: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder },
  segmentText: { color: colors.textSecondary, fontSize: typography.bodySmall, fontWeight: typography.semibold, textAlign: 'center' },
  segmentTextSelected: { color: colors.primary, fontWeight: typography.bold },
  actionCard: { borderRadius: radii.lg, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.sm },
  actionCardSelected: { borderColor: colors.primary, backgroundColor: colors.oliveTint },
  pressed: { opacity: 0.72 },
  listRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  listRowSelected: { paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.primary, borderRadius: radii.md, backgroundColor: colors.oliveTint },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: colors.textPrimary, fontSize: typography.body, fontWeight: typography.semibold },
  rowSubtitle: { color: colors.textSecondary, fontSize: typography.bodySmall, lineHeight: 19 },
  rowDetail: { color: colors.textSecondary, fontSize: typography.bodySmall, fontWeight: typography.medium },
  chevron: { color: colors.textMuted, fontSize: 24, fontWeight: typography.medium },
  selectedMark: { color: colors.primary, fontSize: 18, fontWeight: typography.bold },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: colors.surfaceMuted },
  badgeText: { color: colors.textSecondary, fontSize: typography.caption, fontWeight: typography.bold },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, gap: spacing.sm },
  emptyTitle: { color: colors.textPrimary, fontSize: typography.title, fontWeight: typography.bold, textAlign: 'center' },
  emptyMessage: { color: colors.textSecondary, fontSize: typography.bodySmall, lineHeight: 20, textAlign: 'center' },
});

const badgeTone = StyleSheet.create({
  neutral: { backgroundColor: colors.surfaceMuted },
  active: { backgroundColor: colors.oliveTint },
  success: { backgroundColor: colors.successBackground },
  error: { backgroundColor: colors.errorBackground },
});

const badgeTextTone = StyleSheet.create({
  neutral: { color: colors.textSecondary },
  active: { color: colors.primary },
  success: { color: colors.success },
  error: { color: colors.error },
});