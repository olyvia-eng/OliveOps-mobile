# OliveOps Mobile — App Store Readiness

## Phase 1 Status

### ✅ Completed

| Item | Details |
|---|---|
| iOS `bundleIdentifier` | `ca.oliveops.mobile` |
| Android `package` | `ca.oliveops.mobile` |
| `supportsTablet` | `false` (portrait-only employee tool) |
| `usesNonExemptEncryption` | `ITSAppUsesNonExemptEncryption: false` — app uses only standard HTTPS; no custom encryption |
| `expo-image-picker` permission strings | Camera and photo-library purpose strings set in `app.json` plugins |
| Photo library permission minimization | No photo-library access requested at launch; only triggered on user action |
| Privacy Policy in Settings | Links to `https://www.oliveops.ca/privacy` |
| Terms of Service in Settings | Links to `https://www.oliveops.ca/terms` |
| Support in Settings | Links to `https://www.oliveops.ca/contact` |
| Legacy generic-login fallback | N/A — app never had a generic-login fallback; mobile-login is the sole auth path |
| Multi-select photo support | N/A — current scope is clock in/out only; no photo attachment feature exists yet |
| Orphaned photo cleanup | N/A — no photo upload flow exists yet |
| App icon / splash | Placeholder assets noted; replace before submission (see below) |
| Version / build strategy | `version: 1.0.0`, `buildNumber: 1` (iOS), `versionCode: 1` (Android); `autoIncrement: true` in production EAS profile |
| `eas.json` | `development`, `preview`, `production` profiles configured |
| Production API base URL | Centralized in `src/config/api.js`; override with `EXPO_PUBLIC_API_URL` env var |
| Sensitive console logging | Audit complete — no `console.log/warn/error` calls exist in production source |
| Raw/internal user-facing errors | Audit complete — all error paths show safe user-facing strings (see `SettingsScreen`) |

---

### ⚠️ Pre-Submission Checklist (Before Apple/Google submission)

- [ ] Replace placeholder `assets/icon.png` and `assets/splash-icon.png` with final OliveOps artwork (1024×1024 icon, no alpha channel for iOS)
- [ ] Set the real EAS `projectId` UUID in `app.json` `extra.eas.projectId` after running `eas build --platform ios`
- [ ] Register an Apple Developer account and create an App Store Connect record for `ca.oliveops.mobile`
- [ ] Run `eas credentials` to generate/import signing certificates and provisioning profiles
- [ ] Verify `https://www.oliveops.ca/contact` is a live, working support URL before submission
- [ ] Complete a full `eas build --platform all --profile production` and smoke-test the builds
- [ ] Fill in App Store Connect metadata (description, screenshots, category, age rating)
- [ ] Do NOT submit credentials or builds until the above steps are complete

---

### Running Checks

```bash
# Tests
npm test

# TypeScript (if/when TS is added)
npx tsc --noEmit

# Expo doctor
npx expo-doctor
```

---

### API Configuration

The production API base URL is centralized in `src/config/api.js`.  
Override it for local development using the `EXPO_PUBLIC_API_URL` environment variable:

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start
```

---

### Encryption Declaration

This app uses standard HTTPS for all network communication. It does not implement any custom or non-standard encryption. The `ITSAppUsesNonExemptEncryption` key is set to `false` in `app.json`, which satisfies Apple's export compliance requirement without a separate ERN.
