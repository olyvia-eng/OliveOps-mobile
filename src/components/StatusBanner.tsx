import { StyleSheet, Text, View } from 'react-native';

export function StatusBanner({
  tone,
  message,
}: {
  tone: 'info' | 'success' | 'error' | 'offline';
  message: string;
}) {
  return (
    <View style={[styles.box, toneStyles[tone]]}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 10,
    padding: 12,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

const toneStyles = StyleSheet.create({
  info: { backgroundColor: '#1D4ED8' },
  success: { backgroundColor: '#15803D' },
  error: { backgroundColor: '#B91C1C' },
  offline: { backgroundColor: '#9A3412' },
});
