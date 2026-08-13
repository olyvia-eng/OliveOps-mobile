import { describe, expect, it } from '@jest/globals';

const {
  addSentryNativeInitToAppDelegate,
} = require('../../plugins/withSentryNativeInit') as {
  addSentryNativeInitToAppDelegate: (contents: string) => string;
};

const appDelegate = `internal import Expo
import React

@main
class AppDelegate: ExpoAppDelegate {
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

describe('Sentry native initialization config plugin', () => {
  it('starts Sentry before React Native startup and remains idempotent', () => {
    const transformed = addSentryNativeInitToAppDelegate(appDelegate);
    const transformedAgain = addSentryNativeInitToAppDelegate(transformed);

    expect(transformed).toContain('import Sentry');
    expect(transformed).toContain('SentrySDK.start');
    expect(transformed).toContain('options.sendDefaultPii = false');
    expect(transformed).toContain('options.maxBreadcrumbs = 0');
    expect(transformed).toContain('options.enableCrashHandler = true');
    expect(transformed.indexOf('SentrySDK.start')).toBeLessThan(
      transformed.indexOf('ReactNativeDelegate()')
    );
    expect(transformedAgain).toBe(transformed);
  });
});