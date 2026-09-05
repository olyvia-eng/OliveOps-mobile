import { PropsWithChildren } from 'react';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/theme/colors';

const nestedScreenEdges: Edge[] = ['left', 'right'];
const primaryScreenEdges: Edge[] = ['top', 'left', 'right'];

type ScreenProps = PropsWithChildren<{ testID?: string; safeAreaEdges?: Edge[] }>;

export function Screen({ children, testID, safeAreaEdges = nestedScreenEdges }: ScreenProps) {
  return (
    <SafeAreaView testID={testID ? `${testID}-safe-area` : undefined} style={styles.safe} edges={safeAreaEdges}>
      <ScrollView
        testID={testID}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.inner}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Headerless primary destinations own the top inset; Stack-header screens use Screen instead.
export function PrimaryScreen(props: Omit<ScreenProps, 'safeAreaEdges'>) {
  return <Screen {...props} safeAreaEdges={primaryScreenEdges} />;
}

export function PrimarySafeAreaView({ children, testID }: PropsWithChildren<{ testID?: string }>) {
  return (
    <SafeAreaView testID={testID} style={styles.safe} edges={primaryScreenEdges}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
});
