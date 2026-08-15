import { Text, View } from 'react-native';

const diagnosticStartup = process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP === 'true';
const NormalIndexScreen = diagnosticStartup
  ? null
  : require('@/normalApp/NormalIndexScreen').default;

export default function IndexScreen() {
  if (diagnosticStartup) {
    return (
      <View>
        <Text>OliveOps Router OK</Text>
      </View>
    );
  }

  return <NormalIndexScreen />;
}
