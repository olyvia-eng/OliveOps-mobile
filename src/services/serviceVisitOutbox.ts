import { Directory, File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as SQLite from 'expo-sqlite';
import { addServiceVisitNote, completeServiceVisit } from '@/api/serviceVisitsApi';
import { completeUpload, deleteUploadedFile, prepareUpload, uploadUriToS3 } from '@/api/storageApi';
import { ApiError } from '@/types/errors';

const DATABASE_NAME = 'oliveops-offline-clock.db';
const PHOTO_DIRECTORY = new Directory(Paths.document, 'service-visit-attachments');
const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
let databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;
const replayPromises = new Map<string, Promise<ServiceVisitOutboxOperation[]>>();

export type ServiceVisitOutboxStatus = 'pending' | 'failed';
export type ServiceVisitOutboxOperation = {
  id: string;
  identityKey: string;
  type: 'note' | 'photo' | 'complete';
  jobId: string;
  serviceId: string;
  serviceVisitId: string;
  clientSubmissionId: string;
  text?: string;
  localUri?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  fileId?: string;
  uploadUrl?: string;
  uploadExpiresAt?: string;
  requiredHeaders?: Record<string, string>;
  status: ServiceVisitOutboxStatus;
  errorCode?: string;
  error?: string;
  queuedAt: string;
  updatedAt: string;
};

function operationId(type: ServiceVisitOutboxOperation['type']) {
  return `visit-${type}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
}

async function database() {
  if (!databasePromise) databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  const db = await databasePromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS service_visit_outbox (
      id TEXT PRIMARY KEY NOT NULL,
      identity_key TEXT NOT NULL,
      service_visit_id TEXT NOT NULL,
      queued_at TEXT NOT NULL,
      status TEXT NOT NULL,
      operation_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS service_visit_outbox_identity_order
      ON service_visit_outbox(identity_key, queued_at, id);
    CREATE INDEX IF NOT EXISTS service_visit_outbox_visit
      ON service_visit_outbox(identity_key, service_visit_id, queued_at, id);
  `);
  return db;
}

async function save(operation: ServiceVisitOutboxOperation) {
  const db = await database();
  await db.runAsync(
    `INSERT INTO service_visit_outbox
      (id, identity_key, service_visit_id, queued_at, status, operation_json)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET status = excluded.status, operation_json = excluded.operation_json`,
    operation.id,
    operation.identityKey,
    operation.serviceVisitId,
    operation.queuedAt,
    operation.status,
    JSON.stringify(operation),
  );
  return operation;
}

async function remove(operation: ServiceVisitOutboxOperation) {
  const db = await database();
  await db.runAsync('DELETE FROM service_visit_outbox WHERE id = ? AND identity_key = ?', operation.id, operation.identityKey);
  if (operation.localUri) {
    const file = new File(operation.localUri);
    if (file.exists) file.delete();
  }
}

export async function loadServiceVisitOutbox(identityKey: string, serviceVisitId?: string) {
  const db = await database();
  const rows = serviceVisitId
    ? await db.getAllAsync<{ operation_json: string }>(
      `SELECT operation_json FROM service_visit_outbox
       WHERE identity_key = ? AND service_visit_id = ?
       ORDER BY queued_at ASC, id ASC`,
      identityKey,
      serviceVisitId,
    )
    : await db.getAllAsync<{ operation_json: string }>(
      `SELECT operation_json FROM service_visit_outbox
       WHERE identity_key = ?
       ORDER BY queued_at ASC, id ASC`,
      identityKey,
    );
  return rows.map((row) => JSON.parse(row.operation_json) as ServiceVisitOutboxOperation);
}

export async function queueServiceVisitNote(input: {
  identityKey: string;
  jobId: string;
  serviceId: string;
  serviceVisitId: string;
  clientSubmissionId: string;
  text: string;
}) {
  const now = new Date().toISOString();
  return save({ ...input, id: operationId('note'), type: 'note', status: 'pending', queuedAt: now, updatedAt: now });
}

export async function queueServiceVisitCompletion(input: {
  identityKey: string;
  jobId: string;
  serviceId: string;
  serviceVisitId: string;
  clientSubmissionId: string;
}) {
  const existing = (await loadServiceVisitOutbox(input.identityKey, input.serviceVisitId))
    .find((operation) => operation.type === 'complete');
  if (existing) return existing;
  const now = new Date().toISOString();
  return save({ ...input, id: operationId('complete'), type: 'complete', status: 'pending', queuedAt: now, updatedAt: now });
}

export async function queueServiceVisitPhoto(input: {
  identityKey: string;
  jobId: string;
  serviceId: string;
  serviceVisitId: string;
  clientSubmissionId: string;
  sourceUri: string;
}) {
  const id = operationId('photo');
  const normalized = await manipulateAsync(input.sourceUri, [{ resize: { width: 1600 } }], { compress: 0.8, format: SaveFormat.JPEG });
  if (!PHOTO_DIRECTORY.exists) PHOTO_DIRECTORY.create({ idempotent: true, intermediates: true });
  const destination = new File(PHOTO_DIRECTORY, `${id.replaceAll(':', '-')}.jpg`);
  await new File(normalized.uri).copy(destination);
  if (!destination.exists || destination.size <= 0 || destination.size > PHOTO_MAX_BYTES) {
    if (destination.exists) destination.delete();
    throw new Error('The selected photo is too large. Choose a smaller photo and try again.');
  }
  const now = new Date().toISOString();
  return save({
    id,
    identityKey: input.identityKey,
    type: 'photo',
    jobId: input.jobId,
    serviceId: input.serviceId,
    serviceVisitId: input.serviceVisitId,
    clientSubmissionId: input.clientSubmissionId,
    localUri: destination.uri,
    fileName: `${id.replaceAll(':', '-')}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: destination.size,
    status: 'pending',
    queuedAt: now,
    updatedAt: now,
  });
}

async function replayPhoto(operation: ServiceVisitOutboxOperation, accessToken?: string) {
  if (!operation.localUri || !operation.fileName || !operation.mimeType || !operation.sizeBytes) {
    throw new Error('The saved Visit photo is incomplete. Remove it and add the photo again.');
  }
  if (!new File(operation.localUri).exists) throw new Error('The saved Visit photo is no longer available on this device.');
  let current = operation;
  if (!current.fileId || !current.uploadUrl || !current.uploadExpiresAt || Date.parse(current.uploadExpiresAt) <= Date.now()) {
    if (current.fileId) {
      try {
        await completeUpload(current.fileId, accessToken);
        return;
      } catch {
        try { await deleteUploadedFile(current.fileId, accessToken); } catch { /* Pending metadata expires server-side. */ }
      }
    }
    const prepared = await prepareUpload({
      action: 'prepare-upload',
      fileName: current.fileName!,
      mimeType: current.mimeType!,
      sizeBytes: current.sizeBytes!,
      entityType: 'service-visit',
      entityId: current.serviceVisitId,
      category: 'photo',
      jobId: current.jobId,
      serviceId: current.serviceId,
      serviceVisitId: current.serviceVisitId,
    }, accessToken);
    if (!prepared.fileId || !prepared.uploadUrl || !prepared.expiresAt) throw new Error('Photo upload could not be prepared.');
    current = await save({
      ...current,
      fileId: prepared.fileId,
      uploadUrl: prepared.uploadUrl,
      uploadExpiresAt: prepared.expiresAt,
      requiredHeaders: prepared.requiredHeaders,
      error: undefined,
      errorCode: undefined,
      status: 'pending',
      updatedAt: new Date().toISOString(),
    });
  }
  try {
    await completeUpload(current.fileId!, accessToken);
  } catch {
    await uploadUriToS3(current.uploadUrl!, current.localUri!, current.mimeType!, current.requiredHeaders);
    await completeUpload(current.fileId!, accessToken);
  }
}

export function replayServiceVisitOutbox(identityKey: string, accessToken?: string) {
  const existing = replayPromises.get(identityKey);
  if (existing) return existing;
  const run = async () => {
    const operations = await loadServiceVisitOutbox(identityKey);
    for (const operation of operations) {
      try {
        if (operation.type === 'note') {
          await addServiceVisitNote(operation.jobId, {
            serviceId: operation.serviceId,
            visitId: operation.serviceVisitId,
            clientSubmissionId: operation.clientSubmissionId,
            text: operation.text!,
          }, accessToken);
        } else if (operation.type === 'photo') {
          await replayPhoto(operation, accessToken);
        } else {
          await completeServiceVisit(operation.jobId, {
            serviceId: operation.serviceId,
            visitId: operation.serviceVisitId,
            clientSubmissionId: operation.clientSubmissionId,
          }, accessToken);
        }
        await remove(operation);
      } catch (error) {
        const latest = (await loadServiceVisitOutbox(identityKey, operation.serviceVisitId))
          .find((candidate) => candidate.id === operation.id) ?? operation;
        await save({
          ...latest,
          status: 'failed',
          errorCode: error instanceof ApiError ? error.code : undefined,
          error: error instanceof Error ? error.message : 'This Visit change could not sync.',
          updatedAt: new Date().toISOString(),
        });
        break;
      }
    }
    return loadServiceVisitOutbox(identityKey);
  };
  const promise = run().finally(() => replayPromises.delete(identityKey));
  replayPromises.set(identityKey, promise);
  return promise;
}

export function resetServiceVisitOutboxForTests() {
  databasePromise = null;
  replayPromises.clear();
}
