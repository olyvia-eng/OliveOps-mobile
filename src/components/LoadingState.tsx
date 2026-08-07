import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FFFFFF" />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
