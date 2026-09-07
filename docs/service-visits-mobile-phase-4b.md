# Service Visits Mobile Phase 4B

This release adds employee Service Visit operations to OliveOps Mobile while preserving the existing Project, Drive Time, Non-Billable, Forms, SOP, Training, history, correction, and offline clocking workflows.

## Canonical Work Identity

Service Visit work remains Job Work. Mobile always sends:

```json
{
  "workType": "job",
  "jobIds": ["job-id"],
  "serviceId": "service-id",
  "serviceVisitId": "visit-id"
}
```

The immutable identity is `jobId + serviceId + serviceVisitId`. It is retained in clock-in and switch requests, pending mandatory Form workflows, Form submissions and attachments, Time Entries, offline clock commands, and post-clock-out Forms. Project work continues to use Work Areas. Service Visit work never sends a Work Area. Drive Time and Non-Billable work clear both Service IDs.

The existing effective clock state remains the only running timer. `activeTimeEntry` from bootstrap is authoritative, including its `jobName`, `serviceName`, and `propertyName` snapshots.

## Employee Flow

Home shows compact Today and Upcoming Visit sections from the bootstrap horizon. A Visit opens an operational detail screen containing:

- Service, property, address, schedule, crew, and Visit status
- Start Work or View Active Shift
- Visit-scoped Forms
- exact-version SOP links
- Visit photos and notes
- server-derived completion requirements
- explicit Complete Visit

Start Work uses the existing clock-in endpoint. Clock Out closes the linked Time Entry but never completes the Visit. After clock-out and any required Forms, mobile returns to the Visit so completion remains a separate employee decision.

Visit status, completion requirements, evidence counts, and authorization are always refreshed from the server. Mobile does not infer a completed Visit.

## Forms And SOPs

Visit Forms use the employee Forms endpoints with all three identity fields. The tuple is included in route matching, submission identity, retry payloads, mandatory clock workflows, and durable Form-photo metadata.

Visit SOP associations route through the existing authorized SOP viewers. Mobile sends the Visit summary's expected version and refuses to show a different cached or current version. Employees return to the Visit and refresh when the published version changes.

## Durable Visit Operations

Notes, photos, and completion use stable client IDs and an ordered SQLite outbox in the existing `oliveops-offline-clock.db` database. Every operation is saved before its first network attempt.

Visit photos are normalized to JPEG, copied into app-owned document storage, and limited to 8 MB. Prepared upload metadata is persisted. A failed or ambiguous upload resumes with the same valid file ID; local bytes are deleted only after storage completion is acknowledged.

The outbox replays on authenticated app launch, foreground, reconnect, and Visit refresh. Operations replay in creation order, so queued notes and photos are acknowledged before a later completion request. The first failed operation blocks later operations to preserve ordering. Machine-readable completion conflicts remain visible on the Visit and retry with the same client submission ID after refresh.

Queued notes and photos count toward local completion readiness while offline. The server still rechecks Forms, photos, notes, active Time Entries, assignment, tuple integrity, and Visit revision before accepting completion.

## Offline Schema

Offline clock schema version 3 adds cached Today and Upcoming Visit summaries. Versions 1 and 2 remain replayable. Unsupported future versions continue to enter the existing needs-attention flow.

Cached Visit summaries support offline Visit selection and preserve Service/property context. Offline clock commands retain Service IDs only for Job Work. Synthetic active entries carry Service and property snapshots through restart and replay.

## API Surface

- `GET /api/bootstrap`
- `GET /api/service-visits?action=detail&jobId={jobId}&visitId={visitId}`
- `POST /api/service-visits?action=add-note&jobId={jobId}&visitId={visitId}`
- `POST /api/service-visits?action=complete&jobId={jobId}&visitId={visitId}`
- existing clock-in, switch-activity, clock-out, employee Forms, SOP, and storage endpoints

Mobile maps the exact Visit completion codes from the backend contract and does not introduce a `service` Time Entry work type.

## Validation

Focused coverage includes API contracts, bootstrap merge, state stores, pending clock workflows, offline clock replay and migration, Form context and attachments, Home, Visit detail, Clock In, Switch Activity, Active Shift, Clock Out, Time History, Time Entry Detail, SOP viewers, and the durable Visit outbox.
