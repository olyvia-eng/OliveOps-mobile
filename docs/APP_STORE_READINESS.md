# OliveOps Mobile App Store Readiness

This checklist prepares the managed Expo app for its first production EAS iOS build and TestFlight workflow. App Store listing content belongs in App Store Connect, not `app.json`.

See also:

- [App Store privacy inventory](APP_STORE_PRIVACY_INVENTORY.md)
- [TestFlight smoke test](TESTFLIGHT_SMOKE_TEST.md)

## Verified Release Configuration

- App name: `OliveOps Mobile`
- Expo slug: `oliveops-mobile`
- Expo SDK: `57`
- Required Node.js: `22.13.0` or newer
- App version: `1.0.0`
- iOS bundle identifier: `ca.oliveops.app`
- Android package: `ca.oliveops.mobile`
- iPhone-only v1: `supportsTablet: false`
- Custom URL scheme: not configured; current app flows do not require one
- Encryption declaration: `usesNonExemptEncryption: false`
- Production API: `https://app.oliveops.ca`
- EAS build profiles: development, internal preview, and store production
- Development profile dependency: `expo-dev-client` installed
- Production version strategy: EAS remote build numbers with `autoIncrement: true`
- EAS project ID: `b4520c74-5e00-49fa-abf0-2ed0649d1223`

The committed `app.json` remains the marketing-version baseline. Once EAS initializes remote versioning, EAS is authoritative for the iOS build number and increments it without rewriting `app.json`.

## EAS Project Setup

The repository is linked to the `olyvias-team` EAS account with project ID `b4520c74-5e00-49fa-abf0-2ed0649d1223` in `app.json`.

1. Verify the link under the intended OliveOps Expo account before the first build:

   ```powershell
   npx eas-cli@latest project:info
   ```

2. Verify the production public environment:

   ```powershell
   npx eas-cli@latest env:list --environment production
   ```

   It must include `EXPO_PUBLIC_API_BASE_URL=https://app.oliveops.ca`.

3. If missing, configure the public production API variable:

   ```powershell
   npx eas-cli@latest env:set --name EXPO_PUBLIC_API_BASE_URL --value https://app.oliveops.ca --environment production --visibility plaintext
   ```

4. Configure the same value for production-like internal preview builds:

   ```powershell
   npx eas-cli@latest env:set --name EXPO_PUBLIC_API_BASE_URL --value https://app.oliveops.ca --environment preview --visibility plaintext
   ```

`EXPO_PUBLIC_*` values are embedded in the client and readable by app users. Never place passwords, signing credentials, access tokens, private keys, or other secrets in them. No other production public variable is currently required. Local development may continue to use an ignored `.env` file.

Do not run a production build until the Apple account, bundle ID, branding, and production backend are ready. The eventual build command is:

```powershell
npx eas-cli@latest build --platform ios --profile production
```

Do not add Apple credentials, team IDs, App Store IDs, or signing files to this repository. EAS remote credentials are the default strategy and can be configured interactively during the first build.

## Production Assets

Production branding paths are configured in `app.json`. The approved iOS source remains unchanged; the Android adaptive foreground is derived from that approved leaf artwork.

- `assets/icon.png`: configured as the global, iOS, and legacy Android icon.
- `assets/adaptive-icon-foreground.png`: transparent Android adaptive foreground derived from the approved leaf.
- `assets/splash-icon.png`: configured through the SDK 57 `expo-splash-screen` plugin.
- `assets/fulllogo.png`: retained as the reusable high-resolution full OliveOps logo.
- `assets/OliveOpsLogo.jpg`: retained because the Login screen still references it.
- Old `android-icon-background.png`, `android-icon-foreground.png`, and `android-icon-monochrome.png` files remain in the repository but are no longer referenced by production configuration.

### iOS App Icon

- `assets/icon.png` is the approved 1024 x 1024 OliveOps leaf icon, and Expo will generate the required device sizes.
- The source is an opaque, full-bleed RGB PNG without pre-rounded corners or transparent pixels.
- The iOS production icon asset is ready for the TestFlight release candidate.

### Splash Screen

- `assets/splash-icon.png` is a 1024 x 1024 OliveOps logo/wordmark asset.
- The SDK 57 `expo-splash-screen` config plugin uses `imageWidth: 300`, `resizeMode: contain`, and warm off-white `#F5EFE7`.
- `contain` preserves the logo aspect ratio without cropping or stretching.
- Configuration is ready. Verify final scale and background blending in a preview or production build because Expo Go and development clients cannot fully reproduce the native SDK 57 splash.

### Android Adaptive Icon

- `assets/adaptive-icon-foreground.png` is a 1024 x 1024 RGBA PNG containing only the approved green leaf on transparency.
- The visible 594 x 564 leaf bounds are centered within a conservative adaptive-mask safe zone.
- `android.adaptiveIcon.backgroundColor` separately supplies warm off-white `#F5EFE7`.
- `assets/icon.png` remains the opaque legacy Android fallback.
- Verify circular, squircle, and OEM mask rendering in an Android preview build before Play Store release. A branded monochrome layer remains optional for Android 13 themed icons.

## Runtime Resilience

- SecureStore restoration finishes before startup redirects, preventing a Login flash for restorable sessions.
- Confirmed expired or invalid sessions are cleared and routed safely to Login.
- Transient network, backend, or SecureStore verification failures show a retryable startup state rather than deleting a potentially valid session.
- A top-level error boundary prevents unexpected render failures from leaving a blank screen; user-facing fallback text never includes exception details.
- Login and destructive clocking/correction flows fail closed while offline. No offline queue is implemented or implied.
- Failed prepared photo uploads are cleaned up best-effort, and clock-out remains blocked while any retained attachment is uploading or failed.

### Web Favicon

- `assets/favicon.png` is an Expo starter favicon referenced by `expo.web.favicon`.
- Replace it for a future web release with an approved square PNG, at least 48 x 48; a 192 x 192 or larger source is recommended.
- The favicon does not affect or block iOS TestFlight.

## Apple Developer Setup

- [ ] Confirm the OliveOps Apple Developer Program membership is active and agreements are accepted.
- [ ] Confirm the release operator has permission to manage identifiers, certificates, App Store Connect records, and TestFlight builds.
- [ ] Confirm the existing App ID for `ca.oliveops.app` remains registered under the correct OliveOps team.
- [ ] Do not enable capabilities that the app does not use. Camera and photo-library access are privacy permissions, not App ID capabilities.
- [ ] During the first production build, allow EAS to create or select the iOS distribution certificate and App Store provisioning profile, or deliberately select existing valid remote credentials.
- [ ] Verify generated signing assets use `ca.oliveops.app` and the intended Apple team.

## App Store Connect App Record

- [ ] Create the iOS app record under the correct provider/team.
- [ ] App name: confirm availability of `OliveOps Mobile`; choose the final name manually if unavailable.
- [ ] Primary language: select the language used by the listing and support process.
- [ ] SKU: choose a unique internal identifier. It is not customer-facing and cannot be changed later.
- [ ] Bundle ID: select the registered `ca.oliveops.app` identifier.
- [ ] Privacy Policy URL: `https://www.oliveops.ca/privacy`.
- [ ] Support URL: provide a public HTTPS support page. The in-app `mailto:support@oliveops.ca` link does not satisfy this App Store Connect URL field, and no HTTPS support URL is currently documented.
- [ ] Marketing URL: optional; provide only if an approved public page exists.
- [ ] Primary category: select the category that best represents the product, likely Business, after product-owner review.
- [ ] Secondary category: optional; select only if accurate.
- [ ] Complete Apple's age-rating questionnaire from actual app behavior. The code audit found no ads, purchases, gambling, mature content, social feed, unrestricted web access, or location use; the account holder must provide the final answers.
- [ ] Complete App Privacy using `APP_STORE_PRIVACY_INVENTORY.md` and verify answers against backend retention, processors, and the published privacy policy.
- [ ] Answer export-compliance questions consistently with `usesNonExemptEncryption: false` and the current use of standard HTTPS/SecureStore. Reassess if cryptography changes.
- [ ] Enter App Review contact name, phone number, and email address.
- [ ] Enter review notes with a short walkthrough, activity explanation, and permission context.
- [ ] Enter the dedicated demo-account username and password only in App Store Connect Review Information, never in source control.

## App Review Demo Account

Create a dedicated, non-personal crew-member account in a non-sensitive demo business.

- [ ] Use a stable email address monitored by OliveOps and a stable password that will remain valid throughout review.
- [ ] Link a valid `employeeId`.
- [ ] Ensure the employee is active and has access to time tracking so Apple can see Drive Time.
- [ ] Assign at least two clearly named demo jobs.
- [ ] Configure at least one active unbillable category.
- [ ] Seed several completed entries so Time History and correction workflows are reviewable.
- [ ] Ensure photo storage/upload is enabled.
- [ ] Use synthetic data only; do not expose real customers, employees, projects, or job-site photos.
- [ ] Reset the account to no active shift before submission.
- [ ] Avoid MFA, forced password rotation, one-time links, IP restrictions, or other review-time blockers.
- [ ] Keep the backend and demo data available for the entire review window.

Suggested review-note walkthrough:

1. Sign in with the supplied demo account.
2. Clock in to a demo job and open Active Shift.
3. Switch to Drive Time or an Unbillable category.
4. Clock out with a camera or library photo.
5. Open Time History and submit a Time Correction Request.
6. Open Settings to verify Privacy Policy, Terms, and Support.

Explain that camera and photo-library access are optional and used only to attach job-site photos to time entries.

## Production Backend Precheck

- [ ] `https://app.oliveops.ca/api/auth?action=mobile-login` is deployed and returns a user plus mobile access token.
- [ ] Session, bootstrap, clocking, unbillable-category, time-correction, and storage endpoints are available over HTTPS.
- [ ] The demo employee is active, can track time, sees Drive Time, and has assigned jobs.
- [ ] Presigned photo uploads work from a physical iPhone.
- [ ] Privacy and retention statements have been verified with backend/data owners.

## App Store Connect Artifacts

Supply these manually in App Store Connect; do not add them to `app.json` merely as listing metadata.

- [ ] Final approved app icon and splash treatment
- [ ] Required iPhone screenshots from the production/TestFlight build
- [ ] App description
- [ ] Subtitle
- [ ] Keywords
- [ ] Promotional text, if desired
- [ ] Public HTTPS Support URL
- [ ] Marketing URL, if desired
- [ ] Category and age-rating answers
- [ ] App Privacy answers
- [ ] Review contact information
- [ ] Review notes
- [ ] Demo-account credentials

## Pre-Build Validation

Run before each release candidate:

```powershell
npx expo config --type public
npx tsc --noEmit
npm test
npx expo-doctor
```

Then complete `TESTFLIGHT_SMOKE_TEST.md` against the uploaded production build, not Expo Go.
