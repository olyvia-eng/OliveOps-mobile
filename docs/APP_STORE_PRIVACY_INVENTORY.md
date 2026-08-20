# OliveOps App Store Privacy Inventory

This is a code-observed worksheet for completing App Store Connect privacy questions. It is not legal advice. Confirm retention, backend processing, subprocessors, deletion practices, and policy language with OliveOps privacy and backend owners before publishing answers.

## Summary

The app is an authenticated employee timekeeping client. Account, work, time-entry, photo, form, and correction records are associated with user, employee, business, job, form, submission, or time-entry identifiers and therefore appear linked to identity. The code contains no advertising, cross-app tracking, product analytics, or location collection. Sentry is configured for production error and native crash diagnostics when `EXPO_PUBLIC_SENTRY_DSN` is set.

## Data Inventory

| Data | Code-observed use | Purpose | Linked to identity | Tracking or advertising | Transfer/processing observed |
| --- | --- | --- | --- | --- | --- |
| Name and email address | Returned in the authenticated session; email is entered for login | Authentication, account display, app functionality | Yes | No | OliveOps production API |
| User, employee, and business identifiers | Session and work records contain user, employee, and business IDs | Authentication, authorization, employee/job scoping, timekeeping | Yes | No | OliveOps production API |
| Business name and user role | Returned in session data | Display and authorization context | Yes | No | OliveOps production API |
| Login password | User enters it and the app sends it to mobile login over HTTPS | Authentication | Associated with the account during authentication | No | OliveOps production API; not stored by the mobile app |
| Access and refresh tokens | Returned after login and stored in Expo SecureStore | Session security and restoration | Associated with the account | No | Stored in OS secure storage; access token sent to first-party APIs |
| Job identifiers, titles, status, and assignments | Loaded from bootstrap and selected during work actions | Job assignment display and workforce timekeeping | Yes | No | OliveOps production API |
| Time-entry data | Employee ID, job IDs, work type, unbillable category, clock-in/out times, breaks, and notes | Record work activity and payroll/operations context | Yes | No | OliveOps production API |
| Clock-out notes | Optional text entered by the employee | Work record context | Yes | No | OliveOps production API |
| Job-site photos | Captured or selected by the employee, up to five per clock-out | Attach visual work evidence to a time entry | Yes, through time-entry and file IDs | No | Prepared through OliveOps API and uploaded using presigned object-storage URLs |
| Photo metadata | File name, MIME type, byte size, category, entity type, and time-entry ID | Prepare, validate, associate, and clean up uploads | Yes | No | OliveOps API and object-storage service |
| Time-correction data | Request type, requested times/job/activity, reason, status, submitter/reviewer IDs | Request and review corrections to work records | Yes | No | OliveOps production API |
| Form responses and submission records | Employee-entered answers, form/context identifiers, submission status, and review status where provided | Complete employer-assigned and on-demand field workflows | Yes | No | OliveOps production API |
| Request and idempotency identifiers | Generated for clocking requests | Security, reliability, and duplicate-request prevention | Associated with the relevant work request | No | OliveOps production API |
| Crash and error diagnostics | Sanitized exception messages, stack traces, and limited app/device/OS/runtime context when Sentry is enabled | App stability and diagnostics | Not deliberately linked by the app; confirm Sentry/backend configuration | No | Sentry |

App Store Connect category mapping must be confirmed against Apple's current definitions. Likely areas to evaluate include Contact Info, User Content, Identifiers, and Other Data. Do not select or omit a category solely from this document without checking the current questionnaire and backend practices.

## Data Not Observed

The mobile code and declared dependencies do not show collection of:

- Precise or coarse location
- Contacts or address book
- Health or fitness data
- Payment or financial information
- Advertising identifiers such as IDFA
- Device fingerprint or persistent device identifier
- Audio or microphone recordings
- Browsing or search history
- Analytics events or product-usage telemetry
- Performance traces, session replay, screenshots, view hierarchy, breadcrumbs, or failed-request capture
- Advertising data

Drive Time is a work-activity classification only. The app does not request location permission or use a geolocation API.

## Device and Network Checks

- `expo-device` is used locally to distinguish a physical device when validating localhost API configuration.
- React Native `Platform.OS` is used for UI/runtime behavior.
- NetInfo is used locally to determine online/offline status.
- No deliberate transmission of device model, OS version, device ID, IP address, or connectivity details was found in the application code.

Standard infrastructure may process network metadata such as IP addresses in server or object-storage logs. Confirm that separately with backend and infrastructure owners.

## Tracking and Advertising

- No ATT prompt or IDFA access is implemented.
- No ad network is installed.
- No cross-app or cross-site tracking code was found.
- No analytics, attribution, advertising, or session-recording SDK was found.
- Sentry is configured only for sanitized errors and native crash diagnostics; performance tracing, profiling, replay, logs, breadcrumbs, screenshots, view hierarchy, and failed-request capture are disabled.
- The observed data is used for authentication and OliveOps workforce functionality, not advertising.

Based on application code, the tracking answer appears to be No. Reconfirm against backend integrations and organizational data-sharing practices.

## Third-Party Processing

- Application API data is sent to `https://app.oliveops.ca`.
- Photo binaries are uploaded through presigned object-storage URLs. The provider, region, retention, access controls, and contractual role must be confirmed by infrastructure owners.
- Sanitized error and native crash diagnostics are sent to Sentry only when `EXPO_PUBLIC_SENTRY_DSN` is configured.
- No third-party analytics, advertising, attribution, or social SDK is present.

For App Store Connect, distinguish service providers processing data on OliveOps' behalf from data shared for those parties' own purposes. Confirm this distinction with the privacy owner.

## Permission Disclosures

- Camera: optional, used to capture job-site photos for time entries.
- Photo library: optional, uses the operating-system picker to select job-site photos for time entries.
- Microphone: not requested.
- Location: not requested.

Configured copy:

- Camera: "Allow OliveOps to take job-site photos to attach to time entries."
- Photos: "Allow OliveOps to select job-site photos to attach to time entries."

## Retention and User Requests

The mobile repository does not define backend retention, account deletion, export, or correction-review policies. Before submission, verify:

- Retention periods for accounts, time entries, corrections, tokens, photos, and infrastructure logs
- Photo deletion behavior after committed time entries
- Account and employee data deletion workflows
- User-access and correction rights
- Support process for privacy requests
- Consistency with `https://www.oliveops.ca/privacy`

## Privacy Manifest Decision

No app-level `PrivacyInfo.xcprivacy` is added based solely on the current application audit. The app does not directly use a required-reason API or tracking domain identified by this source review. Expo/native dependencies may include their own manifests.

Before submission, inspect the generated iOS archive and App Store validation output. Re-audit this decision whenever native dependencies, analytics, crash reporting, location, advertising, or data practices change.
