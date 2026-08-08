# OliveOps Mobile App Store Readiness

This checklist prepares the managed Expo app for its first production EAS iOS build and TestFlight workflow. App Store listing content belongs in App Store Connect, not `app.json`.

See also:

- [App Store privacy inventory](APP_STORE_PRIVACY_INVENTORY.md)
- [TestFlight smoke test](TESTFLIGHT_SMOKE_TEST.md)

## Verified Release Configuration

- App name: `OliveOps Mobile`
- Expo slug: `oliveops-mobile`
- Expo SDK: `54`
- App version: `1.0.0`
- iOS build-number seed: `1`
- iOS bundle identifier: `ca.oliveops.mobile`
- iPhone-only v1: `supportsTablet: false`
- Custom URL scheme: not configured; current app flows do not require one
- Encryption declaration: `usesNonExemptEncryption: false`
- Production API: `https://app.oliveops.ca`
- EAS build profiles: development, internal preview, and store production
- Development profile dependency: `expo-dev-client` installed
- Production version strategy: EAS remote build numbers with `autoIncrement: true`

The committed `app.json` remains the marketing-version baseline. Once EAS initializes remote versioning, EAS is authoritative for the iOS build number and increments it without rewriting `app.json`.

## EAS Project Setup

The repository is not currently linked to an EAS project: `app.json` has no `extra.eas.projectId` or `owner`. Run these commands interactively from the repository root under the correct OliveOps Expo account.

1. Link or create the EAS project:

   ```powershell
   npx eas-cli@latest init
   ```

   Confirm the selected account and project belong to OliveOps. Allow EAS CLI to add `expo.extra.eas.projectId` to the app configuration.

2. Verify the link:

   ```powershell
   npx eas-cli@latest project:info
   ```

3. Configure the public production API variable:

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

Production branding paths are configured in `app.json`. No branding file was cropped, regenerated, or otherwise modified.

- `assets/icon.png`: configured as the global and explicit iOS icon.
- `assets/adaptive-icon.png`: configured as the Android legacy icon and adaptive foreground.
- `assets/splash-icon.png`: configured through the SDK 54 `expo-splash-screen` plugin.
- `assets/fulllogo.png`: retained as the reusable high-resolution full OliveOps logo.
- `assets/OliveOpsLogo.jpg`: retained because the Login screen still references it.
- Old `android-icon-background.png`, `android-icon-foreground.png`, and `android-icon-monochrome.png` files remain in the repository but are no longer referenced by production configuration.

### iOS App Icon

- `assets/icon.png` has the required 1024 x 1024 square PNG dimensions and Expo will generate the device sizes.
- Visual inspection still shows Expo starter artwork and guide marks in the current file. Replace the file in place with the approved OliveOps icon before the TestFlight release candidate.
- The final replacement must be full-bleed, have no pre-rounded corners or transparent pixels, and keep important artwork away from the outer edge.
- Do not substitute the full wordmark as the app icon.

### Splash Screen

- `assets/splash-icon.png` is a 1024 x 1024 OliveOps logo/wordmark asset.
- The SDK 54 `expo-splash-screen` config plugin uses `imageWidth: 300`, `resizeMode: contain`, and warm off-white `#F5EFE7`.
- `contain` preserves the logo aspect ratio without cropping or stretching.
- Configuration is ready. Verify final scale and background blending in a preview or production build because Expo Go and development clients cannot fully reproduce the native SDK 54 splash.

### Android Adaptive Icon

- `assets/adaptive-icon.png` is configured for both `android.icon` and `android.adaptiveIcon.foregroundImage` over `#F5EFE7`.
- The primary leaf mark is centered within the adaptive mask safe area.
- The supplied file is a flattened opaque icon rather than a transparent foreground layer. It may be clipped differently by circular, squircle, or OEM masks.
- Before an Android production release, provide a transparent foreground export containing only the safe-zone artwork. A branded monochrome layer is also recommended for Android 13 themed icons.
- This Android caveat does not block an iOS TestFlight build.

### Web Favicon

- `assets/favicon.png` is an Expo starter favicon referenced by `expo.web.favicon`.
- Replace it for a future web release with an approved square PNG, at least 48 x 48; a 192 x 192 or larger source is recommended.
- The favicon does not affect or block iOS TestFlight.

## Apple Developer Setup

- [ ] Confirm the OliveOps Apple Developer Program membership is active and agreements are accepted.
- [ ] Confirm the release operator has permission to manage identifiers, certificates, App Store Connect records, and TestFlight builds.
- [ ] Register an explicit App ID for `ca.oliveops.mobile` under the correct OliveOps team.
- [ ] Do not enable capabilities that the app does not use. Camera and photo-library access are privacy permissions, not App ID capabilities.
- [ ] During the first production build, allow EAS to create or select the iOS distribution certificate and App Store provisioning profile, or deliberately select existing valid remote credentials.
- [ ] Verify generated signing assets use `ca.oliveops.mobile` and the intended Apple team.

## App Store Connect App Record

- [ ] Create the iOS app record under the correct provider/team.
- [ ] App name: confirm availability of `OliveOps Mobile`; choose the final name manually if unavailable.
- [ ] Primary language: select the language used by the listing and support process.
- [ ] SKU: choose a unique internal identifier. It is not customer-facing and cannot be changed later.
- [ ] Bundle ID: select the registered `ca.oliveops.mobile` identifier.
- [ ] Privacy Policy URL: `https://www.oliveops.ca/privacy`.
- [ ] Support URL: provide a public HTTPS support page. The in-app `mailto:support@oliveops.ca` link does not satisfy this App Store Connect URL field, and no HTTPS support URL is currently documented.
- [ ] Marketing URL: optional; provide only if an approved public page exists.
- [ ] Primary category: select the category that best represents the product, likely Business, after product-owner review.
- [ ] Secondary category: optional; select only if accurate.
- [ ] Complete Apple's age-rating questionnaire from actual app behavior. The code audit found no ads, purchases, gambling, mature content, social feed, unrestricted web access, or location use; the account holder must provide the final answers.
- [ ] Complete App Privacy using `APP_STORE_PRIVACY_INVENTORY.md` and verify answers against backend retention, processors, and the published privacy policy.
- [ ] Answer export-compliance questions consistently with `usesNonExemptEncryption: false` and the current use of standard HTTPS/SecureStore. Reassess if cryptography changes.
- [ ] Enter App Review contact name, phone number, and email address.
- [ ] Enter review notes with a short walkthrough, capability explanation, and permission context.
- [ ] Enter the dedicated demo-account username and password only in App Store Connect Review Information, never in source control.

## App Review Demo Account

Create a dedicated, non-personal crew-member account in a non-sensitive demo business.

- [ ] Use a stable email address monitored by OliveOps and a stable password that will remain valid throughout review.
- [ ] Link a valid `employeeId`.
- [ ] Enable `paidDriveTime` so Apple can see Drive Time.
- [ ] Assign at least two clearly named demo jobs.
- [ ] Configure at least one active unbillable category.
- [ ] Seed several completed entries so Time History and correction workflows are reviewable.
- [ ] Ensure photo storage/upload is enabled.
- [ ] Use synthetic data only; do not expose real customers, employees, projects, or job-site photos.
- [ ] Reset the account to no active shift before submission.
- [ ] Avoid MFA, forced password rotation, one-time links, IP restrictions, or other review-time blockers.
- [ ] Keep the backend and demo data available for the entire review window.

A second account with `paidDriveTime: false` is recommended for internal TestFlight capability-gate testing. Apple can use the enabled account if the review notes explain that Drive Time is account-controlled.

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
- [ ] The demo account receives the expected `paidDriveTime` capability and assigned jobs.
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
