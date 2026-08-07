import { describe, expect, it } from '@jest/globals';
import { resolveApiBaseUrl } from '@/config/apiBaseUrl';

describe('resolveApiBaseUrl', () => {
  it('trims trailing slashes and keeps valid URL', () => {
    const result = resolveApiBaseUrl('https://app.oliveops.ca///', {
      isPhysicalDevice: false,
      allowLocalhostOnDevice: false,
    });

    expect(result).toBe('https://app.oliveops.ca');
  });

  it('throws when URL is missing', () => {
    expect(() => resolveApiBaseUrl(undefined, {
      isPhysicalDevice: false,
      allowLocalhostOnDevice: false,
    })).toThrow(/Missing EXPO_PUBLIC_API_BASE_URL/);
  });

  it('throws when URL is malformed', () => {
    expect(() => resolveApiBaseUrl('not-a-url', {
      isPhysicalDevice: false,
      allowLocalhostOnDevice: false,
    })).toThrow(/Invalid EXPO_PUBLIC_API_BASE_URL/);
  });

  it('blocks localhost on physical devices by default', () => {
    expect(() => resolveApiBaseUrl('http://localhost:3000', {
      isPhysicalDevice: true,
      allowLocalhostOnDevice: false,
    })).toThrow(/cannot use localhost on a physical device/);
  });

  it('allows localhost on physical devices when explicit override is enabled', () => {
    const result = resolveApiBaseUrl('http://localhost:3000/', {
      isPhysicalDevice: true,
      allowLocalhostOnDevice: true,
    });

    expect(result).toBe('http://localhost:3000');
  });
});
