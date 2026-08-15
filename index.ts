if (process.env.EXPO_PUBLIC_DIAGNOSTIC_NATIVE_STARTUP === 'true') {
	require('expo-router/entry');
} else {
	require('./src/config/sentry').initializeSentry();
	require('expo-router/entry');
}
