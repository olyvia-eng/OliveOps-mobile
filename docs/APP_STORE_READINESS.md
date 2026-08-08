# OliveOps Mobile App Store Readiness

This checklist is for shipping OliveOps Mobile to TestFlight/App Store with the current MVP behavior.

## Phase 1 Completion Status

The items below reflect what has been implemented and verified in the codebase.

### ✅ Completed

| Item | Details |
|---|---|
| iOS `bundleIdentifier` | `ca.oliveops.mobile` |
| iOS `buildNumber` | `1` (auto-incremented by EAS in production) |
| iOS `supportsTablet` | `false` (portrait-only, phone-targeted) |
| iOS `usesNonExemptEncryption` | `false` — app uses HTTPS only, no custom encryption |
| Android `package` | `ca.oliveops.mobile` |
| Android `versionCode` | `1` (auto-incremented by EAS in production) |
| `runtimeVersion` policy | `appVersion` — keeps OTA updates tied to the app version |
| Splash screen config | `splash-icon.png`, `resizeMode: contain`, white background |
| `expo-image-picker` permission strings | Camera and photo-library purpose strings set; `microphonePermission: false` |
| Photo library permission minimization | No permissions requested at launch; triggered only when user taps "Add Photo" |
| Photo multi-select | `allowsMultipleSelection: true`, `selectionLimit` capped to `MAX_TIME_ENTRY_PHOTOS` remaining slots |
| Orphaned photo cleanup | Unsubmitted uploaded photos are deleted via `cleanupUploadedAttachment` on screen unmount |
| Privacy Policy in Settings | `https://www.oliveops.ca/privacy` |
| Terms of Service in Settings | `https://www.oliveops.ca/terms` |
| Contact Support in Settings | `mailto:support@oliveops.ca` |
| Legacy generic-login removed | App uses `mobile-login` endpoint exclusively — no `action=login` fallback |
| API base URL centralized | `src/config/apiBaseUrl.ts` — set via `EXPO_PUBLIC_API_BASE_URL` env var |
| Localhost-on-device guard | Blocked by default; override with `EXPO_PUBLIC_ALLOW_LOCALHOST_FOR_DEVICE=true` |
| Sensitive console logging | All `console.error` calls are guarded with `if (__DEV__)` |
| User-facing error messages | All error paths show friendly strings; no raw/internal errors exposed |
| `eas.json` profiles | `development`, `preview`, `production` — production uses `autoIncrement: true` |
| EAS CLI version | `>= 16.0.0` |

---

## 1. Apple and Bundle Setup

- Confirm Apple Developer membership is active for the OliveOps organization.
- Register bundle identifier `ca.oliveops.mobile` in Apple Developer portal.
- Ensure App Store Connect app record exists and matches bundle identifier.
- Confirm app name and SKU are finalized.

## 2. Build and Signing

- Run `eas login` with the release account.
- Run `eas build:configure` once if this project has not been linked yet.
- Set the real EAS `projectId` UUID in `app.json` `extra.eas.projectId` after linking.
- Use `eas.json` `production` profile for release builds.
- Confirm iOS build number increments for each TestFlight submission (handled automatically by `autoIncrement: true`).

## 3. Environment Configuration

- Set `EXPO_PUBLIC_API_BASE_URL` to the production OliveOps backend URL before building.
- Do not ship with localhost API values on physical devices.
- Verify backend mobile auth endpoint is enabled: `/api/auth?action=mobile-login`.

## 4. Privacy, Legal, and Support

- Confirm in-app links open successfully from Settings:
  - Privacy Policy: `https://www.oliveops.ca/privacy`
  - Terms of Service: `https://www.oliveops.ca/terms`
  - Support: `mailto:support@oliveops.ca`
- Complete App Store privacy nutrition labels based on current data collection and processing.
- Confirm encryption export compliance setting remains accurate (`usesNonExemptEncryption: false`).

## 5. Photos and Permissions

- Confirm iOS permission copy in app config is clear and specific to time-entry photos.
- Verify camera capture uploads and attaches correctly.
- Verify library multi-select respects `MAX_TIME_ENTRY_PHOTOS` attachment limit.
- Verify removing an unsaved uploaded photo performs best-effort cleanup (already implemented via `cleanupUploadedAttachment`).

## 6. App Icon and Splash

- Replace placeholder `assets/icon.png` with final OliveOps artwork (1024×1024, no alpha channel for iOS).
- Replace placeholder `assets/splash-icon.png` with branded splash artwork.
- Confirm Android adaptive icon layers (`android-icon-foreground.png`, `android-icon-background.png`) use final artwork.

## 7. Core Runtime Validation

- Validate login, session restore, and logout against production backend.
- Validate clock in, clock out, switch activity, and time history on real devices.
- Validate offline warning behavior and retry flows.

## 8. QA Commands Before Release Cut

Run from project root:

```bash
npx tsc --noEmit
npm test
npx expo-doctor
```

## 9. App Store Submission Artifacts

- Prepare iPhone screenshots for all required size classes.
- Finalize App Store description, subtitle, keywords, and support contact.
- Confirm category and age rating selections.
- Confirm review notes include demo/test credentials process if required.

## 10. Release Smoke Test (TestFlight)

- Install the production build from TestFlight.
- Perform one full shift lifecycle:
  - Login
  - Clock in
  - Switch activity
  - Clock out with notes and multiple photos
  - Confirm time entry appears correctly in history
- Verify Settings legal/support links on device.
