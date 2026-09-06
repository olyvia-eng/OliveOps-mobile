import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { loadMySopDetail } from '@/api/sopsApi';
import { prepareDownload } from '@/api/storageApi';
import { ErrorState } from '@/components/ErrorState';
import { InfoRow, ScreenHeader, SectionCard, SectionHeader, StatusBadge } from '@/components/MobilePrimitives';
import { LoadingState } from '@/components/LoadingState';
import { Screen } from '@/components/Screen';
import { SecondaryButton } from '@/components/SecondaryButton';
import { StatusBanner } from '@/components/StatusBanner';
import { isOnline } from '@/services/connectivity';
import { loadSopCache, saveSopCache } from '@/services/sopCacheStorage';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, typography } from '@/theme/colors';
import type { SopVersion } from '@/types/sop';

function identityFor(user: ReturnType<typeof useAuthStore>['user']) {
  return user?.employeeId ? `${user.businessId}:${user.id}:${user.employeeId}` : null;
}

export default function SopDetailScreen() {
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
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);

  async function load() {
    if (!identityKey || !sopId) { setLoading(false); setError('SOP was not found.'); return; }
    setLoading(true);
    const cache = await loadSopCache(identityKey).catch(() => null);
    const cached = cache?.sops.find((item) => item.sopId === sopId) ?? null;
    if (identityRef.current !== identityKey) return;
    if (cached) setSop(cached);
    if (!await isOnline()) {
      if (identityRef.current !== identityKey) return;
      setOffline(true); setError(cached ? null : 'This SOP is not available offline yet.'); setLoading(false); return;
    }
    try {
      const payload = await loadMySopDetail(sopId, accessToken);
      if (identityRef.current !== identityKey) return;
      setSop(payload.sop); setOffline(false); setError(null);
      const remaining = (cache?.sops ?? []).filter((item) => item.sopId !== sopId);
      await saveSopCache({ identityKey, updatedAt: new Date().toISOString(), sops: [payload.sop, ...remaining] });
    } catch (reason) {
      if (identityRef.current !== identityKey) return;
      setError(cached ? 'Could not refresh this SOP. Showing the saved version.' : reason instanceof Error ? reason.message : 'SOP could not be loaded.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [accessToken, identityKey, sopId]);

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

  return <Screen testID="sop-detail-screen">
    <ScreenHeader title={sop.title} subtitle={sop.shortDescription} action={<StatusBadge label={sop.category} tone="active" />} />
    {offline ? <StatusBanner tone="info" message="Offline. Showing the saved version." /> : null}
    {error ? <StatusBanner tone="error" message={error} /> : null}
    <SectionCard><InfoRow label="Version" value={String(sop.version)} /><InfoRow label="Published" value={new Date(sop.publishedAt).toLocaleDateString()} /></SectionCard>
    <ContentSection title="Purpose" content={sop.purpose} />
    <ContentSection title="Procedure" content={sop.instructions} />
    {sop.safetyInformation ? <ContentSection title="Safety information" content={sop.safetyInformation} /> : null}
    {sop.attachmentFileIds.length > 0 ? <View style={styles.section}><SectionHeader title="Attachments" />
      {sop.attachmentFileIds.map((fileId, index) => <SecondaryButton key={fileId}
        label={openingFileId === fileId ? 'Opening...' : `Open attachment ${index + 1}`}
        disabled={openingFileId !== null} onPress={() => { void openAttachment(fileId); }} />)}
    </View> : null}
  </Screen>;
}

function ContentSection({ title, content }: { title: string; content: string }) {
  return <View style={styles.section}><SectionHeader title={title} /><Text style={styles.content}>{content}</Text></View>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  content: { color: colors.textPrimary, fontSize: typography.body, lineHeight: 23 },
});