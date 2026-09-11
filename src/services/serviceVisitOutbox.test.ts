import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockRows = new Map<string, any>();
const mockFiles = new Map<string, { exists: boolean; size: number }>();
const mockAddNote = jest.fn();
const mockCompleteVisit = jest.fn();
const mockPrepareUpload = jest.fn();
const mockCompleteUpload = jest.fn();
const mockUploadUriToS3 = jest.fn();
const mockDeleteUploadedFile = jest.fn();
const mockManipulateAsync = jest.fn();

jest.mock('@/api/serviceVisitsApi', () => ({
  addServiceVisitNote: (...args: unknown[]) => mockAddNote(...args),
  completeServiceVisit: (...args: unknown[]) => mockCompleteVisit(...args),
}));
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
    uri = 'file:///documents/service-visit-attachments';
    exists = true;
    create = jest.fn();
  }
  class MockFile {
    uri: string;
    constructor(...parts: any[]) {
      this.uri = parts.length === 1 ? String(parts[0]) : `${String(parts[0].uri).replace(/\/$/, '')}/${String(parts[1])}`;
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
    runAsync: jest.fn(async (sql: string, ...args: any[]) => {
      if (sql.includes('INSERT INTO service_visit_outbox')) {
        const record = JSON.parse(args[5]);
        mockRows.set(record.id, record);
      } else if (sql.includes('DELETE FROM service_visit_outbox')) {
        mockRows.delete(args[0]);
      }
    }),
    getAllAsync: jest.fn(async (_sql: string, identityKey: string, serviceVisitId?: string) =>
      [...mockRows.values()]
        .filter((record) => record.identityKey === identityKey && (!serviceVisitId || record.serviceVisitId === serviceVisitId))
        .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt) || left.id.localeCompare(right.id))
        .map((record) => ({ operation_json: JSON.stringify(record) }))),
  })),
}));

import {
  loadServiceVisitOutbox,
  queueServiceVisitCompletion,
  queueServiceVisitNote,
  queueServiceVisitPhoto,
  replayServiceVisitOutbox,
  resetServiceVisitOutboxForTests,
} from './serviceVisitOutbox';

const context = {
  identityKey: 'business-1:user-1:employee-1',
  jobId: 'job-1',
  serviceId: 'service-1',
  serviceVisitId: 'visit-1',
};

describe('serviceVisitOutbox', () => {
  beforeEach(() => {
    mockRows.clear();
    mockFiles.clear();
    jest.clearAllMocks();
    resetServiceVisitOutboxForTests();
    mockFiles.set('file:///normalized.jpg', { exists: true, size: 2048 });
    mockManipulateAsync.mockResolvedValue({ uri: 'file:///normalized.jpg' });
    mockAddNote.mockResolvedValue({ ok: true });
    mockCompleteVisit.mockResolvedValue({ ok: true });
  });

  it('persists stable note and completion IDs and replays them in queue order', async () => {
    await queueServiceVisitNote({ ...context, clientSubmissionId: 'note-stable', text: 'Gate unlocked' });
    await queueServiceVisitCompletion({ ...context, clientSubmissionId: 'complete-stable' });

    resetServiceVisitOutboxForTests();
    expect(await loadServiceVisitOutbox(context.identityKey, context.serviceVisitId)).toEqual([
      expect.objectContaining({ type: 'note', clientSubmissionId: 'note-stable', text: 'Gate unlocked' }),
      expect.objectContaining({ type: 'complete', clientSubmissionId: 'complete-stable' }),
    ]);

    expect(await replayServiceVisitOutbox(context.identityKey, 'token')).toEqual([]);
    expect(mockAddNote).toHaveBeenCalledWith('job-1', {
      serviceId: 'service-1', visitId: 'visit-1', clientSubmissionId: 'note-stable', text: 'Gate unlocked',
    }, 'token');
    expect(mockCompleteVisit).toHaveBeenCalledWith('job-1', {
      serviceId: 'service-1', visitId: 'visit-1', clientSubmissionId: 'complete-stable',
    }, 'token');
    expect(mockAddNote.mock.invocationCallOrder[0]).toBeLessThan(mockCompleteVisit.mock.invocationCallOrder[0]);
  });

  it('resumes a Visit photo with the same prepared file ID after upload failure', async () => {
    const photo = await queueServiceVisitPhoto({ ...context, clientSubmissionId: 'photo-stable', sourceUri: 'content://photo' });
    mockPrepareUpload.mockResolvedValue({
      fileId: 'file-stable', uploadUrl: 'https://upload.example/file', expiresAt: '2999-01-01T00:00:00.000Z',
      requiredHeaders: { 'Content-Type': 'image/jpeg' },
    });
    mockCompleteUpload.mockRejectedValueOnce(new Error('not uploaded'));
    mockUploadUriToS3.mockRejectedValueOnce(new Error('timeout'));

    const failed = await replayServiceVisitOutbox(context.identityKey, 'token');
    expect(failed).toEqual([expect.objectContaining({ type: 'photo', status: 'failed', fileId: 'file-stable' })]);
    expect(mockFiles.get(photo.localUri!)?.exists).toBe(true);

    mockCompleteUpload.mockRejectedValueOnce(new Error('not uploaded')).mockResolvedValueOnce({});
    mockUploadUriToS3.mockResolvedValueOnce(undefined);
    expect(await replayServiceVisitOutbox(context.identityKey, 'token')).toEqual([]);
    expect(mockPrepareUpload).toHaveBeenCalledTimes(1);
    expect(mockUploadUriToS3).toHaveBeenLastCalledWith(
      'https://upload.example/file', photo.localUri, 'image/jpeg', { 'Content-Type': 'image/jpeg' },
    );
    expect(mockFiles.get(photo.localUri!)?.exists).toBe(false);
  });

  it('does not duplicate a pending completion for the same Visit', async () => {
    const first = await queueServiceVisitCompletion({ ...context, clientSubmissionId: 'complete-stable' });
    const second = await queueServiceVisitCompletion({ ...context, clientSubmissionId: 'complete-replacement' });

    expect(second).toEqual(first);
    expect(await loadServiceVisitOutbox(context.identityKey, context.serviceVisitId)).toHaveLength(1);
  });
});
