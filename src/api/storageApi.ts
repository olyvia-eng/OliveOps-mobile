import { ENDPOINTS } from '@/api/endpoints';
import { apiRequest } from '@/api/client';
import { fetchWithTimeout } from '@/services/fetchWithTimeout';
import type { PrepareUploadRequest, PrepareUploadResponse } from '@/types/api';

const FILE_READ_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 90_000;

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

  const response = await fetchWithTimeout(uploadUrl, {
    method: 'PUT',
    headers,
    body: file,
  }, UPLOAD_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error('Direct S3 upload failed.');
  }
}

export async function uploadUriToS3(
  uploadUrl: string,
  fileUri: string,
  mimeType: string,
  requiredHeaders?: Record<string, string>
): Promise<void> {
  const fileResponse = await fetchWithTimeout(fileUri, {}, FILE_READ_TIMEOUT_MS);
  if (!fileResponse.ok) {
    throw new Error('Could not read selected photo.');
  }

  const blob = await fileResponse.blob();
  const normalized =
    blob.type && blob.type.length > 0
      ? blob
      : new Blob([blob], { type: mimeType || 'image/jpeg' });

  await uploadToS3(uploadUrl, normalized, requiredHeaders);
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

export async function deleteUploadedFile(fileId: string, accessToken?: string): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(ENDPOINTS.storage, {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', fileId }),
    accessToken,
  });
}
