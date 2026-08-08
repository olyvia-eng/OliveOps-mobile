# OliveOps Mobile TestFlight Smoke Test

Run this checklist against a production-profile build installed from TestFlight on physical iPhones. Do not use Expo Go for release acceptance.

## Test Record

- App version:
- Build number:
- TestFlight group:
- Test date:
- Tester:
- iPhone model:
- iOS version:
- Network tested: Wi-Fi / cellular / offline
- Production API confirmed: `https://app.oliveops.ca`

## Test Data Prerequisites

Prepare synthetic data only.

- Eligible crew-member account with a linked employee, `paidDriveTime: true`, at least two assigned jobs, active unbillable categories, and completed history
- Ineligible crew-member account with `paidDriveTime: false` or absent
- Working production photo-upload storage
- Completed time entry suitable for a correction request
- Optional active entry older than the configured threshold for a practical long-shift warning test
- Reset the primary account to no active shift before beginning

## Install and Cold Launch

- [ ] Install or update OliveOps Mobile from TestFlight.
- [ ] Confirm the app name and approved icon are correct.
- [ ] Cold-launch after force-closing the app.
- [ ] Confirm the launch screen uses approved branding with no Expo placeholder.
- [ ] Confirm the session-checking state resolves without a blank screen or crash.
- [ ] Confirm Login does not flash before a stored session finishes restoring.
- [ ] Confirm a signed-out device reaches Login.

## Authentication and Session

- [ ] Enter an incorrect password and confirm a friendly login error with no status code, backend text, or internal detail.
- [ ] Sign in with the eligible demo account.
- [ ] Confirm Home loads the correct employee/business work context.
- [ ] Force-close and relaunch; confirm the secure session restores without another login.
- [ ] With a valid stored session, interrupt connectivity during cold launch; confirm a safe Retry state appears and succeeds after connectivity returns without forcing a new login.
- [ ] Open Settings, log out, and confirm Login appears.
- [ ] Relaunch after logout and confirm the session remains cleared.
- [ ] If practical, expire the test session server-side and confirm the app shows a safe expired-session message on relaunch or the next action.

## Home and Active Shift

- [ ] With no active shift, confirm Home shows the clocked-out state and Clock In action.
- [ ] After clock-in, confirm Home shows the authoritative active activity/job and elapsed time.
- [ ] Open Active Shift and verify activity, job or unbillable category, start time, and elapsed clock.
- [ ] Verify Switch Activity and Clock Out are available during an active shift.
- [ ] If a long-shift fixture is practical, confirm the forgotten-clock-out warning and its actions appear without blocking navigation.

## Clock In: Job Work

- [ ] Start from no active shift and open Clock In.
- [ ] Select Job Work.
- [ ] Confirm only appropriate assigned/available jobs appear.
- [ ] Select a demo job and clock in.
- [ ] Confirm success returns to the active state and shows the selected job.

## Clock In: Drive Time Capability

Eligible account:

- [ ] Confirm Drive Time appears on Clock In.
- [ ] Select Drive Time, choose a required job, and clock in successfully.
- [ ] Confirm Active Shift displays Drive Time.

Ineligible account:

- [ ] Sign in with the account whose `paidDriveTime` capability is false or absent.
- [ ] Confirm Drive Time is hidden on Clock In.
- [ ] Confirm Drive Time is hidden on Switch Activity.
- [ ] Confirm Drive Time is hidden where correction activity choices are capability-gated.

## Clock In: Unbillable

- [ ] Select Unbillable Time.
- [ ] Confirm active categories load from production.
- [ ] Select a category and clock in.
- [ ] Confirm Active Shift shows Unbillable and the selected category.
- [ ] If practical, test an account/business with no active categories and confirm submission remains unavailable with a friendly state.

## Switch Activity

- [ ] While clocked in, open Switch Activity.
- [ ] Switch from one demo job to another and confirm the active state updates.
- [ ] Switch to Drive Time with the eligible account and confirm the selected job/activity.
- [ ] Switch to an Unbillable category and confirm the active state updates.
- [ ] Confirm repeated taps do not create duplicate transitions.

## Clock Out Without Photos

- [ ] Open Clock Out from an active shift.
- [ ] Confirm the shift summary is correct.
- [ ] Enter optional notes and submit without photos.
- [ ] Confirm the destructive confirmation appears.
- [ ] Confirm successful submission returns Home to the clocked-out state.
- [ ] Confirm the completed entry appears in Time History with the expected duration, activity, and notes-dependent backend record.

## Clock Out With Photos

Camera:

- [ ] Add a camera photo and grant camera access when prompted.
- [ ] Confirm the image uploads and shows Attached before submission.
- [ ] Deny or revoke camera permission in a separate pass; confirm a friendly message and that clock-out remains possible without a photo.

Library:

- [ ] Add one photo through the system library picker.
- [ ] Confirm the app does not request unnecessary broad library access.
- [ ] Select multiple photos in one picker session and confirm every selected asset appears and uploads.

Mixed and capacity:

- [ ] Add camera and library photos in the same clock-out draft.
- [ ] Reach five total attachments and confirm Add Photo is no longer available.
- [ ] Remove one and confirm another photo can be added.
- [ ] Submit five uploaded photos and confirm clock-out succeeds.
- [ ] Interrupt one upload in a multi-photo selection; confirm the failed item offers Retry and Clock Out remains disabled until the item succeeds or is removed.

Draft cleanup:

- [ ] Upload a photo, remove it before clock-out, and confirm it disappears from the draft.
- [ ] Upload draft photos, leave Clock Out without submitting, and confirm the shift remains active and no attachment is committed.
- [ ] Confirm a successfully submitted clock-out does not later lose its committed attachment records.

Time History currently displays time-entry and correction state, not photo previews. Do not fail this test because thumbnails are absent from history.

## Time History

- [ ] Open Time History and confirm today's entries and the weekly total load.
- [ ] Confirm completed entries show time range, duration, job/activity, and correction badges where applicable.
- [ ] Confirm the active entry is represented correctly when clocked in.
- [ ] Confirm Missing Time and My Correction Requests navigation works.

## Time Correction Request

- [ ] Open Request Time Correction from a completed entry.
- [ ] Submit a valid wrong-time or other supported correction with a synthetic reason.
- [ ] Confirm success returns from the form and the pending state appears after refresh.
- [ ] Submit a missing-time request using the Missing Time entry point.
- [ ] Open My Correction Requests and confirm request type, status, submitted date, requested details, and reason are readable.
- [ ] Confirm the ineligible account cannot select Drive Time where capability gating applies.

## Settings and Legal Links

- [ ] Confirm Settings identifies the signed-in account without exposing credentials or tokens.
- [ ] Open Privacy Policy and verify `https://www.oliveops.ca/privacy` loads successfully.
- [ ] Open Terms of Service and verify `https://www.oliveops.ca/terms` loads successfully.
- [ ] Open Support and confirm the composer targets `support@oliveops.ca`.
- [ ] Return from each external destination and confirm the app remains usable.

## Offline and Error Behavior

- [ ] Disable Wi-Fi and cellular and confirm the offline notice appears.
- [ ] From Login, attempt to sign in while offline; confirm no sign-in request succeeds and a reconnect message appears.
- [ ] Attempt Clock In, Switch Activity, Clock Out, photo upload, history/correction refresh, and correction submission as practical.
- [ ] Confirm each blocked network action shows a friendly offline/retry message and does not duplicate a request.
- [ ] Re-enable connectivity and manually retry; confirm the action succeeds.
- [ ] Confirm no action claims to have queued or background-synced while offline; that behavior is not implemented.
- [ ] Confirm no raw backend error, stack trace, token, URL signature, storage-provider detail, or HTTP status is shown to the user.

## Final Acceptance

- [ ] No crash, hang, blank screen, or broken navigation was observed.
- [ ] No placeholder icon or launch artwork remains.
- [ ] No text is clipped on the smallest supported iPhone used for testing.
- [ ] Production API data is synthetic and correctly scoped to the signed-in employee.
- [ ] Camera/library use is optional and clearly explained.
- [ ] All App Review walkthrough steps work with the submitted demo account.
- [ ] Record defects, reproduction steps, screenshots, and whether they block submission.

## Result

- Overall: Pass / Fail
- Blocking defects:
- Non-blocking defects:
- Retest build required:
- Sign-off:
