import { describe, expect, it } from '@jest/globals';
import { normalizeSopContent } from './content';

const legacyFields = { purpose: '', instructions: '', safetyInformation: '' };

describe('normalizeSopContent', () => {
  it('preserves the actual web builder document shape and authored block order', () => {
    const result = normalizeSopContent({
      ...legacyFields,
      richTextContent: { type: 'doc', content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Purpose' }] },
        { type: 'paragraph', content: [
          { type: 'text', text: 'This SOP explains ', marks: [{ type: 'italic' }] },
          { type: 'text', text: 'the correct process', marks: [{ type: 'bold' }, { type: 'underline' }] },
        ] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Follow every section.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Preparation' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Inspect the work area' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Gather required equipment' }] }] },
        ] },
        { type: 'orderedList', attrs: { start: 3, type: null }, content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Start the procedure' }] }] },
          { type: 'listItem', content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Verify completion' }] },
            { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Record the result' }] }] }] },
          ] },
        ] },
      ] },
    });

    expect(result.state).toBe('ready');
    expect(result.unsupportedTypes).toEqual([]);
    expect(result.document.content?.map((node) => node.type)).toEqual([
      'heading', 'paragraph', 'paragraph', 'heading', 'bulletList', 'orderedList',
    ]);
    expect(result.document.content?.[5].attrs?.start).toBe(3);
    expect(result.document.content?.[5].content?.[1].content?.[1].type).toBe('bulletList');
  });

  it('normalizes legacy scalar sections into the same document model', () => {
    const result = normalizeSopContent({
      richTextContent: undefined,
      purpose: 'Prevent unexpected startup.',
      instructions: 'Stop equipment.\nIsolate energy.',
      safetyInformation: 'Wear PPE.',
    });

    expect(result.state).toBe('ready');
    expect(result.document.content?.map((node) => node.type)).toEqual([
      'heading', 'paragraph', 'heading', 'paragraph', 'paragraph', 'heading', 'paragraph',
    ]);
    expect(result.document.content?.[0].content?.[0].text).toBe('Purpose');
    expect(result.document.content?.[4].content?.[0].text).toBe('Isolate energy.');
  });

  it('distinguishes a truly empty SOP from an intentionally empty section', () => {
    const empty = normalizeSopContent({ ...legacyFields, richTextContent: { type: 'doc', content: [{ type: 'paragraph' }] } });
    const headingOnly = normalizeSopContent({
      ...legacyFields,
      richTextContent: { type: 'doc', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Purpose' }] }] },
    });

    expect(empty.state).toBe('empty');
    expect(headingOnly.state).toBe('ready');
    expect(headingOnly.document.content?.[0].content?.[0].text).toBe('Purpose');
  });

  it('retains supported siblings and reports unsupported blocks without content logging', () => {
    const result = normalizeSopContent({
      ...legacyFields,
      richTextContent: { type: 'doc', content: [
        { type: 'heading', content: [{ type: 'text', text: 'Purpose' }] },
        { type: 'checklist' as never, content: [{ type: 'text', text: 'Sensitive content' }] } as never,
        { type: 'paragraph', content: [{ type: 'text', text: 'Visible paragraph' }, { type: 'hardBreak' }, { type: 'text', text: 'Second line' }] },
      ] },
    });

    expect(result.state).toBe('unsupported');
    expect(result.unsupportedTypes).toEqual(['node:checklist']);
    expect(JSON.stringify(result.document)).not.toContain('Sensitive content');
    expect(JSON.stringify(result.document)).toContain('Visible paragraph');
  });
});