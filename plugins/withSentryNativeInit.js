const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');

const INFO_PLIST_DSN_KEY = 'OliveOpsSentryDSN';
const GENERATED_MARKER = 'OliveOps Sentry native initialization';

const nativeInitialization = `    // ${GENERATED_MARKER}
    if let sentryDsn = Bundle.main.object(forInfoDictionaryKey: "${INFO_PLIST_DSN_KEY}") as? String,
       !sentryDsn.isEmpty {
      SentrySDK.start { options in
        options.dsn = sentryDsn
        options.environment = "production"
        options.sampleRate = 1.0
        options.sendDefaultPii = false
        options.maxBreadcrumbs = 0
        options.enableNetworkBreadcrumbs = false
        options.enableAutoBreadcrumbTracking = false
        options.enableCrashHandler = true
        options.enableAutoSessionTracking = false
        options.enableAutoPerformanceTracing = false
        options.attachScreenshot = false
        options.attachViewHierarchy = false
      }
    }
`;

function addSentryNativeInitToAppDelegate(contents) {
  let next = contents;

  if (!/^import Sentry$/m.test(next)) {
    next = `import Sentry\n${next}`;
  }

  if (next.includes(GENERATED_MARKER)) return next;

  const launchMethod = /(didFinishLaunchingWithOptions launchOptions:[\s\S]*?\)\s*->\s*Bool\s*\{\n)/;
  if (!launchMethod.test(next)) {
    throw new Error('Could not find the iOS AppDelegate launch method for Sentry native initialization.');
  }

  return next.replace(launchMethod, `$1${nativeInitialization}`);
}

function withSentryNativeInit(config) {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

  config = withInfoPlist(config, nextConfig => {
    if (dsn) {
      nextConfig.modResults[INFO_PLIST_DSN_KEY] = dsn;
    } else {
      delete nextConfig.modResults[INFO_PLIST_DSN_KEY];
    }
    return nextConfig;
  });

  return withAppDelegate(config, nextConfig => {
    if (nextConfig.modResults.language !== 'swift') {
      throw new Error('Sentry native initialization requires the Expo Swift AppDelegate.');
    }

    nextConfig.modResults.contents = addSentryNativeInitToAppDelegate(
      nextConfig.modResults.contents
    );
    return nextConfig;
  });
}

module.exports = withSentryNativeInit;
module.exports.addSentryNativeInitToAppDelegate = addSentryNativeInitToAppDelegate;
module.exports.INFO_PLIST_DSN_KEY = INFO_PLIST_DSN_KEY;