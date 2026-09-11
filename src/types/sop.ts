import type { ContentMode, PdfDocumentMetadata } from '@/types/document';

export type SopRichTextMark =
  | { type: 'bold' | 'italic' | 'underline' }
  | { type: 'link'; attrs?: { href?: string } };

export interface SopRichTextNode {
  type: 'doc' | 'paragraph' | 'heading' | 'bulletList' | 'orderedList' | 'listItem' | 'text' | 'hardBreak';
  attrs?: { level?: 1 | 2 | 3; start?: number; type?: null };
  content?: SopRichTextNode[];
  marks?: SopRichTextMark[];
  text?: string;
}

export interface SopRichTextDocument extends SopRichTextNode {
  type: 'doc';
}

export interface SopVersion {
  sopId: string;
  businessId: string;
  version: number;
  title: string;
  contentMode?: ContentMode;
  document?: PdfDocumentMetadata | null;
  category: string;
  shortDescription: string;
  richTextContent?: SopRichTextDocument | null;
  purpose: string;
  instructions: string;
  safetyInformation: string;
  attachmentFileIds: string[];
  publishedAt: string;
  publishedBy: string;
}

export interface MySopListResponse { ok: true; sops: SopVersion[] }
export interface MySopDetailResponse { ok: true; sop: SopVersion }
export interface SopCache { identityKey: string; updatedAt: string; sops: SopVersion[] }