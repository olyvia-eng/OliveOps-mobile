# OliveOps Mobile App Store Readiness

This document tracks repository readiness for the first TestFlight build. App Store listing content belongs in App Store Connect and is intentionally not stored in `app.json`.

## Repository Configuration Complete

- iOS bundle identifier: `ca.oliveops.mobile`.
- iPhone-only v1 configuration: `supportsTablet: false`.
- App version: `1.0.0`; initial iOS build number: `1`.
- EAS production builds auto-increment the build number.
- Development, internal preview, and production EAS profiles are defined.
- Preview and production builds set `EXPO_PUBLIC_API_BASE_URL=https://app.oliveops.ca`.
- API URL parsing and physical-device localhost protection are centralized in `src/config`.
- Local `.env` files are ignored. Do not put credentials, tokens, signing keys, or other secrets in `EXPO_PUBLIC_*` variables.
- Login uses only `/api/auth?action=mobile-login` and requires a mobile access token.
- Settings links to:
  - Privacy Policy: `https://www.oliveops.ca/privacy`
  - Terms of Service: `https://www.oliveops.ca/terms`
  - Support: `mailto:support@oliveops.ca`

## Encryption and Privacy Decisions

- `usesNonExemptEncryption: false` is appropriate for the current use of standard HTTPS transport and Expo SecureStore. Reassess if custom or non-standard cryptography is introduced.
- The app does not request microphone permission.
- Camera permission copy is: "Allow OliveOps to take job-site photos to attach to time entries."
- Photo selection copy is: "Allow OliveOps to select job-site photos to attach to time entries."
- Library selection uses the operating-system picker without requesting broad media-library access.
- No app-level `PrivacyInfo.xcprivacy` is currently added. The repository audit found no current native API or data-practice requirement that justifies one. Re-audit when native dependencies or data practices change.
- Production code does not intentionally log passwords, access tokens, refresh tokens, or session payloads.
- Backend and internal exception messages are mapped to user-safe errors before display.

## Photo Attachment Behavior Verified

- Library selection supports true multi-select.
- A time entry accepts at most five photos.
- Camera and library photos can coexist.
- Every selected asset up to the remaining capacity is processed.
- Removing an uploaded but uncommitted photo performs best-effort server cleanup.
- Leaving the screen cleans up uploaded draft photos.
- Photos committed by a successful clock-out are never cleaned up by screen unmount.

## Branding Blocker

The current app icon and splash-related files are Expo template placeholders and are not release-ready:

- `assets/icon.png`
- `assets/splash-icon.png`
- `assets/android-icon-foreground.png`
- `assets/android-icon-background.png`
- `assets/android-icon-monochrome.png`

`assets/OliveOpsLogo.jpg` is a small wordmark, not a suitable source for final app icon or splash artwork. Obtain approved OliveOps branding assets, replace the placeholder files at appropriate resolutions, and configure the final splash treatment before the TestFlight release candidate. Do not generate replacement branding.

## Manual Setup Before TestFlight

- Confirm the OliveOps Apple Developer Program membership is active.
- Register `ca.oliveops.mobile` with the correct Apple team.
- Create or verify the matching App Store Connect app record.
- Log in to EAS with the OliveOps release account.
- Link the EAS project and configure iOS signing credentials if not already completed.
- Supply and verify approved app icon and splash assets on a physical iPhone.
- Confirm `https://app.oliveops.ca/api/auth?action=mobile-login` is deployed and enabled for production mobile authentication.
- Create a production iOS build with the `production` EAS profile and confirm its build number is unique.
- Upload the build to TestFlight and complete export-compliance questions consistently with `usesNonExemptEncryption: false`.
- Complete App Store privacy nutrition labels from the actual production data flows.
- Add internal TestFlight testers and any required testing notes.

## TestFlight Device Checklist

- Install the production build from TestFlight, not Expo Go.
- Test login, session restore, logout, and expired-session behavior.
- Complete a full shift lifecycle: clock in, switch activity, clock out with notes and five mixed camera/library photos, and verify history.
- Remove a draft photo and abandon a draft clock-out; confirm no attachment appears on the time entry.
- Verify offline warnings and retry behavior.
- Open Privacy Policy, Terms of Service, and Support from Settings.
- Deny camera access once and confirm the app explains the required permission without crashing.
- Verify the approved icon and splash on the target iPhone sizes.

## Release Validation

Run from the repository root before each release candidate:

```bash
npx tsc --noEmit
npm test
npx expo-doctor
```

## Later App Store Connect Work

Before public App Store submission, prepare the description, subtitle, keywords, category, age rating, screenshots, support contact, and review notes or demo credentials in App Store Connect. Do not add this listing metadata to `app.json`.
