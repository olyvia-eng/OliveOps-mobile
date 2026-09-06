import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';
import Pdf from 'react-native-pdf';
import { prepareDownload } from '@/api/storageApi';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { SecondaryButton } from '@/components/SecondaryButton';
import { isOnline } from '@/services/connectivity';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, typography } from '@/theme/colors';
import type { PdfDocumentMetadata } from '@/types/document';

const SIGNED_URL_REFRESH_MS = 8 * 60 * 1000;

export function AuthorizedPdfViewer({ document }: { document: PdfDocumentMetadata }) {
  const { accessToken } = useAuthStore();
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingExternal, setOpeningExternal] = useState(false);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const requestSequenceRef = useRef(0);
  const signedAtRef = useRef(0);
  const loadRenewalsRef = useRef(0);

  const requestSignedUrl = useCallback(async () => {
    const requestSequence = ++requestSequenceRef.current;
    setLoading(true);
    setError(null);
    setDownloadUrl(null);

    if (document.status !== 'ready') {
      setError('This PDF is still being prepared. Try again shortly.');
      setLoading(false);
      return;
    }

    try {
      if (!await isOnline()) throw new Error('offline');
      const response = await prepareDownload(document.fileId, accessToken);
      if (requestSequenceRef.current !== requestSequence) return;
      signedAtRef.current = Date.now();
      setDownloadUrl(response.downloadUrl);
    } catch {
      if (requestSequenceRef.current !== requestSequence) return;
      setError('This PDF is unavailable offline. Reconnect and try again.');
      setLoading(false);
    }
  }, [accessToken, document.fileId, document.status]);

  useEffect(() => {
    loadRenewalsRef.current = 0;
    setPage(1);
    setPageCount(0);
    void requestSignedUrl();
    return () => { requestSequenceRef.current += 1; };
  }, [requestSignedUrl]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && signedAtRef.current > 0 && Date.now() - signedAtRef.current >= SIGNED_URL_REFRESH_MS) {
        loadRenewalsRef.current = 0;
        void requestSignedUrl();
      }
    });
    return () => subscription.remove();
  }, [requestSignedUrl]);

  function retry() {
    loadRenewalsRef.current = 0;
    void requestSignedUrl();
  }

  function handlePdfError() {
    if (loadRenewalsRef.current === 0) {
      loadRenewalsRef.current = 1;
      void requestSignedUrl();
      return;
    }
    setLoading(false);
    setError('The PDF could not be displayed. Try again or open it in another app.');
  }

  async function openExternal() {
    setOpeningExternal(true);
    setError(null);
    try {
      if (!await isOnline()) throw new Error('offline');
      const response = await prepareDownload(document.fileId, accessToken);
      await Linking.openURL(response.downloadUrl);
    } catch {
      setError('Reconnect to open this PDF in another app.');
    } finally {
      setOpeningExternal(false);
    }
  }

  return (
    <View testID="authorized-pdf-viewer" style={styles.container}>
      <View style={styles.toolbar}>
        <Text numberOfLines={1} style={styles.fileName}>{document.originalFileName || 'PDF document'}</Text>
        <Text accessibilityLiveRegion="polite" style={styles.pageCount}>
          {pageCount > 0 ? `Page ${page} of ${pageCount}` : 'Loading pages'}
        </Text>
      </View>
      <View style={styles.viewerSurface}>
        {loading && !downloadUrl ? <LoadingState label="Loading PDF..." /> : null}
        {error && !downloadUrl ? <ErrorState message={error} onRetry={retry} /> : null}
        {downloadUrl ? (
          <Pdf
            source={{ uri: downloadUrl, cache: false }}
            trustAllCerts={false}
            horizontal={false}
            enablePaging={false}
            enableDoubleTapZoom
            minScale={1}
            maxScale={4}
            onLoadComplete={(pages) => {
              setPageCount(pages);
              setLoading(false);
            }}
            onPageChanged={(currentPage, pages) => {
              setPage(currentPage);
              setPageCount(pages);
            }}
            onError={handlePdfError}
            onPressLink={(url) => { void Linking.openURL(url); }}
            renderActivityIndicator={() => <LoadingState label="Rendering PDF..." />}
            style={styles.pdf}
          />
        ) : null}
      </View>
      {error && downloadUrl ? <Text style={styles.inlineError}>{error}</Text> : null}
      <SecondaryButton
        label={openingExternal ? 'Opening PDF...' : 'Open in Another App'}
        disabled={openingExternal}
        onPress={() => { void openExternal(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: spacing.sm },
  toolbar: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md },
  fileName: { flex: 1, color: colors.textPrimary, fontSize: typography.bodySmall, fontWeight: typography.semibold },
  pageCount: { color: colors.textMuted, fontSize: typography.caption },
  viewerSurface: { flex: 1, minHeight: 280, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  pdf: { flex: 1, width: '100%', backgroundColor: colors.surfaceMuted },
  inlineError: { color: colors.error, fontSize: typography.bodySmall, paddingHorizontal: spacing.md },
});