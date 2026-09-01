const mockRows = new Map<string, any>();
const mockFiles = new Map<string, { exists: boolean; size: number }>();

const mockPrepareUpload = jest.fn();
const mockCompleteUpload = jest.fn();
const mockUploadUriToS3 = jest.fn();
const mockDeleteUploadedFile = jest.fn();
const mockManipulateAsync = jest.fn();

jest.mock('@/api/storageApi', () => ({
  prepareUpload: (...args: unknown[]) => mockPrepareUpload(...args),
  completeUpload: (...args: unknown[]) => mockCompleteUpload(...args),
  uploadUriToS3: (...args: unknown[]) => mockUploadUriToS3(...args),
  deleteUploadedFile: (...args: unknown[]) => mockDeleteUploadedFile(...args),
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: (...args: unknown[]) => mockManipulateAsync(...args),
  SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('expo-file-system', () => {
  class MockDirectory {
    uri = 'file:///documents/form-attachments';
    exists = true;
    create = jest.fn();
  }
  class MockFile {
    uri: string;
    constructor(...parts: any[]) {
      this.uri = parts.length === 1
        ? String(parts[0])
        : `${String(parts[0].uri).replace(/\/$/, '')}/${String(parts[1])}`;
    }
    get exists() { return mockFiles.get(this.uri)?.exists ?? false; }
    get size() { return mockFiles.get(this.uri)?.size ?? 0; }
    async copy(destination: MockFile) {
      const source = mockFiles.get(this.uri) ?? { exists: true, size: 2048 };
      mockFiles.set(destination.uri, { ...source, exists: true });
    }
    delete() { mockFiles.set(this.uri, { exists: false, size: 0 }); }
  }
  return { Directory: MockDirectory, File: MockFile, Paths: { document: 'file:///documents' } };
});

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => ({
    execAsync: jest.fn(),
    getAllAsync: jest.fn(async (_sql: string, identityKey: string, clientSubmissionId: string) =>
      [...mockRows.values()]
        .filter((record) => record.identityKey === identityKey && record.clientSubmissionId === clientSubmissionId)
        .map((record) => ({ record_json: JSON.stringify(record) }))),
    getFirstAsync: jest.fn(async (_sql: string, identityKey: string, clientSubmissionId: string, fieldId: string) => {
      const record = [...mockRows.values()].find((value) =>
        value.identityKey === identityKey
        && value.clientSubmissionId === clientSubmissionId
        && value.fieldId === fieldId);
      return record ? { record_json: JSON.stringify(record) } : null;
    }),
    runAsync: jest.fn(async (sql: string, ...args: any[]) => {
      if (sql.includes('INSERT INTO form_attachments')) {
        const record = JSON.parse(args[5]);
        const existing = [...mockRows.values()].find((value) =>
          value.identityKey === record.identityKey
          && value.clientSubmissionId === record.clientSubmissionId
          && value.fieldId === record.fieldId);
        if (mockRows.has(record.localAttachmentId) && existing?.localAttachmentId !== record.localAttachmentId) {
          throw new Error('UNIQUE constraint failed: form_attachments.local_attachment_id');
        }
        if (existing) mockRows.delete(existing.localAttachmentId);
        mockRows.set(record.localAttachmentId, record);
      } else if (sql.includes('UPDATE form_attachments')) {
        const [clientSubmissionId, updatedAt, recordJson, localAttachmentId] = args;
        const record = JSON.parse(recordJson);
        const collision = [...mockRows.values()].find((value) =>
          value.localAttachmentId !== localAttachmentId
          && value.identityKey === record.identityKey
          && value.clientSubmissionId === clientSubmissionId
          && value.fieldId === record.fieldId);
        if (collision) throw new Error('UNIQUE constraint failed: form_attachments_submission_field');
        mockRows.set(localAttachmentId, { ...record, clientSubmissionId, updatedAt });
      } else if (sql.includes('DELETE FROM form_attachments')) {
        mockRows.delete(args[0]);
      }
    }),
    withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => {
      const snapshot = new Map(mockRows);
      try {
        await callback();
      } catch (error) {
        mockRows.clear();
        for (const [key, value] of snapshot) mockRows.set(key, value);
        throw error;
      }
    }),
  })),
}));

import {
  createDurableFormPhoto,
  ensureFormPhotoUploaded,
  loadFormAttachments,
  markFormAttachmentsSubmitted,
  prepareFormSubmissionAttachments,
  rebindFormAttachments,
  resetFormAttachmentStorageForTests,
} from './formAttachmentStorage';

describe('formAttachmentStorage', () => {
  beforeEach(() => {
    mockRows.clear();
    mockFiles.clear();
    jest.clearAllMocks();
    resetFormAttachmentStorageForTests();
    mockFiles.set('file:///normalized.jpg', { exists: true, size: 2048 });
    mockManipulateAsync.mockResolvedValue({ uri: 'file:///normalized.jpg' });
  });

  it('copies a photo into app-owned storage and atomically replaces the same field', async () => {
    const input = {
      identityKey: 'biz-1:user-1:emp-1', clientSubmissionId: 'submission-1', formId: 'form-1',
      fieldId: 'photo-1', sourceUri: 'content://picker/photo.jpg',
    };
    const first = await createDurableFormPhoto(input);
    const replacement = await createDurableFormPhoto({ ...input, sourceUri: 'content://picker/replacement.jpg' });

    resetFormAttachmentStorageForTests();
    const hydrated = await loadFormAttachments(input.identityKey, input.clientSubmissionId);
    expect(first.localUri).toMatch(/^file:\/\/\/documents\/form-attachments\//);
    expect(replacement.localAttachmentId).not.toBe(first.localAttachmentId);
    expect(hydrated).toEqual([replacement]);
  });

  it('resumes a failed upload with the same prepared file ID', async () => {
    const record = await createDurableFormPhoto({
      identityKey: 'identity-1', clientSubmissionId: 'submission-1', formId: 'form-1', fieldId: 'photo-1', sourceUri: 'content://photo',
    });
    mockPrepareUpload.mockResolvedValue({
      fileId: 'file-stable', uploadUrl: 'https://upload.example/file', expiresAt: '2999-01-01T00:00:00.000Z', requiredHeaders: { 'Content-Type': 'image/jpeg' },
    });
    mockCompleteUpload.mockRejectedValueOnce(new Error('not uploaded'));
    mockUploadUriToS3.mockRejectedValueOnce(new Error('timeout'));
    await expect(ensureFormPhotoUploaded(record, 'token')).rejects.toThrow('timeout');

    const [failed] = await loadFormAttachments('identity-1', 'submission-1');
    mockCompleteUpload.mockRejectedValueOnce(new Error('not uploaded')).mockResolvedValueOnce({});
    mockUploadUriToS3.mockResolvedValueOnce(undefined);
    const completed = await ensureFormPhotoUploaded(failed, 'token');

    expect(mockPrepareUpload).toHaveBeenCalledTimes(1);
    expect(completed).toMatchObject({ state: 'completed', fileId: 'file-stable' });
    expect(mockUploadUriToS3).toHaveBeenLastCalledWith(
      'https://upload.example/file', record.localUri, 'image/jpeg', { 'Content-Type': 'image/jpeg' },
    );
  });

  it('rebinds a durable photo by primary key without creating a second row', async () => {
    const created = await createDurableFormPhoto({
      identityKey: 'identity-1', clientSubmissionId: 'temporary-submission', formId: 'form-1',
      fieldId: 'photo-1', sourceUri: 'content://photo',
    });
    expect(await loadFormAttachments('identity-1', 'temporary-submission')).toHaveLength(1);

    const rebound = await rebindFormAttachments('identity-1', 'temporary-submission', 'mandatory-submission');

    expect(rebound).toEqual([expect.objectContaining({
      localAttachmentId: created.localAttachmentId,
      clientSubmissionId: 'mandatory-submission',
      fieldId: 'photo-1',
    })]);
    expect(mockFiles.get(created.localUri)?.exists).toBe(true);
    expect(await loadFormAttachments('identity-1', 'temporary-submission')).toHaveLength(0);
    expect(await loadFormAttachments('identity-1', 'mandatory-submission')).toEqual(rebound);
  });

  it('treats a repeated rebind as idempotent', async () => {
    const created = await createDurableFormPhoto({
      identityKey: 'identity-1', clientSubmissionId: 'temporary-submission', formId: 'form-1',
      fieldId: 'photo-1', sourceUri: 'content://photo',
    });
    await rebindFormAttachments('identity-1', 'temporary-submission', 'mandatory-submission');

    const repeated = await rebindFormAttachments('identity-1', 'temporary-submission', 'mandatory-submission');
    const sameTarget = await rebindFormAttachments('identity-1', 'mandatory-submission', 'mandatory-submission');

    expect(repeated).toEqual([expect.objectContaining({ localAttachmentId: created.localAttachmentId })]);
    expect(sameTarget).toEqual(repeated);
    expect(await loadFormAttachments('identity-1', 'mandatory-submission')).toHaveLength(1);
  });

  it('keeps the latest target-field attachment and cleans up the superseded local file', async () => {
    const source = await createDurableFormPhoto({
      identityKey: 'identity-1', clientSubmissionId: 'temporary-submission', formId: 'form-1',
      fieldId: 'photo-1', sourceUri: 'content://source',
    });
    mockRows.set(source.localAttachmentId, {
      ...mockRows.get(source.localAttachmentId),
      updatedAt: '2026-08-31T10:00:00.000Z',
    });
    const target = await createDurableFormPhoto({
      identityKey: 'identity-1', clientSubmissionId: 'mandatory-submission', formId: 'form-1',
      fieldId: 'photo-1', sourceUri: 'content://target',
    });

    const rebound = await rebindFormAttachments('identity-1', 'temporary-submission', 'mandatory-submission');

    expect(rebound).toEqual([expect.objectContaining({ localAttachmentId: target.localAttachmentId })]);
    expect(await loadFormAttachments('identity-1', 'temporary-submission')).toHaveLength(0);
    expect(await loadFormAttachments('identity-1', 'mandatory-submission')).toHaveLength(1);
    expect(mockFiles.get(source.localUri)?.exists).toBe(false);
    expect(mockFiles.get(target.localUri)?.exists).toBe(true);
  });

  it('never deletes submitted attachments during a target-field collision', async () => {
    const source = await createDurableFormPhoto({
      identityKey: 'identity-1', clientSubmissionId: 'temporary-submission', formId: 'form-1',
      fieldId: 'photo-1', sourceUri: 'content://source',
    });
    const target = await createDurableFormPhoto({
      identityKey: 'identity-1', clientSubmissionId: 'mandatory-submission', formId: 'form-1',
      fieldId: 'photo-1', sourceUri: 'content://target',
    });
    await markFormAttachmentsSubmitted('identity-1', 'temporary-submission');
    await markFormAttachmentsSubmitted('identity-1', 'mandatory-submission');

    const rebound = await rebindFormAttachments('identity-1', 'temporary-submission', 'mandatory-submission', 'token');

    expect(rebound).toEqual([expect.objectContaining({ localAttachmentId: target.localAttachmentId, state: 'submitted' })]);
    expect(await loadFormAttachments('identity-1', 'temporary-submission')).toEqual([
      expect.objectContaining({ localAttachmentId: source.localAttachmentId, state: 'submitted' }),
    ]);
    expect(await loadFormAttachments('identity-1', 'mandatory-submission')).toEqual(rebound);
    expect(mockDeleteUploadedFile).not.toHaveBeenCalled();
  });

  it('keeps the durable file through payload preparation and deletes it only after acceptance', async () => {
    const record = await createDurableFormPhoto({
      identityKey: 'identity-1', clientSubmissionId: 'submission-1', formId: 'form-1', fieldId: 'photo-1', sourceUri: 'content://photo',
    });
    mockPrepareUpload.mockResolvedValue({ fileId: 'file-1', uploadUrl: 'https://upload.example/file', expiresAt: '2999-01-01T00:00:00.000Z' });
    mockCompleteUpload.mockRejectedValueOnce(new Error('not uploaded')).mockResolvedValueOnce({});
    mockUploadUriToS3.mockResolvedValueOnce(undefined);
    const payload = await prepareFormSubmissionAttachments({
      formId: 'form-1', trigger: 'manual', clientSubmissionId: 'submission-1', responses: [],
    }, 'identity-1', 'token');

    expect(payload.responses).toEqual([{ fieldId: 'photo-1', value: '', fileIds: ['file-1'] }]);
    expect(mockFiles.get(record.localUri)?.exists).toBe(true);
    await markFormAttachmentsSubmitted('identity-1', 'submission-1');
    expect(mockFiles.get(record.localUri)?.exists).toBe(false);
    expect((await loadFormAttachments('identity-1', 'submission-1'))[0]).toMatchObject({ state: 'submitted', localUri: '' });
  });
});