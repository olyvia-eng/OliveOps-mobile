import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme/colors';

export function StatusBanner({
  tone,
  message,
}: {
  tone: 'info' | 'success' | 'error' | 'offline';
  message: string;
}) {
  return (
    <View style={[styles.box, toneStyles[tone]]}>
      <Text style={[styles.text, toneTextStyles[tone]]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
  },
  text: {
    fontSize: typography.bodySmall,
    fontWeight: typography.medium,
    lineHeight: 20,
    color: colors.textPrimary,
  },
});

const toneStyles = StyleSheet.create({
  info: { backgroundColor: colors.infoBackground, borderColor: colors.infoBorder },
  success: { backgroundColor: colors.successBackground, borderColor: colors.successBorder },
  error: { backgroundColor: colors.errorBackground, borderColor: colors.errorBorder },
  offline: { backgroundColor: colors.offlineBackground, borderColor: colors.offlineBorder },
});

const toneTextStyles = StyleSheet.create({
  info: { color: colors.info },
  success: { color: colors.success },
  error: { color: colors.error },
  offline: { color: colors.offline },
});
