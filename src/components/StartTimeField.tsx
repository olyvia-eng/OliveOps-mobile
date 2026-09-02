import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, radii, spacing, typography } from '@/theme/colors';
import { businessTimeValue } from '@/utils/businessTime';

function dateForTime(value: string | null, businessTimeZone: string) {
  const date = new Date();
  const [hour, minute] = (value ?? businessTimeValue(date, businessTimeZone)).split(':').map(Number);
  date.setHours(hour, minute, 0, 0);
  return date;
}

export function formatStartTime(value: string | null) {
  if (!value) return 'Now';
  const [hour, minute] = value.split(':').map(Number);
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

export function StartTimeField({ value, businessTimeZone, disabled, onChange }: {
  value: string | null;
  businessTimeZone: string;
  disabled?: boolean;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => dateForTime(value, businessTimeZone));

  useEffect(() => {
    if (!open) setDraft(dateForTime(value, businessTimeZone));
  }, [businessTimeZone, open, value]);

  return (
    <>
      <Pressable
        testID="clock-in-start-time"
        accessibilityRole="button"
        accessibilityLabel={`Start Time: ${formatStartTime(value)}`}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.row, pressed && !disabled ? styles.pressed : null]}
      >
        <Text style={styles.label}>Start Time</Text>
        <Text style={styles.value}>{formatStartTime(value)}  ›</Text>
      </Pressable>
      <Modal transparent animationType="slide" visible={open} onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Cancel start time selection" />
          <View style={styles.sheet}>
            <View style={styles.toolbar}>
              <Pressable accessibilityRole="button" testID="start-time-cancel" onPress={() => setOpen(false)}>
                <Text style={styles.toolbarAction}>Cancel</Text>
              </Pressable>
              <Text style={styles.title}>Start Time</Text>
              <Pressable
                accessibilityRole="button"
                testID="start-time-done"
                onPress={() => {
                  onChange(`${String(draft.getHours()).padStart(2, '0')}:${String(draft.getMinutes()).padStart(2, '0')}`);
                  setOpen(false);
                }}
              >
                <Text style={styles.toolbarAction}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              testID="start-time-picker"
              value={draft}
              mode="time"
              display="spinner"
              maximumDate={dateForTime(null, businessTimeZone)}
              minuteInterval={1}
              onChange={(_, selected) => { if (selected) setDraft(selected); }}
            />
            <Pressable
              accessibilityRole="button"
              testID="start-time-reset"
              style={styles.reset}
              onPress={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <Text style={styles.resetText}>Reset to Now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 52, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.divider, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm },
  pressed: { backgroundColor: colors.surfaceMuted },
  label: { color: colors.textPrimary, fontSize: typography.body, fontWeight: typography.semibold },
  value: { color: colors.textSecondary, fontSize: typography.body },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23, 32, 25, 0.35)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, paddingBottom: spacing.xxl },
  toolbar: { minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.divider, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.textPrimary, fontSize: typography.body, fontWeight: typography.semibold },
  toolbarAction: { color: colors.primary, fontSize: typography.body, fontWeight: typography.semibold },
  reset: { minHeight: 48, marginHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  resetText: { color: colors.textSecondary, fontSize: typography.body, fontWeight: typography.semibold },
});