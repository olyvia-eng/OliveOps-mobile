# OliveOps Mobile App Store Readiness

This checklist is for shipping OliveOps Mobile to TestFlight/App Store with the current MVP behavior.

## 1. Apple and Bundle Setup

- Confirm Apple Developer membership is active for the OliveOps organization.
- Register bundle identifier `ca.oliveops.mobile` in Apple Developer portal.
- Ensure App Store Connect app record exists and matches bundle identifier.
- Confirm app name and SKU are finalized.

## 2. Build and Signing

- Run `eas login` with the release account.
- Run `eas build:configure` once if this project has not been linked yet.
- Ensure `app.json` contains iOS `bundleIdentifier`, `buildNumber`, and encryption declaration.
- Use `eas.json` `production` profile for release builds.
- Confirm iOS build number increments for each TestFlight submission.

## 3. Environment Configuration

- Set `EXPO_PUBLIC_API_BASE_URL` to the production OliveOps backend URL.
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
- Verify library multi-select respects max attachment limit.
- Verify removing an unsaved uploaded photo performs best-effort cleanup.

## 6. Core Runtime Validation

- Validate login, session restore, and logout against production backend.
- Validate clock in, clock out, switch activity, and time history on real devices.
- Validate offline warning behavior and retry flows.

## 7. QA Commands Before Release Cut

Run from project root:

```bash
npx tsc --noEmit
npm test
npx expo doctor
```

If `npx expo doctor` is unavailable, use:

```bash
npx expo-doctor
```

## 8. App Store Submission Artifacts

- Prepare iPhone screenshots for all required size classes.
- Finalize App Store description, subtitle, keywords, and support contact.
- Confirm category and age rating selections.
- Confirm review notes include demo/test credentials process if required.

## 9. Release Smoke Test (TestFlight)

- Install the production build from TestFlight.
- Perform one full shift lifecycle:
  - Login
  - Clock in
  - Switch activity
  - Clock out with notes and multiple photos
  - Confirm time entry appears correctly in history
- Verify Settings legal/support links on device.
