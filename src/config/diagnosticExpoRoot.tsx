import React from 'react';
import { registerRootComponent } from 'expo';
import { Text, View } from 'react-native';

export function DiagnosticExpoRoot() {
  return (
    <View>
      <Text>OliveOps Router OK</Text>
    </View>
  );
}

registerRootComponent(DiagnosticExpoRoot);