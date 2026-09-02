import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ListRow, SectionCard, SectionHeader } from '@/components/MobilePrimitives';
import { StatusBanner } from '@/components/StatusBanner';
import { colors } from '@/theme/colors';
import type { UnbillableCategory } from '@/types/domain';

type UnbillableCategorySelectorProps = {
  categories: UnbillableCategory[];
  selectedCategoryId: string;
  loading: boolean;
  error: string | null;
  onSelect: (categoryId: string) => void;
  onRetry: () => void;
};

export function UnbillableCategorySelector({
  categories,
  selectedCategoryId,
  loading,
  error,
  onSelect,
  onRetry,
}: UnbillableCategorySelectorProps) {
  return (
    <View style={styles.section}>
      <SectionHeader title="Category" />

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading categories...</Text>
        </View>
      ) : null}

      {!loading && error ? (
        <View style={styles.errorBlock}>
          <StatusBanner tone="error" message="Could not load unbillable categories." />
          <Pressable testID="unbillable-category-retry" accessibilityRole="button" style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && categories.length === 0 ? (
        <StatusBanner
          tone="info"
          message="No unbillable categories are currently available. Ask your administrator to configure them in OliveOps."
        />
      ) : null}

      {!loading && !error && categories.length > 0 ? (
        <SectionCard>
          {categories.map((category) => (
            <ListRow
              key={category.id}
              testID={`unbillable-category-option-${category.id}`}
              title={category.name}
              selected={selectedCategoryId === category.id}
              onPress={() => onSelect(category.id)}
            />
          ))}
        </SectionCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  errorBlock: {
    gap: 8,
  },
  retryButton: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  retryButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
