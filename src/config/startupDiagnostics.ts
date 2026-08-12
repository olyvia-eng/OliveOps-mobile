// Temporary TestFlight isolation flag. Remove after the startup crash is identified.
export const DIAGNOSTIC_SKIP_SESSION_BOOTSTRAP =
  process.env.EXPO_PUBLIC_DIAGNOSTIC_SKIP_SESSION_BOOTSTRAP === 'true';