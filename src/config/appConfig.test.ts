import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

type ExpoConfig = {
  expo: {
    ios: {
      bundleIdentifier: string;
      supportsTablet: boolean;
      config: { usesNonExemptEncryption: boolean };
    };
    android: {
      package: string;
      icon: string;
      adaptiveIcon: {
        backgroundColor: string;
        foregroundImage: string;
      };
    };
    extra: { eas: { projectId: string } };
  };
};

const rootDir = path.resolve(__dirname, '../..');
const config = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'app.json'), 'utf8')
) as ExpoConfig;

function readPngMetadata(relativePath: string) {
  const bytes = fs.readFileSync(path.join(rootDir, relativePath));
  return {
    signature: bytes.subarray(0, 8).toString('hex'),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes.readUInt8(25),
  };
}

describe('release app config', () => {
  it('keeps production identifiers and compliance settings explicit', () => {
    expect(config.expo.ios.bundleIdentifier).toBe('ca.oliveops.app');
    expect(config.expo.android.package).toBe('ca.oliveops.mobile');
    expect(config.expo.ios).not.toHaveProperty('buildNumber');
    expect(config.expo.ios.supportsTablet).toBe(false);
    expect(config.expo.ios.config.usesNonExemptEncryption).toBe(false);
    expect(config.expo.extra.eas.projectId).toBeTruthy();
  });

  it('uses a transparent adaptive foreground over the branded background', () => {
    expect(config.expo.android.icon).toBe('./assets/icon.png');
    expect(config.expo.android.adaptiveIcon).toEqual({
      backgroundColor: '#F5EFE7',
      foregroundImage: './assets/adaptive-icon-foreground.png',
    });

    const foreground = readPngMetadata(config.expo.android.adaptiveIcon.foregroundImage);
    expect(foreground).toEqual({
      signature: '89504e470d0a1a0a',
      width: 1024,
      height: 1024,
      colorType: 6,
    });
  });
});