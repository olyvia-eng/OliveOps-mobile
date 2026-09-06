import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { loadMySops } from '@/api/sopsApi';
import { EmptyState, ListRow, ScreenHeader, SectionCard, SectionHeader } from '@/components/MobilePrimitives';
import { LoadingState } from '@/components/LoadingState';
import { ScreenSafeAreaView } from '@/components/Screen';
import { SecondaryButton } from '@/components/SecondaryButton';
import { StatusBanner } from '@/components/StatusBanner';
import { filterSops } from '@/features/sops/presentation';
import { isOnline } from '@/services/connectivity';
import { loadSopCache, saveSopCache } from '@/services/sopCacheStorage';
import { useAuthStore } from '@/store/authStore';
import { colors, radii, spacing, typography } from '@/theme/colors';
import { normalizeContentMode } from '@/types/document';
import type { SopVersion } from '@/types/sop';

function identityFor(user: ReturnType<typeof useAuthStore>['user']) {
  return user?.employeeId ? `${user.businessId}:${user.id}:${user.employeeId}` : null;
}

function formatPublishedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
}

export default function SopsScreen() {
  const { accessToken, user } = useAuthStore();
  const identityKey = identityFor(user);
  const identityRef = useRef(identityKey);
  identityRef.current = identityKey;
  const [sops, setSops] = useState<SopVersion[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (showRefresh = false, cachedCount = sops.length) => {
    if (!identityKey) { setLoading(false); return; }
    if (showRefresh) setRefreshing(true);
    try {
      if (!await isOnline()) {
        if (identityRef.current !== identityKey) return;
        setOffline(true);
        setError(cachedCount ? null : 'SOPs are unavailable offline until they have been loaded once.');
        return;
      }
      const payload = await loadMySops(accessToken);
      if (identityRef.current !== identityKey) return;
      setSops(payload.sops);
      setOffline(false);
      setError(null);
      await saveSopCache({ identityKey, updatedAt: new Date().toISOString(), sops: payload.sops });
    } catch (reason) {
      if (identityRef.current !== identityKey) return;
      setError(cachedCount ? 'Could not refresh SOPs. Showing saved procedures.' : reason instanceof Error ? reason.message : 'SOPs could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, identityKey, sops.length]);

  useEffect(() => {
    let cancelled = false;
    setSops([]); setLoading(true); setError(null); setOffline(false);
    if (!identityKey) { setLoading(false); return () => { cancelled = true; }; }
    void loadSopCache(identityKey).catch(() => null).then((cache) => {
      if (!cancelled && cache) setSops(cache.sops);
      return cache;
    }).then((cache) => { if (!cancelled) void refresh(false, cache?.sops.length ?? 0); });
    return () => { cancelled = true; };
  }, [identityKey]);

  const categories = useMemo(() => ['All', ...Array.from(new Set(sops.map((item) => item.category))).sort()], [sops]);
  const visible = useMemo(() => {
    return filterSops(sops, query, category);
  }, [category, query, sops]);

  const header = <View style={styles.header}>
    <ScreenHeader title="SOP Library" subtitle="Current company procedures and safety references" />
    {offline ? <StatusBanner tone="info" message="Offline. Showing saved SOPs." /> : null}
    {error ? <StatusBanner tone="error" message={error} /> : null}
    <TextInput testID="sop-search" accessibilityLabel="Search SOPs" value={query} onChangeText={setQuery}
      placeholder="Search procedures" placeholderTextColor={colors.textMuted} style={styles.search} />
    <View style={styles.categories}>{categories.map((item) => (
      <Pressable key={item} testID={`sop-category-${item}`} accessibilityRole="button" accessibilityState={{ selected: category === item }}
        onPress={() => setCategory(item)} style={[styles.category, category === item && styles.categorySelected]}>
        <Text style={[styles.categoryText, category === item && styles.categoryTextSelected]}>{item}</Text>
      </Pressable>
    ))}</View>
    <SectionHeader title="Procedures" />
  </View>;

  if (loading && sops.length === 0) return <ScreenSafeAreaView><LoadingState label="Loading SOPs..." /></ScreenSafeAreaView>;

  return <ScreenSafeAreaView testID="sops-screen-safe-area">
    <FlatList testID="sops-screen" data={visible} keyExtractor={(item) => item.sopId}
      contentContainerStyle={styles.content} ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(true); }} />}
      renderItem={({ item }) => <SectionCard><ListRow testID={`sop-row-${item.sopId}`} title={item.title}
        subtitle={item.shortDescription} detail={`v${item.version} · ${formatPublishedAt(item.publishedAt)}`}
        onPress={() => router.push({
          pathname: normalizeContentMode(item.contentMode) === 'document' ? '/sop-document' : '/sop-detail',
          params: { sopId: item.sopId },
        })} /></SectionCard>}
      ListEmptyComponent={<EmptyState title={query || category !== 'All' ? 'No matching SOPs' : 'No SOPs available'}
        message={query || category !== 'All' ? 'Try another search or category.' : 'Published company procedures will appear here.'}
        action={error ? <SecondaryButton label="Retry" onPress={() => { void refresh(true); }} /> : undefined} />} />
  </ScreenSafeAreaView>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.sm },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  search: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: spacing.md, fontSize: typography.body },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  category: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  categorySelected: { borderColor: colors.primary, backgroundColor: colors.oliveTint },
  categoryText: { color: colors.textSecondary, fontSize: typography.bodySmall, fontWeight: typography.semibold },
  categoryTextSelected: { color: colors.primary },
});