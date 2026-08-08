import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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
      <Text style={styles.sectionLabel}>Category</Text>

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
        <View style={styles.optionList}>
          {categories.map((category) => {
            const selected = selectedCategoryId === category.id;
            return (
              <Pressable
                key={category.id}
                testID={`unbillable-category-option-${category.id}`}
                accessibilityRole="button"
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => onSelect(category.id)}
              >
                <Text style={styles.optionLabel}>{category.name}</Text>
                <View style={[styles.checkDot, selected && styles.checkDotSelected]}>
                  {selected ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 4,
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
    minHeight: 42,
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
  optionList: {
    gap: 10,
  },
  option: {
    minHeight: 54,
    borderRadius: 12,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.inputFocusBackground,
  },
  optionLabel: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  checkDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkDotSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkMark: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
});
