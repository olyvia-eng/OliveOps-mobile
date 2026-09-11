export type ContentMode = 'structured' | 'document';

export interface PdfDocumentMetadata {
  fileId: string;
  originalFileName: string;
  mimeType: 'application/pdf';
  sizeBytes: number;
  uploadedAt: string;
  status: 'pending' | 'ready';
  version: number | null;
}

export interface PrepareDownloadResponse {
  ok: boolean;
  fileId: string;
  downloadUrl: string;
}

export function normalizeContentMode(value: unknown): ContentMode {
  return value === 'document' ? 'document' : 'structured';
}