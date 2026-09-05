import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { useTrainingStore } from '@/store/trainingStore';
import { colors, spacing, typography } from '@/theme/colors';

const destinations = [
  { label: 'Home', path: '/home' },
  { label: 'Time', path: '/time-history' },
  { label: 'Hub', path: '/employee-hub' },
  { label: 'More', path: '/more' },
] as const;

export function formatAttentionBadge(count: number) {
  if (count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}

export function PrimaryNavigation() {
  const pathname = usePathname();
  const { status } = useAuthStore();
  const { overdueCount, dueSoonCount } = useTrainingStore();
  const attentionCount = overdueCount + dueSoonCount;
  const badge = formatAttentionBadge(attentionCount);
  const visible = status === 'authenticated' && pathname !== '/' && pathname !== '/login';

  if (!visible) return null;

  return (
    <SafeAreaView accessibilityRole="tablist" edges={['bottom']} style={styles.navigation}>
      {destinations.map((destination) => {
        const selected = pathname === destination.path;
        const isHub = destination.label === 'Hub';
        const accessibilityLabel = isHub && attentionCount > 0
          ? `Hub, ${attentionCount} Training assignment${attentionCount === 1 ? '' : 's'} need attention`
          : destination.label;
        return (
          <Pressable
            key={destination.path}
            testID={`primary-nav-${destination.label.toLowerCase()}`}
            accessibilityRole="tab"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) router.replace(destination.path);
            }}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <View style={styles.labelRow}>
              <Text style={[styles.label, selected && styles.labelSelected]}>{destination.label}</Text>
              {isHub && badge ? (
                <View testID="hub-attention-badge" style={styles.badge}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  navigation: {
    minHeight: 64,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  item: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { color: colors.textMuted, fontSize: typography.bodySmall, fontWeight: typography.semibold },
  labelSelected: { color: colors.primary, fontWeight: typography.bold },
  badge: { minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.error },
  badgeText: { color: colors.primaryText, fontSize: 11, fontWeight: typography.bold },
  pressed: { opacity: 0.6 },
});