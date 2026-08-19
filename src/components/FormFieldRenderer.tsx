import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, radii, spacing, typography } from '@/theme/colors';
import type { EmployeeFormField } from '@/types/forms';
import {
  dateFromCanonicalValue,
  formatFormDate,
  localCalendarDate,
  UNSUPPORTED_FIELD_TYPES,
} from '@/features/forms/formValidation';

export function FormFieldRenderer({
  field,
  value,
  error,
  disabled = false,
  onChange,
}: {
  field: EmployeeFormField;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);

  function onDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS !== 'ios') setShowDatePicker(false);
    if (event.type === 'dismissed' || !selectedDate) return;
    onChange(localCalendarDate(selectedDate));
  }

  if (field.type === 'section_header') {
    return <Text accessibilityRole="header" style={styles.sectionHeader}>{field.label}</Text>;
  }
  if (field.type === 'paragraph_text') {
    return (
      <View style={styles.field}>
        <Text style={styles.paragraph}>{field.label}</Text>
        {field.helpText ? <Text style={styles.help}>{field.helpText}</Text> : null}
      </View>
    );
  }
  if (UNSUPPORTED_FIELD_TYPES.has(field.type)) {
    return (
      <View style={styles.unsupported}>
        <Text style={styles.label}>{field.label}{field.required ? ' *' : ''}</Text>
        <Text style={styles.unsupportedText}>This field requires a newer mobile Forms version.</Text>
      </View>
    );
  }

  const options = ['checkbox', 'multiple_choice', 'dropdown'].includes(field.type)
    ? (field.options ?? []).map((option) => ({ value: option, label: option }))
    : ['employee_selector', 'job_selector', 'customer_selector'].includes(field.type)
      ? (field.choices ?? [])
      : field.type === 'yes_no'
        ? [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]
        : null;

  return (
    <View style={styles.field}>
      <Text nativeID={`form-label-${field.id}`} style={styles.label}>{field.label}{field.required ? ' *' : ''}</Text>
      {field.helpText ? <Text style={styles.help}>{field.helpText}</Text> : null}
      {field.type === 'date' ? (
        <>
          <Pressable
            testID={`form-field-${field.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${field.label}: ${formatFormDate(value)}`}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => setShowDatePicker(true)}
            style={[styles.dateButton, error && styles.inputError]}
          >
            <Text style={styles.dateValue}>{formatFormDate(value)}</Text>
            <Text accessibilityElementsHidden style={styles.calendarIcon}>▦</Text>
          </Pressable>
          {showDatePicker ? (
            <View style={styles.datePicker}>
              <DateTimePicker
                testID={`form-field-${field.id}-picker`}
                value={dateFromCanonicalValue(value) ?? new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={onDateChange}
              />
              {Platform.OS === 'ios' ? (
                <Pressable accessibilityRole="button" onPress={() => setShowDatePicker(false)} style={styles.dateDone}>
                  <Text style={styles.dateDoneText}>Done</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </>
      ) : options ? (
        <View accessibilityLabel={field.label} style={field.type === 'yes_no' ? styles.segmented : styles.options}>
          {options.map((option) => {
            const selected = value === option.value;
            return (
              <Pressable
                key={option.value}
                testID={`form-field-${field.id}-option-${option.value}`}
                accessibilityRole={field.type === 'checkbox' ? 'checkbox' : 'radio'}
                accessibilityLabel={`${field.label}: ${option.label}`}
                accessibilityState={field.type === 'checkbox' ? { checked: selected, disabled } : { selected, disabled }}
                disabled={disabled}
                onPress={() => onChange(option.value)}
                style={[styles.option, field.type === 'yes_no' && styles.segment, selected && styles.optionSelected]}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{selected ? '✓ ' : ''}{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <TextInput
          testID={`form-field-${field.id}`}
          accessibilityLabel={field.label}
          accessibilityLabelledBy={`form-label-${field.id}`}
          editable={!disabled}
          value={value}
          onChangeText={onChange}
          placeholder={field.placeholder || (field.type === 'time' ? 'HH:MM' : undefined)}
          placeholderTextColor={colors.inputPlaceholder}
          keyboardType={field.type === 'number' || field.type === 'currency' ? 'decimal-pad' : 'default'}
          multiline={field.type === 'multi_line_text'}
          maxLength={field.type === 'single_line_text' ? 500 : field.type === 'multi_line_text' ? 10_000 : undefined}
          style={[styles.input, field.type === 'multi_line_text' && styles.multiline, error && styles.inputError]}
        />
      )}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { color: colors.textPrimary, fontSize: typography.body, fontWeight: typography.semibold },
  help: { color: colors.textSecondary, fontSize: typography.bodySmall, lineHeight: 20 },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface, color: colors.textPrimary, fontSize: typography.body, paddingHorizontal: spacing.md },
  multiline: { minHeight: 120, paddingTop: spacing.md, textAlignVertical: 'top' },
  inputError: { borderColor: colors.error },
  dateButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  dateValue: { color: colors.textPrimary, fontSize: typography.body, fontWeight: typography.medium },
  calendarIcon: { color: colors.primary, fontSize: 22 },
  datePicker: { gap: spacing.sm, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radii.md, backgroundColor: colors.surface, padding: spacing.sm },
  dateDone: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dateDoneText: { color: colors.primary, fontSize: typography.body, fontWeight: typography.bold },
  error: { color: colors.error, fontSize: typography.bodySmall, fontWeight: typography.semibold },
  options: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radii.lg, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  option: { minHeight: 50, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider, paddingHorizontal: spacing.sm },
  optionSelected: { borderWidth: 1, borderColor: colors.primary, borderRadius: radii.md, backgroundColor: colors.oliveTint },
  optionText: { color: colors.textPrimary, fontSize: typography.body, fontWeight: typography.medium },
  optionTextSelected: { color: colors.primary, fontWeight: typography.bold },
  segmented: { flexDirection: 'row', gap: spacing.sm },
  segment: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radii.md },
  sectionHeader: { color: colors.textPrimary, fontSize: typography.title, fontWeight: typography.bold, marginTop: spacing.sm },
  paragraph: { color: colors.textSecondary, fontSize: typography.body, lineHeight: 23 },
  unsupported: { gap: spacing.xs, borderWidth: 1, borderColor: colors.infoBorder, borderRadius: radii.md, backgroundColor: colors.infoBackground, padding: spacing.md },
  unsupportedText: { color: colors.info, fontSize: typography.bodySmall, lineHeight: 20 },
});