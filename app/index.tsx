import { StyleSheet, Text, View } from 'react-native';

const diagnosticStartup = process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP === 'true';
const NormalIndexScreen = diagnosticStartup
  ? null
  : require('@/app/NormalIndexScreen').default;

export default function IndexScreen() {
  if (diagnosticStartup) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>OliveOps started successfully</Text>
      </View>
    );
  }

  return <NormalIndexScreen />;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  message: {
    color: '#111111',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
});
