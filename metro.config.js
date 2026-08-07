const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Keep test tooling and test sources out of runtime resolution for Expo/Hermes bundles.
config.resolver.blockList = [
  /.*[\\/]tests[\\/].*/,
  /.*\.test\.(ts|tsx)$/,
];

module.exports = config;
