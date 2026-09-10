import type { ReactNode } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import type { SopContentResult } from '@/features/sops/content';
import type { SopRichTextMark, SopRichTextNode } from '@/types/sop';
import { colors, spacing, typography } from '@/theme/colors';

function markedText(text: string, marks: SopRichTextMark[] | undefined, key: string) {
  const style = (marks ?? []).flatMap((mark) => {
    if (mark.type === 'bold') return styles.bold;
    if (mark.type === 'italic') return styles.italic;
    if (mark.type === 'underline') return styles.underline;
    if (mark.type === 'link') return styles.link;
    return [];
  });
  const link = marks?.find((mark): mark is Extract<SopRichTextMark, { type: 'link' }> => mark.type === 'link');
  return <Text key={key} style={style} onPress={link?.attrs?.href ? () => { void Linking.openURL(link.attrs!.href!); } : undefined}>{text}</Text>;
}

function inline(nodes: SopRichTextNode[] | undefined, key: string): ReactNode[] {
  return (nodes ?? []).flatMap((node, index): ReactNode[] => {
    const nodeKey = `${key}-${index}`;
    if (node.type === 'text') return [markedText(node.text ?? '', node.marks, nodeKey)];
    if (node.type === 'hardBreak') return ['\n'];
    return [];
  });
}

function renderBlocks(nodes: SopRichTextNode[] | undefined, key: string, compact = false): ReactNode[] {
  return (nodes ?? []).flatMap((node, index): ReactNode[] => {
    const nodeKey = `${key}-${index}`;
    if (node.type === 'paragraph') return [<Text key={nodeKey} style={[styles.paragraph, compact && styles.compact]}>{inline(node.content, nodeKey)}</Text>];
    if (node.type === 'heading') {
      const headingStyle = node.attrs?.level === 1 ? styles.heading1 : node.attrs?.level === 3 ? styles.heading3 : styles.heading2;
      return [<Text key={nodeKey} style={headingStyle}>{inline(node.content, nodeKey)}</Text>];
    }
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      const start = node.attrs?.start ?? 1;
      return [<View key={nodeKey} style={styles.list}>{(node.content ?? []).map((item, itemIndex) => (
        <View key={`${nodeKey}-${itemIndex}`} style={styles.listRow}>
          <Text style={styles.marker}>{node.type === 'bulletList' ? '\u2022' : `${start + itemIndex}.`}</Text>
          <View style={styles.listBody}>{renderBlocks(item.content, `${nodeKey}-${itemIndex}`, true)}</View>
        </View>
      ))}</View>];
    }
    return [];
  });
}

export function SopRichText({ content }: { content: SopContentResult }) {
  if (content.state === 'empty') return <Text style={styles.empty}>No procedure content has been provided.</Text>;
  return <View testID="sop-rich-text" style={styles.container}>
    {renderBlocks(content.document.content, 'sop')}
    {content.state === 'unsupported' ? <Text accessibilityRole="alert" style={styles.warning}>Some procedure content could not be displayed.</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  paragraph: { color: colors.textPrimary, fontSize: typography.body, lineHeight: 23 },
  compact: { marginBottom: 0 },
  heading1: { color: colors.textPrimary, fontSize: 22, lineHeight: 28, fontWeight: typography.bold, marginTop: spacing.sm },
  heading2: { color: colors.textPrimary, fontSize: 19, lineHeight: 25, fontWeight: typography.bold, marginTop: spacing.sm },
  heading3: { color: colors.textPrimary, fontSize: typography.body, lineHeight: 23, fontWeight: typography.bold, marginTop: spacing.xs },
  bold: { fontWeight: typography.bold },
  italic: { fontStyle: 'italic' },
  underline: { textDecorationLine: 'underline' },
  link: { color: colors.primary, textDecorationLine: 'underline' },
  list: { gap: spacing.xs, paddingVertical: spacing.xs },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  marker: { width: 24, color: colors.textPrimary, fontSize: typography.body, lineHeight: 23, textAlign: 'right' },
  listBody: { flex: 1, gap: spacing.xs },
  empty: { color: colors.textMuted, fontSize: typography.body },
  warning: { color: colors.error, fontSize: typography.bodySmall, marginTop: spacing.sm },
});