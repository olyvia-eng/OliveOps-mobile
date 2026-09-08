import * as SQLite from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { completeSnowRoute, runSnowFieldCommand, startSnowRoute } from '@/api/snowOperationsApi';
import { completeUpload, deleteUploadedFile, prepareUpload, uploadUriToS3 } from '@/api/storageApi';
import { ApiError } from '@/types/errors';
import type { SnowBreadcrumbPoint, SnowCommandBase, SnowCommandContext, SnowFieldAction } from '@/types/snowOperations';

const DATABASE_NAME = 'oliveops-offline-clock.db';
const PHOTO_DIRECTORY = new Directory(Paths.document, 'snow-operation-attachments');
const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
let databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;
const replayPromises = new Map<string, Promise<SnowOutboxOperation[]>>();

export interface SnowOutboxOperation {
  id: string;
  identityKey: string;
  action: SnowFieldAction | 'start-route' | 'complete-route';
  context: SnowCommandContext;
  payload: SnowCommandBase & { serviceTypeId?: string; fileId?: string; reason?: string; points?: SnowBreadcrumbPoint[] };
  localUri?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  fileId?: string;
  uploadUrl?: string;
  uploadExpiresAt?: string;
  requiredHeaders?: Record<string, string>;
  status: 'pending' | 'failed';
  errorCode?: string;
  error?: string;
  queuedAt: string;
  updatedAt: string;
}

export function snowSubmissionId(action: SnowOutboxOperation['action']) {
  return `${action}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
}

async function database() {
  if (!databasePromise) databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  const db = await databasePromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS snow_operations_outbox (
      id TEXT PRIMARY KEY NOT NULL,
      identity_key TEXT NOT NULL,
      queued_at TEXT NOT NULL,
      status TEXT NOT NULL,
      operation_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS snow_operations_outbox_identity_order
      ON snow_operations_outbox(identity_key, queued_at, id);
  `);
  return db;
}

async function save(operation: SnowOutboxOperation) {
  const db = await database();
  await db.runAsync(
    `INSERT INTO snow_operations_outbox (id, identity_key, queued_at, status, operation_json)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET status = excluded.status, operation_json = excluded.operation_json`,
    operation.id, operation.identityKey, operation.queuedAt, operation.status, JSON.stringify(operation),
  );
  return operation;
}

export async function loadSnowOutbox(identityKey: string) {
  const db = await database();
  const rows = await db.getAllAsync<{ operation_json: string }>(
    `SELECT operation_json FROM snow_operations_outbox
     WHERE identity_key = ? ORDER BY queued_at ASC, id ASC`,
    identityKey,
  );
  return rows.map((row) => JSON.parse(row.operation_json) as SnowOutboxOperation);
}

export async function queueSnowCommand(input: {
  identityKey: string;
  action: SnowOutboxOperation['action'];
  context: SnowCommandContext;
  payload: SnowOutboxOperation['payload'];
}) {
  const existing = (await loadSnowOutbox(input.identityKey)).find((item) => item.id === input.payload.clientSubmissionId);
  if (existing) return existing;
  const now = new Date().toISOString();
  return save({ ...input, id: input.payload.clientSubmissionId, status: 'pending', queuedAt: now, updatedAt: now });
}

export async function queueSnowBreadcrumbPoints(input: {
  identityKey: string;
  context: SnowCommandContext;
  points: SnowBreadcrumbPoint[];
}) {
  const chunks: SnowBreadcrumbPoint[][] = [];
  for (let index = 0; index < input.points.length; index += 100) chunks.push(input.points.slice(index, index + 100));
  for (const points of chunks) {
    const clientSubmissionId = snowSubmissionId('breadcrumbs');
    await queueSnowCommand({
      identityKey: input.identityKey,
      action: 'breadcrumbs',
      context: input.context,
      payload: { clientSubmissionId, points },
    });
  }
}

export async function queueSnowPhoto(input: {
  identityKey: string;
  action: 'before-photo' | 'after-photo';
  context: SnowCommandContext;
  clientSubmissionId: string;
  sourceUri: string;
  checkpoint: Omit<SnowCommandBase, 'clientSubmissionId'>;
}) {
  if (!input.context.stopId || !input.context.occurrenceId) throw new Error('Snow photo context is incomplete.');
  const normalized = await manipulateAsync(input.sourceUri, [{ resize: { width: 1600 } }], { compress: 0.8, format: SaveFormat.JPEG });
  if (!PHOTO_DIRECTORY.exists) PHOTO_DIRECTORY.create({ idempotent: true, intermediates: true });
  const destination = new File(PHOTO_DIRECTORY, `${input.clientSubmissionId.replaceAll(':', '-')}.jpg`);
  await new File(normalized.uri).copy(destination);
  if (!destination.exists || destination.size <= 0 || destination.size > PHOTO_MAX_BYTES) {
    if (destination.exists) destination.delete();
    throw new Error('The selected Snow photo is too large. Choose a smaller photo and try again.');
  }
  const operation = await queueSnowCommand({
    identityKey: input.identityKey,
    action: input.action,
    context: input.context,
    payload: { clientSubmissionId: input.clientSubmissionId, ...input.checkpoint },
  });
  return save({
    ...operation,
    localUri: destination.uri,
    fileName: `${input.clientSubmissionId.replaceAll(':', '-')}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: destination.size,
  });
}

async function replayPhoto(operation: SnowOutboxOperation, accessToken?: string) {
  if (!operation.localUri || !operation.fileName || !operation.mimeType || !operation.sizeBytes || !operation.context.stopId || !operation.context.occurrenceId) {
    throw new Error('The saved Snow photo is incomplete.');
  }
  if (!new File(operation.localUri).exists) throw new Error('The saved Snow photo is no longer available on this device.');
  let current = operation;
  if (!current.fileId || !current.uploadUrl || !current.uploadExpiresAt || Date.parse(current.uploadExpiresAt) <= Date.now()) {
    if (current.fileId) {
      try {
        await completeUpload(current.fileId, accessToken);
        return runSnowFieldCommand(current.action as 'before-photo' | 'after-photo', current.context, { ...current.payload, fileId: current.fileId }, accessToken);
      } catch {
        try { await deleteUploadedFile(current.fileId, accessToken); } catch { /* Pending metadata expires server-side. */ }
      }
    }
    const prepared = await prepareUpload({
      action: 'prepare-upload',
      fileName: current.fileName!,
      mimeType: current.mimeType!,
      sizeBytes: current.sizeBytes!,
      entityType: 'snow-occurrence',
      entityId: current.context.occurrenceId!,
      category: current.action as 'before-photo' | 'after-photo',
      snowEventId: current.context.eventId,
      snowRouteId: current.context.routeId,
      routeStopId: current.context.stopId,
    }, accessToken);
    if (!prepared.fileId || !prepared.uploadUrl || !prepared.expiresAt) throw new Error('Snow photo upload could not be prepared.');
    current = await save({
      ...current,
      fileId: prepared.fileId,
      uploadUrl: prepared.uploadUrl,
      uploadExpiresAt: prepared.expiresAt,
      requiredHeaders: prepared.requiredHeaders,
      status: 'pending',
      error: undefined,
      errorCode: undefined,
      updatedAt: new Date().toISOString(),
    });
  }
  try {
    await completeUpload(current.fileId!, accessToken);
  } catch {
    await uploadUriToS3(current.uploadUrl!, current.localUri!, current.mimeType!, current.requiredHeaders);
    await completeUpload(current.fileId!, accessToken);
  }
  return runSnowFieldCommand(current.action as 'before-photo' | 'after-photo', current.context, { ...current.payload, fileId: current.fileId }, accessToken);
}

async function send(operation: SnowOutboxOperation, accessToken?: string) {
  if ((operation.action === 'before-photo' || operation.action === 'after-photo') && operation.localUri) {
    return replayPhoto(operation, accessToken);
  }
  if (operation.action === 'start-route') {
    return startSnowRoute(operation.context, operation.payload, accessToken);
  }
  if (operation.action === 'complete-route') {
    return completeSnowRoute(operation.context, operation.payload, accessToken);
  }
  return runSnowFieldCommand(operation.action, operation.context, operation.payload, accessToken);
}

export function replaySnowOutbox(identityKey: string, accessToken?: string) {
  const existing = replayPromises.get(identityKey);
  if (existing) return existing;
  const run = async () => {
    const db = await database();
    for (const operation of await loadSnowOutbox(identityKey)) {
      try {
        await send(operation, accessToken);
        await db.runAsync('DELETE FROM snow_operations_outbox WHERE id = ? AND identity_key = ?', operation.id, identityKey);
        if (operation.localUri) {
          const file = new File(operation.localUri);
          if (file.exists) file.delete();
        }
      } catch (error) {
        const latest = (await loadSnowOutbox(identityKey)).find((candidate) => candidate.id === operation.id) ?? operation;
        await save({
          ...latest,
          status: 'failed',
          errorCode: error instanceof ApiError ? error.code : undefined,
          error: error instanceof Error ? error.message : 'This Snow update could not sync.',
          updatedAt: new Date().toISOString(),
        });
        break;
      }
    }
    return loadSnowOutbox(identityKey);
  };
  const promise = run().finally(() => replayPromises.delete(identityKey));
  replayPromises.set(identityKey, promise);
  return promise;
}

export function resetSnowOutboxForTests() {
  databasePromise = null;
  replayPromises.clear();
}