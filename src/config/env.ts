import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string };

export const ENV = {
  apiBaseUrl: (extra.apiBaseUrl || '').replace(/\/$/, ''),
};

if (!ENV.apiBaseUrl) {
  console.warn('Missing expo.extra.apiBaseUrl in app.json/app config.');
}
