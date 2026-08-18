import { StyleSheet, Text, View } from 'react-native';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { colors, spacing, typography } from '@/theme/colors';

export function ErrorState({
  message,
  retryLabel = 'Retry',
  onRetry,
}: {
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? <PrimaryActionButton label={retryLabel} onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.title,
    fontWeight: typography.bold,
  },
  message: {
    color: colors.textSecondary,
    fontSize: typography.bodySmall,
    textAlign: 'center',
  },
});
