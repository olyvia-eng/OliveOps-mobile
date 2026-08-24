import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { dateFromCanonicalValue, formatFormDate, localCalendarDate } from '@/features/forms/formValidation';
import { colors, radii, spacing, typography } from '@/theme/colors';

export function TimeOffDateField({ label, value, error, disabled, testID, onChange }: {
  label: string;
  value: string;
  error?: string;
  disabled?: boolean;
  testID: string;
  onChange: (value: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  function changeDate(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS !== 'ios') setShowPicker(false);
    if (event.type === 'dismissed' || !selected) return;
    onChange(localCalendarDate(selected));
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label} *</Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatFormDate(value)}`}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={() => setShowPicker(true)}
        style={[styles.button, error ? styles.errorBorder : null]}
      >
        <Text style={styles.value}>{formatFormDate(value)}</Text>
        <Text accessibilityElementsHidden style={styles.icon}>▦</Text>
      </Pressable>
      {showPicker ? (
        <View style={styles.picker}>
          <DateTimePicker
            testID={`${testID}-picker`}
            value={dateFromCanonicalValue(value) ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={changeDate}
          />
          {Platform.OS === 'ios' ? (
            <Pressable accessibilityRole="button" onPress={() => setShowPicker(false)} style={styles.done}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { color: colors.textPrimary, fontSize: typography.bodySmall, fontWeight: typography.semibold },
  button: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  value: { color: colors.textPrimary, fontSize: typography.body },
  icon: { color: colors.primary, fontSize: 20 },
  picker: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface, overflow: 'hidden' },
  done: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: colors.divider },
  doneText: { color: colors.primary, fontWeight: typography.bold },
  errorBorder: { borderColor: colors.error },
  error: { color: colors.error, fontSize: typography.caption },
});