import { StyleSheet, Text, View } from 'react-native';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';

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
    gap: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  message: {
    color: '#E2E8F0',
    fontSize: 16,
  },
});
