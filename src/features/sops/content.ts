import type { SopRichTextDocument, SopRichTextMark, SopRichTextNode, SopVersion } from '@/types/sop';

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem']);
const MARK_TYPES = new Set(['bold', 'italic', 'underline', 'link']);

export type SopContentResult = {
  document: SopRichTextDocument;
  state: 'ready' | 'empty' | 'unsupported';
  unsupportedTypes: string[];
};

function safeLink(value: unknown) {
  if (typeof value !== 'string' || value.length > 2_048) return null;
  const href = value.trim();
  return /^(https?:|mailto:|tel:)/i.test(href) ? href : null;
}

function allowedChild(parent: SopRichTextNode['type'], child: string) {
  if (parent === 'doc') return ['paragraph', 'heading', 'bulletList', 'orderedList'].includes(child);
  if (parent === 'paragraph' || parent === 'heading') return child === 'text' || child === 'hardBreak';
  if (parent === 'bulletList' || parent === 'orderedList') return child === 'listItem';
  if (parent === 'listItem') return ['paragraph', 'bulletList', 'orderedList'].includes(child);
  return false;
}

function normalizeMarks(value: unknown, unsupported: Set<string>): SopRichTextMark[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const marks = value.flatMap((candidate): SopRichTextMark[] => {
    if (!candidate || typeof candidate !== 'object' || !('type' in candidate)) {
      unsupported.add('invalid-mark');
      return [];
    }
    const type = String(candidate.type);
    if (!MARK_TYPES.has(type)) {
      unsupported.add(`mark:${type}`);
      return [];
    }
    if (type === 'bold' || type === 'italic' || type === 'underline') return [{ type }];
    const attrs = 'attrs' in candidate && candidate.attrs && typeof candidate.attrs === 'object' ? candidate.attrs : null;
    const href = safeLink(attrs && 'href' in attrs ? attrs.href : null);
    if (!href) {
      unsupported.add('mark:link-invalid');
      return [];
    }
    return [{ type: 'link', attrs: { href } }];
  });
  return marks.length ? marks : undefined;
}

function normalizeNode(value: unknown, parent: SopRichTextNode['type'], unsupported: Set<string>, depth = 0): SopRichTextNode | null {
  if (!value || typeof value !== 'object' || !('type' in value) || depth > 12) {
    unsupported.add(depth > 12 ? 'maximum-depth' : 'invalid-node');
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const type = String(candidate.type);
  if (!allowedChild(parent, type)) {
    unsupported.add(`node:${type}`);
    return null;
  }
  if (type === 'text') {
    const text = typeof candidate.text === 'string' ? candidate.text : '';
    if (!text) return null;
    const marks = normalizeMarks(candidate.marks, unsupported);
    return { type: 'text', text, ...(marks ? { marks } : {}) };
  }
  if (type === 'hardBreak') return { type: 'hardBreak' };
  if (!BLOCK_TYPES.has(type)) {
    unsupported.add(`node:${type}`);
    return null;
  }
  const nodeType = type as SopRichTextNode['type'];
  const content = Array.isArray(candidate.content)
    ? candidate.content.map((child) => normalizeNode(child, nodeType, unsupported, depth + 1)).filter((child): child is SopRichTextNode => Boolean(child))
    : [];
  if (nodeType === 'heading') {
    const attrs = candidate.attrs && typeof candidate.attrs === 'object' ? candidate.attrs as Record<string, unknown> : {};
    const level = [1, 2, 3].includes(Number(attrs.level)) ? Number(attrs.level) as 1 | 2 | 3 : 2;
    return { type: 'heading', attrs: { level }, ...(content.length ? { content } : {}) };
  }
  if (nodeType === 'orderedList') {
    const attrs = candidate.attrs && typeof candidate.attrs === 'object' ? candidate.attrs as Record<string, unknown> : {};
    const start = Number.isSafeInteger(Number(attrs.start)) ? Math.max(1, Number(attrs.start)) : 1;
    return { type: 'orderedList', attrs: { start, type: null }, ...(content.length ? { content } : {}) };
  }
  return { type: nodeType, ...(content.length ? { content } : {}) };
}

function hasText(node: SopRichTextNode): boolean {
  return node.type === 'text' ? Boolean(node.text?.trim()) : (node.content ?? []).some(hasText);
}

function legacyDocument(sop: Pick<SopVersion, 'purpose' | 'instructions' | 'safetyInformation'>): SopRichTextDocument {
  const sections = [
    ['Purpose', sop.purpose],
    ['Instructions', sop.instructions],
    ['Safety Information', sop.safetyInformation],
  ] as const;
  const content = sections.flatMap(([heading, value]) => {
    if (typeof value !== 'string') return [];
    const paragraphs = value.replace(/<[^>]*>/g, ' ').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      .map((text): SopRichTextNode => ({ type: 'paragraph', content: [{ type: 'text', text }] }));
    return paragraphs.length ? [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: heading }] } as SopRichTextNode,
      ...paragraphs,
    ] : [];
  });
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

export function normalizeSopContent(sop: Pick<SopVersion, 'richTextContent' | 'purpose' | 'instructions' | 'safetyInformation'>): SopContentResult {
  if (sop.richTextContent === undefined || sop.richTextContent === null) {
    const document = legacyDocument(sop);
    return { document, state: hasText(document) ? 'ready' : 'empty', unsupportedTypes: [] };
  }
  const unsupported = new Set<string>();
  let serialized = '';
  try { serialized = JSON.stringify(sop.richTextContent); } catch { unsupported.add('invalid-document'); }
  if (!serialized || serialized.length > 100_000 || sop.richTextContent.type !== 'doc') {
    unsupported.add(serialized.length > 100_000 ? 'document-too-large' : 'invalid-document');
    return { document: { type: 'doc', content: [{ type: 'paragraph' }] }, state: 'unsupported', unsupportedTypes: [...unsupported] };
  }
  const content = Array.isArray(sop.richTextContent.content)
    ? sop.richTextContent.content.map((node) => normalizeNode(node, 'doc', unsupported)).filter((node): node is SopRichTextNode => Boolean(node))
    : [];
  const document: SopRichTextDocument = { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
  return {
    document,
    state: unsupported.size ? 'unsupported' : hasText(document) ? 'ready' : 'empty',
    unsupportedTypes: [...unsupported],
  };
}