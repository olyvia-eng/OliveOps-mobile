const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

// Keep test tooling and test sources out of runtime resolution for Expo/Hermes bundles.
config.resolver.blockList = [
  /.*[\\/]tests[\\/].*/,
  /.*\.test\.(ts|tsx)$/,
];

module.exports = config;
