import type { ReconcileCurrentShiftWorkAreaSegment } from '@/types/api';
import type { Job, TimeEntry, TimeEntryWorkType } from '@/types/domain';

export type WorkAreaTimelineDraftSegment = {
  draftId: string;
  sourceEntryId: string;
  workType: TimeEntryWorkType;
  jobId: string | null;
  workAreaId: string | null;
  workAreaName: string | null;
  startAt: string;
  endAt: string | null;
  editable: boolean;
};

function entryJobId(entry: TimeEntry) {
  return entry.jobId ?? entry.jobIds?.[0] ?? null;
}

export function createWorkAreaTimelineDraft(timeline: TimeEntry[]): WorkAreaTimelineDraftSegment[] {
  return [...timeline]
    .sort((left, right) => Date.parse(left.clockIn) - Date.parse(right.clockIn))
    .map((entry) => ({
      draftId: `source:${entry.id}`,
      sourceEntryId: entry.id,
      workType: entry.workType,
      jobId: entryJobId(entry),
      workAreaId: entry.workAreaId ?? null,
      workAreaName: entry.workAreaNameSnapshot ?? null,
      startAt: entry.clockIn,
      endAt: entry.clockOut ?? null,
      editable: entry.workType === 'job' && Boolean(entryJobId(entry)),
    }));
}

export function isEditableSharedBoundary(draft: WorkAreaTimelineDraftSegment[], boundaryIndex: number) {
  const previous = draft[boundaryIndex - 1];
  const next = draft[boundaryIndex];
  return Boolean(previous?.editable && next?.editable && previous.jobId === next.jobId);
}

export function changeSharedBoundary(
  draft: WorkAreaTimelineDraftSegment[],
  boundaryIndex: number,
  boundaryAt: string,
) {
  if (!isEditableSharedBoundary(draft, boundaryIndex)) return draft;
  const previous = draft[boundaryIndex - 1];
  const next = draft[boundaryIndex];
  const boundaryMs = Date.parse(boundaryAt);
  if (!Number.isFinite(boundaryMs)
    || boundaryMs <= Date.parse(previous.startAt)
    || (next.endAt && boundaryMs >= Date.parse(next.endAt))) return draft;
  return draft.map((segment, index) => index === boundaryIndex - 1
    ? { ...segment, endAt: boundaryAt }
    : index === boundaryIndex
      ? { ...segment, startAt: boundaryAt }
      : segment);
}

export function splitWorkAreaSegment(
  draft: WorkAreaTimelineDraftSegment[],
  segmentIndex: number,
  boundaryAt: string,
  workArea: { id: string; name: string },
) {
  const segment = draft[segmentIndex];
  const boundaryMs = Date.parse(boundaryAt);
  const effectiveEndMs = segment?.endAt ? Date.parse(segment.endAt) : Date.now();
  if (!segment?.editable || !Number.isFinite(boundaryMs)
    || boundaryMs <= Date.parse(segment.startAt) || boundaryMs >= effectiveEndMs) return draft;
  const first = { ...segment, endAt: boundaryAt };
  const second = {
    ...segment,
    draftId: `draft:${segment.sourceEntryId}:${boundaryAt}`,
    workAreaId: workArea.id,
    workAreaName: workArea.name,
    startAt: boundaryAt,
  };
  return [...draft.slice(0, segmentIndex), first, second, ...draft.slice(segmentIndex + 1)];
}

export function changeDraftWorkArea(
  draft: WorkAreaTimelineDraftSegment[],
  segmentIndex: number,
  workArea: { id: string; name: string },
) {
  if (!draft[segmentIndex]?.editable) return draft;
  return draft.map((segment, index) => index === segmentIndex
    ? { ...segment, workAreaId: workArea.id, workAreaName: workArea.name }
    : segment);
}

export function eligibleWorkAreasForSegment(segment: WorkAreaTimelineDraftSegment, jobs: Job[]) {
  if (!segment.editable || !segment.jobId) return [];
  return jobs.find((job) => job.id === segment.jobId)?.eligibleOperationalWorkAreas ?? [];
}

export function serializeEditableWorkAreaSegments(draft: WorkAreaTimelineDraftSegment[]): ReconcileCurrentShiftWorkAreaSegment[] {
  return draft.flatMap((segment) => segment.editable && segment.jobId && segment.workAreaId ? [{
    jobId: segment.jobId,
    workAreaId: segment.workAreaId,
    startAt: segment.startAt,
    endAt: segment.endAt,
  }] : []);
}

export function workAreaTimelineDraftFingerprint(draft: WorkAreaTimelineDraftSegment[]) {
  return JSON.stringify(serializeEditableWorkAreaSegments(draft));
}

export function segmentDurationMinutes(segment: WorkAreaTimelineDraftSegment, nowMs = Date.now()) {
  const endMs = segment.endAt ? Date.parse(segment.endAt) : nowMs;
  return Math.max(0, Math.floor((endMs - Date.parse(segment.startAt)) / 60000));
}

export function defaultSplitAt(segment: WorkAreaTimelineDraftSegment, nowMs = Date.now()) {
  const startMs = Date.parse(segment.startAt);
  const endMs = segment.endAt ? Date.parse(segment.endAt) : nowMs;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs - startMs < 120000) return null;
  const proposed = segment.endAt ? startMs + Math.floor((endMs - startMs) / 2) : endMs - 60000;
  return new Date(Math.max(startMs + 60000, Math.min(endMs - 60000, proposed))).toISOString();
}

export function replaceCurrentShiftTimeline(
  allEntries: TimeEntry[],
  previousTimeline: TimeEntry[],
  authoritativeTimeline: TimeEntry[],
) {
  const replacedIds = new Set(previousTimeline.map((entry) => entry.id));
  return [...authoritativeTimeline, ...allEntries.filter((entry) => !replacedIds.has(entry.id))];
}