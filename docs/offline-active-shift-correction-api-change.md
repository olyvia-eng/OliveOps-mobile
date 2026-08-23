# Active Shift Forgot-Clock-Out Correction API Change

## Blocker

The backend currently rejects time correction requests targeting any entry whose status is not `clocked_out`.

In `olyvia-eng/OliveOps`, `api/_lib/timeCorrections.js` returns:

```text
Only historical clocked-out entries can be corrected.
```

This prevents recovery when an offline Clock Out becomes `needs_attention` while the mapped server entry is still active. The mobile app must not close the shift at the current time as a workaround because that changes the recorded timeline and loses the employee's immutable `clientOccurredAt` intent.

## Required Backend Capability

Extend `POST /api/clocking?action=time-correction-create` to accept an employee-owned active entry only when all of the following are true:

- `requestType` is `forgot_clock_out`.
- `timeEntryId` resolves to the authenticated employee's current active entry in the same business.
- `requestedClockOutAt` is present and valid.
- The requested time is after the active segment start.
- Existing employee correction-window, authorization, idempotency, and validation rules still pass.

Creating the request must not immediately mutate or close the active shift. Approval must atomically close the authoritative active shift at `requestedClockOutAt`, update the active-shift pointer, and preserve audit history. Approval must reject if the active shift changed after request creation unless the operation is already idempotently complete.

## Response Contract

No new mobile response shape is required. A successful create response remains:

```json
{
  "ok": true,
  "correction": {
    "id": "correction-id",
    "timeEntryId": "active-entry-id",
    "requestType": "forgot_clock_out",
    "status": "pending"
  }
}
```

## Required Backend Tests

- Employee can create `forgot_clock_out` against their own active entry.
- Another employee or business receives `403` or `404` according to existing authorization policy.
- Other correction types remain blocked for active entries.
- Missing, future, stale, or pre-segment `requestedClockOutAt` values retain existing validation behavior.
- Approval closes the same active shift atomically at the requested time.
- Approval conflicts if the active shift changed.
- Duplicate create and approve requests remain idempotent.