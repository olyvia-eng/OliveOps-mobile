import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { loadMySopDetail } from '@/api/sopsApi';
import { prepareDownload } from '@/api/storageApi';
import { ErrorState } from '@/components/ErrorState';
import { InfoRow, ScreenHeader, SectionCard, SectionHeader, StatusBadge } from '@/components/MobilePrimitives';
import { LoadingState } from '@/components/LoadingState';
import { SopRichText } from '@/components/SopRichText';
import { Screen } from '@/components/Screen';
import { SecondaryButton } from '@/components/SecondaryButton';
import { StatusBanner } from '@/components/StatusBanner';
import { isOnline } from '@/services/connectivity';
import { normalizeSopContent } from '@/features/sops/content';
import { loadSopCache, saveSopCache } from '@/services/sopCacheStorage';
import { useAuthStore } from '@/store/authStore';
import { spacing } from '@/theme/colors';
import { normalizeContentMode } from '@/types/document';
import type { SopVersion } from '@/types/sop';

function identityFor(user: ReturnType<typeof useAuthStore>['user']) {
  return user?.employeeId ? `${user.businessId}:${user.id}:${user.employeeId}` : null;
}

export default function SopDetailScreen() {
  const params = useLocalSearchParams<{ sopId?: string | string[]; expectedVersion?: string | string[] }>();
  const sopId = Array.isArray(params.sopId) ? params.sopId[0] : params.sopId ?? '';
  const expectedVersionValue = Array.isArray(params.expectedVersion) ? params.expectedVersion[0] : params.expectedVersion;
  const expectedVersion = expectedVersionValue ? Number(expectedVersionValue) : undefined;
  const { accessToken, user } = useAuthStore();
  const identityKey = identityFor(user);
  const identityRef = useRef(identityKey);
  identityRef.current = identityKey;
  const [sop, setSop] = useState<SopVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);

  async function load() {
    if (!identityKey || !sopId) { setLoading(false); setError('SOP was not found.'); return; }
    setLoading(true);
    const cache = await loadSopCache(identityKey).catch(() => null);
    const cached = cache?.sops.find((item) => item.sopId === sopId && (expectedVersion === undefined || item.version === expectedVersion)) ?? null;
    if (identityRef.current !== identityKey) return;
    if (cached) setSop(cached);
    if (!await isOnline()) {
      if (identityRef.current !== identityKey) return;
      setOffline(true); setError(cached ? null : 'This SOP is not available offline yet.'); setLoading(false); return;
    }
    try {
      const payload = await loadMySopDetail(sopId, accessToken);
      if (identityRef.current !== identityKey) return;
      if (expectedVersion !== undefined && payload.sop.version !== expectedVersion) {
        setSop(null);
        throw new Error('This SOP version changed. Return to the Visit and refresh before continuing.');
      }
      setSop(payload.sop); setOffline(false); setError(null);
      const remaining = (cache?.sops ?? []).filter((item) => item.sopId !== sopId);
      await saveSopCache({ identityKey, updatedAt: new Date().toISOString(), sops: [payload.sop, ...remaining] });
    } catch (reason) {
      if (identityRef.current !== identityKey) return;
      setError(cached ? 'Could not refresh this SOP. Showing the saved version.' : reason instanceof Error ? reason.message : 'SOP could not be loaded.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [accessToken, expectedVersion, identityKey, sopId]);

  async function openAttachment(fileId: string) {
    setOpeningFileId(fileId); setError(null);
    try {
      if (!await isOnline()) throw new Error('offline');
      const result = await prepareDownload(fileId, accessToken);
      await Linking.openURL(result.downloadUrl);
    } catch { setError('Reconnect to open this attachment.'); }
    finally { setOpeningFileId(null); }
  }

  if (loading && !sop) return <Screen><LoadingState label="Loading SOP..." /></Screen>;
  if (!sop) return <Screen><ErrorState message={error ?? 'SOP was not found.'} onRetry={() => { void load(); }} /></Screen>;
  if (normalizeContentMode(sop.contentMode) === 'document') {
    return <Redirect href={{ pathname: '/sop-document', params: { sopId: sop.sopId, expectedVersion: expectedVersionValue } }} />;
  }
  const structuredContent = normalizeSopContent(sop);
  if (__DEV__ && structuredContent.unsupportedTypes.length > 0) {
    console.warn('[sop:unsupported-content]', { types: structuredContent.unsupportedTypes });
  }

  return <Screen testID="sop-detail-screen">
    <ScreenHeader title={sop.title} subtitle={sop.shortDescription} action={<StatusBadge label={sop.category} tone="active" />} />
    {offline ? <StatusBanner tone="info" message="Offline. Showing the saved version." /> : null}
    {error ? <StatusBanner tone="error" message={error} /> : null}
    <SectionCard><InfoRow label="Version" value={String(sop.version)} /><InfoRow label="Published" value={new Date(sop.publishedAt).toLocaleDateString()} /></SectionCard>
    <SopRichText content={structuredContent} />
    {sop.attachmentFileIds.length > 0 ? <View style={styles.section}><SectionHeader title="Attachments" />
      {sop.attachmentFileIds.map((fileId, index) => <SecondaryButton key={fileId}
        label={openingFileId === fileId ? 'Opening...' : `Open attachment ${index + 1}`}
        disabled={openingFileId !== null} onPress={() => { void openAttachment(fileId); }} />)}
    </View> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
});
