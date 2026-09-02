import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii, typography } from '@/theme/colors';

export function PrimaryActionButton({
  label,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    backgroundColor: colors.primaryPressed,
  },
  text: {
    color: colors.primaryText,
    fontSize: typography.body,
    fontWeight: typography.bold,
  },
});
