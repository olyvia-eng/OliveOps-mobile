const minimalBootEnabled = process.env.EXPO_PUBLIC_DIAGNOSTIC_MINIMAL_BOOT === 'true';

if (minimalBootEnabled) {
  const React = require('react') as typeof import('react');
  const { registerRootComponent } = require('expo') as typeof import('expo');
  const { Text, View } = require('react-native') as typeof import('react-native');

  function MinimalDiagnosticApp() {
    return React.createElement(
      View,
      {
        style: {
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          flex: 1,
          justifyContent: 'center',
          padding: 24,
        },
      },
      React.createElement(
        Text,
        { style: { color: '#111111', fontSize: 28, fontWeight: '700', marginBottom: 12 } },
        'OliveOps'
      ),
      React.createElement(
        Text,
        { style: { color: '#333333', fontSize: 16, textAlign: 'center' } },
        'Minimal diagnostic build loaded successfully.'
      )
    );
  }

  registerRootComponent(MinimalDiagnosticApp);
} else {
  require('expo-router/entry');
}
