const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Keep test tooling and test sources out of runtime resolution for Expo/Hermes bundles.
config.resolver.blockList = [
  /.*[\\/]vitest\.config\.ts$/,
  /.*[\\/]tests[\\/].*/,
  /.*\.test\.(ts|tsx)$/,
  /.*[\\/]node_modules[\\/]vitest[\\/].*/,
  /.*[\\/]node_modules[\\/]vite[\\/].*/,
];

module.exports = config;
