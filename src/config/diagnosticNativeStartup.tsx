import React from 'react';
import { AppRegistry, Text, View } from 'react-native';

export function DiagnosticNativeStartup() {
  return (
    <View>
      <Text>OliveOps native startup OK</Text>
    </View>
  );
}

AppRegistry.registerComponent('main', () => DiagnosticNativeStartup);