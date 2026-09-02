import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii, typography } from '@/theme/colors';

export function SecondaryButton({
  label,
  disabled,
  destructive = false,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        destructive && styles.destructiveButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.text, destructive && styles.destructiveText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  destructiveButton: {
    borderColor: colors.errorBorder,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: typography.semibold,
  },
  destructiveText: {
    color: colors.error,
  },
});