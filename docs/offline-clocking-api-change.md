# Offline Clocking API Change

## Status

This contract is deployed and production-verified. Offline Clocking Phase 1 uses the optional `clientOccurredAt` field described here for durable replay with the employee's original event time.

## Compatibility

Add one optional field to each existing request:

```ts
clientOccurredAt?: string;
```

The value is an RFC 3339/ISO 8601 UTC instant, for example `2026-08-20T20:32:14.238Z`.

When omitted, retain the current server-time behavior. Existing web and mobile clients therefore remain compatible. When provided and valid, use it as the business event time and retain the server receipt time separately.

Do not accept a local wall-time string without an offset. Do not accept a business ID, employee ID, or tenant scope from this field or from offline queue metadata as authorization evidence.

## Endpoints

### Clock In

`POST /api/clocking?action=clock-in`

```json
{
  "employeeId": "employee-id",
  "workType": "job",
  "jobIds": ["job-id"],
  "unbillableCategoryId": null,
  "requestId": "stable-request-id",
  "idempotencyKey": "stable-idempotency-key",
  "clientOccurredAt": "2026-08-20T11:02:00.000Z"
}
```

The authenticated session remains authoritative. Validate that any retained `employeeId` matches the active employee derived from authentication. When valid, set the new shift's `clockIn` to `clientOccurredAt` rather than server receipt time.

### Switch Activity

`POST /api/clocking?action=switch-activity`

```json
{
  "workType": "drive_time",
  "jobIds": [],
  "requestId": "stable-request-id",
  "idempotencyKey": "stable-idempotency-key",
  "clientOccurredAt": "2026-08-20T16:30:00.000Z"
}
```

Resolve the employee and active shift from the authenticated session. Use `clientOccurredAt` as both the end of the previous activity segment and the start of the next segment. Perform both changes atomically.

The current endpoint does not require an entry ID. This permits a queued switch to follow a queued Clock In after sequential replay, once Clock In has established the active server shift.

### Clock Out

`POST /api/clocking?action=clock-out`

```json
{
  "entryId": "resolved-server-entry-id",
  "breakMinutes": 0,
  "notes": "",
  "requestId": "stable-request-id",
  "idempotencyKey": "stable-idempotency-key",
  "clientOccurredAt": "2026-08-20T20:32:00.000Z"
}
```

Authorize `entryId` against the authenticated employee and business. Use `clientOccurredAt` as the shift's `clockOut` time. Offline Clocking Phase 1 will not include photo IDs in an offline Clock Out command.

For a shift created by an earlier queued Clock In, the mobile queue will persist a `localShiftId`, map it to the returned server entry ID after Clock In succeeds, and then substitute that server ID into Clock Out. The client must never invent a server entry ID.

## Timestamp Validation

For requests that include `clientOccurredAt`, the server must perform all of the following before mutating clock state:

1. Parse a timezone-qualified RFC 3339 instant and normalize it to UTC.
2. Capture `serverReceivedAt` independently using the server clock.
3. Reject a timestamp more than 5 minutes after `serverReceivedAt`.
4. Reject a timestamp more than 24 hours before `serverReceivedAt`. Older events must use the time-correction workflow.
5. Enforce the authenticated employee's timeline ordering.
6. Clock In must occur after the employee's last completed clock event and only when no server-active shift exists.
7. Switch Activity must occur after the active segment's start and while an active shift exists.
8. Clock Out must occur after the active shift/segment start and while that authorized shift is active.
9. Reject overlap with, or inversion of, any existing employee time entry or activity segment.
10. Revalidate current job assignment, job status, activity availability, and unbillable category authorization at sync time.

The deployed Phase 1 policy allows a 5-minute future tolerance and a 24-hour offline age. These bounds are enforced server-side, not inferred by the mobile app.

Do not shift, clamp, or rewrite a rejected timestamp. Preserve the original request for correction evidence.

## Error Contract

Return stable machine-readable codes without exposing internal details:

| Status | Code | Meaning |
|---|---|---|
| 400 | `offline_event_invalid_timestamp` | Missing offset, malformed value, or invalid instant |
| 409 | `clock_idempotency_conflict` | Same idempotency key with a different normalized payload or timestamp |
| 409 | `offline_event_order_conflict` | Event conflicts with the employee timeline ordering |
| 409 | `offline_shift_state_conflict` | Required active/inactive state changed, including another-device mutation |
| 403 | `offline_job_unauthorized` | Job is no longer authorized for the employee |
| 422 | `offline_event_too_old` | Event is more than 24 hours old |
| 422 | `offline_event_in_future` | Event is beyond the 5-minute future tolerance |

Include a safe user-facing `error` string. The mobile client will preserve rejected commands as `needs_attention` and direct the employee to Time Corrections where appropriate.

## Idempotency

`clientOccurredAt` must be included in the canonical idempotency fingerprint after UTC normalization. The fingerprint must also continue to include every logical mutation field used by the existing production contract.

Required behavior:

- The first request stores the normalized fingerprint and complete successful response.
- A retry with the same key and same normalized payload returns the original successful response, including original IDs and event timestamps.
- A retry after the server committed but the client lost the response is reported as success/replay, not as a second mutation.
- The same key with a changed `clientOccurredAt` or other logical field returns `409 CLOCK_IDEMPOTENCY_CONFLICT`.
- Idempotency records remain scoped to the authenticated employee/business and cannot be replayed across identities.
- Retention must be at least the accepted 24-hour offline age window plus retry margin.

## Success Response

Keep the existing `timeEntry` response and add mutation metadata:

```json
{
  "ok": true,
  "timeEntry": {},
  "mutation": {
    "idempotencyKey": "stable-idempotency-key",
    "clientOccurredAt": "2026-08-20T20:32:00.000Z",
    "serverReceivedAt": "2026-08-20T22:05:03.100Z",
    "replayed": false
  }
}
```

On replay, return the same resulting `timeEntry`, original `clientOccurredAt`, and original `serverReceivedAt`, with `replayed: true`. Do not replace event time or receipt time with retry time.

## Bootstrap Reconciliation

`GET /api/bootstrap` must continue returning the authoritative employee-scoped timeline and `currentActiveEntryId` after queued commands sync.

For reliable reconciliation:

- Returned `TimeEntry.clockIn` and `clockOut` must reflect validated business event times.
- Activity segments produced by Switch Activity must reflect each validated event time in order.
- A successful mutation response must be sufficient to map a mobile `localShiftId` to `timeEntry.id` before dependent commands are sent.
- Bootstrap must never echo client-provided tenant scope as authority.
- A routine bootstrap cannot confirm a still-local command; the mobile app will overlay pending local intent until the corresponding mutation succeeds/replays.

No queue payload or local shift ID needs to become a server authorization primitive. If `localShiftId` is accepted for diagnostics, treat it as opaque, optional, non-authoritative metadata and exclude it from ownership decisions.

## Transaction and Ordering Requirements

Commands are sent sequentially per employee, but the server must still enforce ordering transactionally because another device or administrator may mutate state between commands.

- Lock or otherwise serialize the authenticated employee's clock state while applying each mutation.
- Validate state and write the event in one transaction.
- Switch Activity must close and open segments atomically.
- Store event time, server receipt time, request ID, idempotency key, and authenticated actor in audit data.
- Never accept later queued commands merely because an earlier idempotency key exists; each command must independently pass authorization and timeline validation.

## Production Verification Matrix

Before mobile implementation resumes, verify against the deployed production API:

1. Clock In with valid `clientOccurredAt` records that instant and separately records receipt time.
2. Switch Activity uses the supplied instant for both segment boundaries.
3. Clock Out uses the supplied instant rather than receipt time.
4. Omitting the field preserves current behavior.
5. Same-key retry returns the original response and does not duplicate a mutation.
6. Same key with changed timestamp returns `CLOCK_IDEMPOTENCY_CONFLICT`.
7. Future, stale, malformed, inverted, and overlapping times are rejected with stable codes.
8. Unauthorized jobs, categories, employees, tenants, and entry IDs remain rejected.
9. A sequence of Clock In, multiple switches, and Clock Out produces an ordered timeline using original event times.
10. A partial sequence stops safely at the first conflict; later commands are not applied by the client.
11. Another-device clock state changes produce a conflict rather than timeline rewriting.
12. Bootstrap after success/replay returns the resulting authoritative event-time state.

## Mobile Work After Backend Deployment

The deployed contract allows mobile to safely implement:

- A versioned, identity-scoped durable command queue without tokens or full API responses.
- Immutable absolute `eventOccurredAt` and separate queue/sync timestamps.
- Stable per-command request and idempotency keys.
- A persisted `localShiftId` to server entry-ID mapping.
- Sequential per-employee sync with bounded retry and conflict blocking.
- Effective local clock state overlaid on bootstrap state.
- Cached minimal authorized job/category labels with freshness metadata.
- Pending, synced, and needs-attention UI plus manual retry.
- Logout warning and queue isolation across employees.

The mobile client still treats all queued changes as pending until the server confirms or replays them.
