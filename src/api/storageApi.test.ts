import { beforeEach, describe, expect, it, vi } from 'vitest';
import { completeUpload, prepareUpload, prepareDownload, uploadToS3, uploadUriToS3 } from '@/api/storageApi';

vi.mock('@/config/env', () => ({
  ENV: { apiBaseUrl: 'http://localhost:3000' },
}));

function mockJsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as any;
}

describe('storageApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('runs photo upload lifecycle: prepare -> put -> complete', async () => {
    const fetchMock = vi.fn();

    fetchMock
      .mockResolvedValueOnce(
        mockJsonResponse(200, {
          ok: true,
          fileId: 'file-1',
          uploadUrl: 'https://upload.example/file-1',
          requiredHeaders: { 'Content-Type': 'image/jpeg' },
        })
      )
      .mockResolvedValueOnce({ ok: true, status: 200 } as any)
      .mockResolvedValueOnce(mockJsonResponse(200, { ok: true, fileId: 'file-1' }));

    vi.stubGlobal('fetch', fetchMock);

    const prepared = await prepareUpload({
      action: 'prepare-upload',
      fileName: 'clockout.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 200,
      entityType: 'time-entry',
      entityId: 'entry-1',
      category: 'clock-out-photo',
    });

    expect(prepared.fileId).toBe('file-1');
    await uploadToS3(prepared.uploadUrl!, new Blob(['abc'], { type: 'image/jpeg' }), prepared.requiredHeaders);
    const done = await completeUpload(prepared.fileId!);
    expect(done.ok).toBe(true);
  });

  it('fails when direct S3 upload fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(uploadToS3('https://upload.example/bad', new Blob(['x']), {})).rejects.toThrow('Direct S3 upload failed.');
  });

  it('resolves signed attachment URL request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockJsonResponse(200, { ok: true, fileId: 'file-1', downloadUrl: 'https://download.example/file-1' })
      )
    );

    const payload = await prepareDownload('file-1');
    expect(payload.downloadUrl).toContain('download.example');
  });

  it('uploads URI by converting it to blob first', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({ ok: true, blob: vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/jpeg' })) });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    await uploadUriToS3('https://upload.example/file-1', 'file:///tmp/photo.jpg', 'image/jpeg');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
