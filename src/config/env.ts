import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { resolveApiBaseUrl } from '@/config/apiBaseUrl';

function isPhysicalDeviceRuntime() {
  return Platform.OS !== 'web' && Device.isDevice === true;
}

const allowLocalhostOnDevice = process.env.EXPO_PUBLIC_ALLOW_LOCALHOST_FOR_DEVICE === 'true';
const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? (process.env.NODE_ENV === 'test' ? 'http://localhost:3000' : undefined);

export const ENV = {
  apiBaseUrl: resolveApiBaseUrl(configuredApiBaseUrl, {
    isPhysicalDevice: isPhysicalDeviceRuntime(),
    allowLocalhostOnDevice,
  }),
  allowLocalhostOnDevice,
};
