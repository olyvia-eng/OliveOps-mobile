import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { loadMySopDetail } from '@/api/sopsApi';
import { AuthorizedPdfViewer } from '@/components/AuthorizedPdfViewer';
import { ErrorState } from '@/components/ErrorState';
import { ScreenHeader, StatusBadge } from '@/components/MobilePrimitives';
import { LoadingState } from '@/components/LoadingState';
import { Screen, ScreenSafeAreaView } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { isOnline } from '@/services/connectivity';
import { loadSopCache, saveSopCache } from '@/services/sopCacheStorage';
import { useAuthStore } from '@/store/authStore';
import { spacing } from '@/theme/colors';
import { normalizeContentMode } from '@/types/document';
import type { SopVersion } from '@/types/sop';

function identityFor(user: ReturnType<typeof useAuthStore>['user']) {
  return user?.employeeId ? `${user.businessId}:${user.id}:${user.employeeId}` : null;
}

export default function SopDocumentScreen() {
  const params = useLocalSearchParams<{ sopId?: string | string[] }>();
  const sopId = Array.isArray(params.sopId) ? params.sopId[0] : params.sopId ?? '';
  const { accessToken, user } = useAuthStore();
  const identityKey = identityFor(user);
  const identityRef = useRef(identityKey);
  identityRef.current = identityKey;
  const [sop, setSop] = useState<SopVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!identityKey || !sopId) { setLoading(false); setError('SOP was not found.'); return; }
    setLoading(true);
    const cache = await loadSopCache(identityKey).catch(() => null);
    const cached = cache?.sops.find((item) => item.sopId === sopId) ?? null;
    if (identityRef.current !== identityKey) return;
    if (cached && normalizeContentMode(cached.contentMode) === 'document') setSop(cached);
    if (!await isOnline()) {
      if (identityRef.current !== identityKey) return;
      setOffline(true);
      setError(cached ? null : 'This SOP is not available offline yet.');
      setLoading(false);
      return;
    }
    try {
      const payload = await loadMySopDetail(sopId, accessToken);
      if (identityRef.current !== identityKey) return;
      if (normalizeContentMode(payload.sop.contentMode) !== 'document') {
        router.replace({ pathname: '/sop-detail', params: { sopId } });
        return;
      }
      setSop(payload.sop);
      setOffline(false);
      setError(null);
      const remaining = (cache?.sops ?? []).filter((item) => item.sopId !== sopId);
      await saveSopCache({ identityKey, updatedAt: new Date().toISOString(), sops: [payload.sop, ...remaining] });
    } catch (reason) {
      if (identityRef.current !== identityKey) return;
      setError(cached ? 'Could not refresh this SOP. Showing the saved version.' : reason instanceof Error ? reason.message : 'SOP could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [accessToken, identityKey, sopId]);

  if (loading && !sop) return <Screen><LoadingState label="Loading SOP PDF..." /></Screen>;
  if (!sop) return <Screen><ErrorState message={error ?? 'SOP was not found.'} onRetry={() => { void load(); }} /></Screen>;

  return (
    <ScreenSafeAreaView testID="sop-document-screen-safe-area">
      <View testID="sop-document-screen" style={styles.container}>
        <ScreenHeader title={sop.title} subtitle={`Version ${sop.version}`} action={<StatusBadge label={sop.category} tone="active" />} />
        {offline ? <StatusBanner tone="info" message="Offline. PDF content requires a connection." /> : null}
        {error ? <StatusBanner tone="error" message={error} /> : null}
        {sop.document ? (
          <AuthorizedPdfViewer document={sop.document} />
        ) : (
          <ErrorState message="The PDF for this SOP version is unavailable." onRetry={() => { void load(); }} />
        )}
      </View>
    </ScreenSafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.sm },
});