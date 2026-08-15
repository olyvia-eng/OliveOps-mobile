if (process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP === 'true') {
	require('./src/config/diagnosticNativeStartup');
} else {
	require('./src/config/sentry').initializeSentry();
	require('expo-router/entry');
}
