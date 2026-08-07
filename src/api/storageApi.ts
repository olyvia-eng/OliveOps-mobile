import { ENDPOINTS } from '@/api/endpoints';
import { apiRequest } from '@/api/client';
import type { PrepareUploadRequest, PrepareUploadResponse } from '@/types/api';

export async function prepareUpload(payload: PrepareUploadRequest, accessToken?: string): Promise<PrepareUploadResponse> {
  return apiRequest<PrepareUploadResponse>(ENDPOINTS.storage, {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
  });
}

export async function uploadToS3(uploadUrl: string, file: Blob, requiredHeaders?: Record<string, string>): Promise<void> {
  const headers = new Headers(requiredHeaders ?? {});
  if (!headers.get('Content-Type') && file.type) {
    headers.set('Content-Type', file.type);
  }

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers,
    body: file,
  });

  if (!response.ok) {
    throw new Error('Direct S3 upload failed.');
  }
}

export async function completeUpload(fileId: string, accessToken?: string): Promise<{ ok: boolean; fileId: string }> {
  return apiRequest<{ ok: boolean; fileId: string }>(ENDPOINTS.storage, {
    method: 'POST',
    body: JSON.stringify({ action: 'complete-upload', fileId }),
    accessToken,
  });
}

export async function prepareDownload(fileId: string, accessToken?: string): Promise<{ ok: boolean; fileId: string; downloadUrl: string }> {
  return apiRequest<{ ok: boolean; fileId: string; downloadUrl: string }>(ENDPOINTS.storage, {
    method: 'POST',
    body: JSON.stringify({ action: 'prepare-download', fileId }),
    accessToken,
  });
}
