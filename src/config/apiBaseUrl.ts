function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '');
}

function isLocalhostHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export type ApiBaseUrlOptions = {
  isPhysicalDevice: boolean;
  allowLocalhostOnDevice: boolean;
};

export function resolveApiBaseUrl(rawValue: string | undefined, options: ApiBaseUrlOptions): string {
  const normalizedRaw = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!normalizedRaw) {
    throw new Error('Missing EXPO_PUBLIC_API_BASE_URL. Set it in your environment before launching the app.');
  }

  let parsed: URL;
  try {
    parsed = new URL(normalizedRaw);
  } catch {
    throw new Error(`Invalid EXPO_PUBLIC_API_BASE_URL: ${normalizedRaw}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must use http or https.');
  }

  if (options.isPhysicalDevice && !options.allowLocalhostOnDevice && isLocalhostHost(parsed.hostname)) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL cannot use localhost on a physical device. Use your LAN IP or hosted backend URL.'
    );
  }

  return trimTrailingSlashes(parsed.toString());
}
