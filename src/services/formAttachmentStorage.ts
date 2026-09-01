import { Directory, File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as SQLite from 'expo-sqlite';
import { completeUpload, deleteUploadedFile, prepareUpload, uploadUriToS3 } from '@/api/storageApi';
import type { LocalFormAttachment, SubmitEmployeeFormRequest } from '@/types/forms';

const DATABASE_NAME = 'oliveops-offline-clock.db';
const FORM_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
const PHOTO_DIRECTORY = new Directory(Paths.document, 'form-attachments');
let databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;

function attachmentId() {
  return `form-photo:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
}

async function database() {
  if (!databasePromise) databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  const db = await databasePromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS form_attachments (
      local_attachment_id TEXT PRIMARY KEY NOT NULL,
      identity_key TEXT NOT NULL,
      client_submission_id TEXT NOT NULL,
      field_id TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      record_json TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS form_attachments_submission_field
      ON form_attachments(identity_key, client_submission_id, field_id);
  `);
  return db;
}

async function save(record: LocalFormAttachment) {
  const db = await database();
  await db.runAsync(
    `INSERT INTO form_attachments
      (local_attachment_id, identity_key, client_submission_id, field_id, updated_at, record_json)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(identity_key, client_submission_id, field_id) DO UPDATE SET
       local_attachment_id = excluded.local_attachment_id,
       client_submission_id = excluded.client_submission_id,
       field_id = excluded.field_id,
       updated_at = excluded.updated_at,
       record_json = excluded.record_json`,
    record.localAttachmentId,
    record.identityKey,
    record.clientSubmissionId,
    record.fieldId,
    record.updatedAt,
    JSON.stringify(record),
  );
  return record;
}

export async function loadFormAttachments(identityKey: string, clientSubmissionId: string) {
  const db = await database();
  const rows = await db.getAllAsync<{ record_json: string }>(
    `SELECT record_json FROM form_attachments
     WHERE identity_key = ? AND client_submission_id = ?
     ORDER BY updated_at ASC`,
    identityKey,
    clientSubmissionId,
  );
  return rows.map((row) => JSON.parse(row.record_json) as LocalFormAttachment);
}

export async function createDurableFormPhoto(input: {
  identityKey: string;
  clientSubmissionId: string;
  formId: string;
  fieldId: string;
  sourceUri: string;
  workflowOccurrenceId?: string;
  workflowRequirementId?: string;
  jobId?: string;
  equipmentId?: string;
  divisionId?: string;
}) {
  const localAttachmentId = attachmentId();
  const normalized = await manipulateAsync(
    input.sourceUri,
    [{ resize: { width: 1600 } }],
    { compress: 0.8, format: SaveFormat.JPEG },
  );
  if (!PHOTO_DIRECTORY.exists) PHOTO_DIRECTORY.create({ idempotent: true, intermediates: true });
  const destination = new File(PHOTO_DIRECTORY, `${localAttachmentId.replaceAll(':', '-')}.jpg`);
  await new File(normalized.uri).copy(destination);
  if (!destination.exists || destination.size <= 0 || destination.size > FORM_PHOTO_MAX_BYTES) {
    if (destination.exists) destination.delete();
    throw new Error('The selected photo is too large. Choose a smaller photo and try again.');
  }
  const now = new Date().toISOString();
  return save({
    localAttachmentId,
    identityKey: input.identityKey,
    clientSubmissionId: input.clientSubmissionId,
    formId: input.formId,
    fieldId: input.fieldId,
    workflowOccurrenceId: input.workflowOccurrenceId,
    workflowRequirementId: input.workflowRequirementId,
    jobId: input.jobId,
    equipmentId: input.equipmentId,
    divisionId: input.divisionId,
    localUri: destination.uri,
    fileName: `${localAttachmentId.replaceAll(':', '-')}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: destination.size,
    state: 'local',
    createdAt: now,
    updatedAt: now,
  });
}

export async function rebindFormAttachments(identityKey: string, fromSubmissionId: string, toSubmissionId: string, accessToken?: string) {
  if (fromSubmissionId === toSubmissionId) return loadFormAttachments(identityKey, toSubmissionId);
  const db = await database();
  const superseded: LocalFormAttachment[] = [];
  const rebound: LocalFormAttachment[] = [];
  await db.withTransactionAsync(async () => {
    const sourceRows = await db.getAllAsync<{ record_json: string }>(
      `SELECT record_json FROM form_attachments
       WHERE identity_key = ? AND client_submission_id = ?
       ORDER BY updated_at ASC`,
      identityKey,
      fromSubmissionId,
    );
    if (sourceRows.length === 0) {
      const existing = await db.getAllAsync<{ record_json: string }>(
        `SELECT record_json FROM form_attachments
         WHERE identity_key = ? AND client_submission_id = ?
         ORDER BY updated_at ASC`,
        identityKey,
        toSubmissionId,
      );
      rebound.push(...existing.map((row) => JSON.parse(row.record_json) as LocalFormAttachment));
      return;
    }

    for (const row of sourceRows) {
      const source = JSON.parse(row.record_json) as LocalFormAttachment;
      const targetRow = await db.getFirstAsync<{ record_json: string }>(
        `SELECT record_json FROM form_attachments
         WHERE identity_key = ? AND client_submission_id = ? AND field_id = ?`,
        identityKey,
        toSubmissionId,
        source.fieldId,
      );
      const target = targetRow ? JSON.parse(targetRow.record_json) as LocalFormAttachment : null;
      if (target?.localAttachmentId === source.localAttachmentId) {
        rebound.push(target);
        continue;
      }

      if (source.state === 'submitted' && target?.state === 'submitted') {
        rebound.push(target);
        continue;
      }

      const targetWins = source.state !== 'submitted' && (target?.state === 'submitted'
        || Boolean(target && (
          target.updatedAt > source.updatedAt
          || (target.updatedAt === source.updatedAt && target.localAttachmentId > source.localAttachmentId)
        )));
      if (target && targetWins) {
        await db.runAsync('DELETE FROM form_attachments WHERE local_attachment_id = ?', source.localAttachmentId);
        superseded.push(source);
        rebound.push(target);
        continue;
      }

      if (target) {
        await db.runAsync('DELETE FROM form_attachments WHERE local_attachment_id = ?', target.localAttachmentId);
        superseded.push(target);
      }
      const updated = { ...source, clientSubmissionId: toSubmissionId, updatedAt: new Date().toISOString() };
      await db.runAsync(
        `UPDATE form_attachments
         SET client_submission_id = ?, updated_at = ?, record_json = ?
         WHERE local_attachment_id = ?`,
        toSubmissionId,
        updated.updatedAt,
        JSON.stringify(updated),
        source.localAttachmentId,
      );
      rebound.push(updated);
    }
  });

  for (const record of superseded) {
    if (record.state === 'submitted') continue;
    if (record.fileId) {
      try { await deleteUploadedFile(record.fileId, accessToken); } catch { /* Pending metadata expires server-side. */ }
    }
    const file = new File(record.localUri);
    if (file.exists) file.delete();
  }
  return rebound;
}

export async function ensureFormPhotoUploaded(record: LocalFormAttachment, accessToken?: string) {
  if (record.state === 'completed' && record.fileId) return record;
  let current = record;
  try {
    if (!new File(current.localUri).exists) throw new Error('The saved photo is no longer available on this device.');
    if (!current.fileId || !current.uploadUrl || !current.uploadExpiresAt || Date.parse(current.uploadExpiresAt) <= Date.now()) {
      if (current.fileId) {
        try {
          await completeUpload(current.fileId, accessToken);
          return save({ ...current, state: 'completed', error: undefined, updatedAt: new Date().toISOString() });
        } catch {
          try { await deleteUploadedFile(current.fileId, accessToken); } catch { /* Pending metadata expires server-side. */ }
        }
      }
      const prepared = await prepareUpload({
        action: 'prepare-upload',
        fileName: current.fileName,
        mimeType: current.mimeType,
        sizeBytes: current.sizeBytes,
        entityType: 'form-attachment',
        entityId: current.clientSubmissionId,
        category: 'photo',
        formId: current.formId,
        fieldId: current.fieldId,
        clientSubmissionId: current.clientSubmissionId,
        workflowOccurrenceId: current.workflowOccurrenceId,
        workflowRequirementId: current.workflowRequirementId,
        jobId: current.jobId,
        equipmentId: current.equipmentId,
        divisionId: current.divisionId,
      }, accessToken);
      if (!prepared.fileId || !prepared.uploadUrl || !prepared.expiresAt) throw new Error('Photo upload could not be prepared.');
      current = await save({
        ...current,
        state: 'upload_prepared',
        fileId: prepared.fileId,
        uploadUrl: prepared.uploadUrl,
        uploadExpiresAt: prepared.expiresAt,
        requiredHeaders: prepared.requiredHeaders,
        error: undefined,
        updatedAt: new Date().toISOString(),
      });
    }
    try {
      await completeUpload(current.fileId!, accessToken);
    } catch {
      await uploadUriToS3(current.uploadUrl!, current.localUri, current.mimeType, current.requiredHeaders);
      await completeUpload(current.fileId!, accessToken);
    }
    return save({ ...current, state: 'completed', error: undefined, updatedAt: new Date().toISOString() });
  } catch (error) {
    await save({
      ...current,
      state: 'failed',
      error: error instanceof Error ? error.message : 'Photo upload failed.',
      updatedAt: new Date().toISOString(),
    });
    throw error;
  }
}

export async function prepareFormSubmissionAttachments(payload: SubmitEmployeeFormRequest, identityKey: string, accessToken?: string) {
  const records = await loadFormAttachments(identityKey, payload.clientSubmissionId);
  const completed = await Promise.all(records.map((record) => ensureFormPhotoUploaded(record, accessToken)));
  const fileIdByField = new Map(completed.map((record) => [record.fieldId, record.fileId!]));
  const responseByField = new Map(payload.responses.map((response) => [response.fieldId, response]));
  for (const [fieldId, fileId] of fileIdByField) {
    responseByField.set(fieldId, { fieldId, value: '', fileIds: [fileId] });
  }
  return { ...payload, responses: [...responseByField.values()] };
}

export async function removeFormAttachment(record: LocalFormAttachment, accessToken?: string) {
  if (record.fileId && record.state !== 'submitted') await deleteUploadedFile(record.fileId, accessToken);
  const file = new File(record.localUri);
  if (file.exists) file.delete();
  const db = await database();
  await db.runAsync('DELETE FROM form_attachments WHERE local_attachment_id = ?', record.localAttachmentId);
}

export async function markFormAttachmentsSubmitted(identityKey: string, clientSubmissionId: string) {
  const records = await loadFormAttachments(identityKey, clientSubmissionId);
  await Promise.all(records.map(async (record) => {
    const file = new File(record.localUri);
    if (file.exists) file.delete();
    await save({ ...record, state: 'submitted', localUri: '', uploadUrl: undefined, requiredHeaders: undefined, error: undefined, updatedAt: new Date().toISOString() });
  }));
}

export function resetFormAttachmentStorageForTests() {
  databasePromise = null;
}