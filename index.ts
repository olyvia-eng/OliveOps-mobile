import React from 'react';
import { registerRootComponent } from 'expo';
import { Text } from 'react-native';

function App() {
	return <Text>OliveOps Expo Root OK</Text>;
}

registerRootComponent(App);
