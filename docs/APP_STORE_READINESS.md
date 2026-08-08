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

Current Expo starter assets are not approved OliveOps production branding.

Current file dimensions:

- `assets/icon.png`: 1024 x 1024
- `assets/splash-icon.png`: 1024 x 1024
- `assets/android-icon-foreground.png`: 512 x 512
- `assets/android-icon-background.png`: 512 x 512
- `assets/android-icon-monochrome.png`: 432 x 432
- `assets/favicon.png`: 48 x 48
- `assets/OliveOpsLogo.jpg`: 213 x 73

### iOS App Icon

- Replace `assets/icon.png`, which is referenced by `expo.icon`.
- Supply an approved 1024 x 1024 PNG in sRGB.
- Use a square, full-bleed image without pre-rounded corners.
- Do not use transparency for the iOS production source.
- Keep important artwork away from the outer edge so it remains legible at small sizes.
- Expo generates the required device icon sizes from this source.

`assets/OliveOpsLogo.jpg` is a small rectangular login wordmark. It is not a suitable app-icon source.

### Splash Screen

- `assets/splash-icon.png` is an Expo starter placeholder and is not currently referenced by `app.json`.
- No final splash treatment is configured.
- Supply an approved transparent PNG logo/image and an exact approved background hex color.
- Use a square source of at least 1024 x 1024 with generous transparent safe space around the mark; Expo will place it responsively rather than using a device-specific full-screen bitmap.
- Configure the Expo splash only after final artwork and resize behavior are approved. Do not configure the current placeholder.

### Android Adaptive Icon

These are not blockers for an iOS-only TestFlight build, but all remain Expo starter assets and must be replaced before Android release:

- `assets/android-icon-foreground.png`: approved square transparent foreground, preferably 1080 x 1080; keep the mark inside the adaptive-icon safe center.
- `assets/android-icon-background.png`: approved square full-bleed opaque background, preferably 1080 x 1080, or use an approved solid background color.
- `assets/android-icon-monochrome.png`: approved single-color transparent mark for themed icons, preferably 1080 x 1080.

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
