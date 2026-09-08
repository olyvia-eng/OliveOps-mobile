import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { loadMyActiveSnowRoute, loadSnowServiceTypes } from '@/api/snowOperationsApi';
import { EmptyState, InfoRow, ListRow, ScreenHeader, SectionCard, SectionHeader, StatusBadge } from '@/components/MobilePrimitives';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { PrimaryScreen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { captureSnowPosition, startSnowBackgroundTracking, stopSnowBackgroundTracking } from '@/services/snowLocation';
import { loadSnowOutbox, queueSnowCommand, queueSnowPhoto, replaySnowOutbox, snowSubmissionId, type SnowOutboxOperation } from '@/services/snowOperationsOutbox';
import { pickSinglePhoto } from '@/services/photoPicker';
import { normalizeCompanyFeatures } from '@/features/companyFeatures';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { colors, spacing, typography } from '@/theme/colors';
import type { SnowAssignmentResponse, SnowCommandContext, SnowFieldAction, SnowOccurrence, SnowServiceType, SnowStop } from '@/types/snowOperations';

const stopLabels: Record<SnowStop['status'], string> = {
  pending: 'Ready', en_route: 'En route', arrived: 'On site', servicing: 'Service active',
  completed: 'Complete', skipped: 'Skipped', needs_attention: 'Needs attention',
};

export default function SnowAssignmentScreen() {
  const { accessToken, user } = useAuthStore();
  const { companyFeatures } = useClockingStore();
  const effectiveCompanyFeatures = normalizeCompanyFeatures(companyFeatures);
  const identityKey = user?.employeeId ? `${user.businessId}:${user.id}:${user.employeeId}` : null;
  const [assignment, setAssignment] = useState<SnowAssignmentResponse | null>(null);
  const [serviceTypes, setServiceTypes] = useState<SnowServiceType[]>([]);
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState('');
  const [pending, setPending] = useState<SnowOutboxOperation[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!effectiveCompanyFeatures.snowOperations || !identityKey) return;
    try {
      const [routePayload, typesPayload, queued] = await Promise.all([
        loadMyActiveSnowRoute(accessToken), loadSnowServiceTypes(accessToken), loadSnowOutbox(identityKey),
      ]);
      setAssignment(routePayload);
      setServiceTypes(typesPayload.serviceTypes.filter((item) => item.active));
      setPending(queued);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load your Snow assignment.');
      setPending(await loadSnowOutbox(identityKey));
    }
  }, [accessToken, effectiveCompanyFeatures.snowOperations, identityKey]);

  useEffect(() => { void load(); }, [load]);

  const currentStop = useMemo(() => assignment?.stops.find((stop) => ['en_route', 'arrived', 'servicing', 'needs_attention'].includes(stop.status))
    ?? assignment?.stops.find((stop) => stop.status === 'pending') ?? null, [assignment?.stops]);
  const occurrence = useMemo<SnowOccurrence | null>(() => currentStop?.occurrences?.find((item) => item.status !== 'completed')
    ?? currentStop?.occurrences?.at(-1) ?? null, [currentStop]);
  const context = useMemo<SnowCommandContext | null>(() => assignment?.event && assignment.route
    ? { eventId: assignment.event.id, routeId: assignment.route.id, ...(currentStop ? { stopId: currentStop.id } : {}), ...(occurrence ? { occurrenceId: occurrence.id } : {}) }
    : null, [assignment?.event, assignment?.route, currentStop, occurrence]);
  const failed = pending.find((item) => item.status === 'failed');

  useEffect(() => {
    if (assignment && occurrence?.status !== 'active') void stopSnowBackgroundTracking();
  }, [assignment, occurrence?.status]);

  const queueAndSync = useCallback(async (action: SnowFieldAction | 'start-route' | 'complete-route', extra: Record<string, unknown> = {}, captureLocation = true) => {
    if (!identityKey || !context) return;
    setBusy(true);
    setMessage(null);
    try {
      const checkpoint = captureLocation ? await captureSnowPosition() : {};
      await queueSnowCommand({
        identityKey,
        action,
        context,
        payload: { clientSubmissionId: snowSubmissionId(action), ...checkpoint, ...extra },
      });
      const remaining = await replaySnowOutbox(identityKey, accessToken);
      setPending(remaining);
      if (remaining.length) setMessage(remaining[0].error ?? 'Saved on this device and waiting to sync.');
      else await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save this Snow update.');
    } finally {
      setBusy(false);
    }
  }, [accessToken, context, identityKey, load]);

  const addPhoto = useCallback(async (action: 'before-photo' | 'after-photo') => {
    if (!identityKey || !context?.occurrenceId) return;
    setBusy(true);
    try {
      const photo = await pickSinglePhoto('camera');
      if (!photo) return;
      const checkpoint = await captureSnowPosition();
      await queueSnowPhoto({ identityKey, action, context, clientSubmissionId: snowSubmissionId(action), sourceUri: photo.uri, checkpoint });
      const remaining = await replaySnowOutbox(identityKey, accessToken);
      setPending(remaining);
      if (!remaining.length) await load();
      else setMessage(remaining[0].error ?? 'Photo saved on this device and waiting to sync.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save this Snow photo.');
    } finally {
      setBusy(false);
    }
  }, [accessToken, context, identityKey, load]);

  const beginService = () => Alert.alert(
    'Location during Snow service',
    'OliveOps records location while this service is active, including when the app is in the background. Tracking stops when you finish service.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', onPress: () => void (async () => {
        if (identityKey && context) {
          const tracking = await startSnowBackgroundTracking(identityKey, context);
          if (!tracking.ok) setMessage('Background location is unavailable. Checkpoint updates will record that location permission was denied.');
          await queueAndSync('start-service');
        }
      })() },
    ],
  );

  const finishService = async () => {
    await stopSnowBackgroundTracking();
    await queueAndSync('finish-service');
  };

  const navigate = async () => {
    if (!currentStop?.address) return;
    const address = encodeURIComponent(currentStop.address);
    const url = Platform.OS === 'ios' ? `http://maps.apple.com/?q=${address}` : `geo:0,0?q=${address}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  };

  if (!effectiveCompanyFeatures.snowOperations) {
    return <PrimaryScreen><ScreenHeader title="Snow Assignment" /><EmptyState title="Snow Operations unavailable" message="Snow Operations are not available for this company." /></PrimaryScreen>;
  }

  if (!assignment?.route) {
    return <PrimaryScreen><ScreenHeader title="Snow Assignment" /><EmptyState title="No active Snow Route" message="You do not have an active Snow Route assigned right now." action={<SecondaryButton label="Check Again" onPress={() => void load()} />} />{message ? <StatusBanner tone="error" message={message} /> : null}</PrimaryScreen>;
  }

  return (
    <PrimaryScreen>
      <ScreenHeader eyebrow="Snow Operations" title={assignment.route.name} subtitle={assignment.event?.title} />
      {pending.length ? <StatusBanner tone={failed ? 'error' : 'offline'} message={failed?.error ?? `${pending.length} Snow update${pending.length === 1 ? '' : 's'} waiting to sync.`} /> : null}
      {message && !pending.length ? <StatusBanner tone="error" message={message} /> : null}
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>{assignment.progress?.completed ?? 0} of {assignment.progress?.total ?? assignment.stops.length} stops complete</Text>
        <Pressable accessibilityRole="button" onPress={() => void load()}><Text style={styles.link}>Refresh</Text></Pressable>
      </View>

      {assignment.route.status === 'not_started' ? (
        <PrimaryActionButton label={busy ? 'Starting Route...' : 'Start Route'} disabled={busy} onPress={() => void queueAndSync('start-route', {}, false)} />
      ) : currentStop ? (
        <>
          <SectionHeader title={`Stop ${currentStop.sortOrder + 1}`} />
          <SectionCard>
            <View style={styles.stopHeader}>
              <View style={styles.stopHeading}><Text style={styles.stopTitle}>{currentStop.propertyLabel || currentStop.customerNameSnapshot}</Text><Text style={styles.address}>{currentStop.address}</Text></View>
              <StatusBadge label={stopLabels[currentStop.status]} tone={currentStop.status === 'needs_attention' ? 'error' : 'active'} />
            </View>
            {currentStop.siteNotes ? <Text style={styles.siteNotes}>{currentStop.siteNotes}</Text> : null}
            <SecondaryButton label="Open in Maps" onPress={() => void navigate()} />
          </SectionCard>

          {currentStop.status === 'pending' ? <PrimaryActionButton label="En Route" disabled={busy} onPress={() => void queueAndSync('en-route')} /> : null}
          {currentStop.status === 'en_route' ? <PrimaryActionButton label="I've Arrived" disabled={busy} onPress={() => void queueAndSync('arrival')} /> : null}
          {currentStop.status === 'arrived' && !occurrence ? (
            <>
              <SectionHeader title="Service Performed" />
              <SectionCard>{serviceTypes.map((serviceType) => <ListRow key={serviceType.id} testID={`snow-service-${serviceType.id}`} title={serviceType.name} selected={selectedServiceTypeId === serviceType.id} onPress={() => setSelectedServiceTypeId(serviceType.id)} />)}</SectionCard>
              <PrimaryActionButton label="Continue" disabled={busy || !selectedServiceTypeId} onPress={() => void queueAndSync('select-service', { serviceTypeId: selectedServiceTypeId }, false)} />
            </>
          ) : null}
          {occurrence?.status === 'not_started' ? <PrimaryActionButton label="Take Before Photo" disabled={busy} onPress={() => void addPhoto('before-photo')} /> : null}
          {occurrence?.status === 'before_evidence_complete' ? <PrimaryActionButton label="Start Service" disabled={busy} onPress={beginService} /> : null}
          {occurrence?.status === 'active' ? <SectionCard><StatusBadge label="Service active · location recording" tone="success" /><InfoRow label="Service" value={occurrence.serviceTypeName} /><PrimaryActionButton label="Finish Service" disabled={busy} onPress={() => void finishService()} /></SectionCard> : null}
          {occurrence?.status === 'awaiting_after_evidence' && !occurrence.afterPhotoFileIds.length ? <PrimaryActionButton label="Take After Photo" disabled={busy} onPress={() => void addPhoto('after-photo')} /> : null}
          {occurrence?.status === 'awaiting_after_evidence' && occurrence.afterPhotoFileIds.length ? <PrimaryActionButton label="Complete Stop" disabled={busy} onPress={() => void queueAndSync('complete-service')} /> : null}
          <SecondaryButton label="Flag for Attention" disabled={busy || ['completed', 'skipped'].includes(currentStop.status)} onPress={() => void queueAndSync('flag-stop', { reason: 'Employee requested assistance' })} />
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => Alert.alert('Skip this stop?', 'Dispatch will see this stop as skipped.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Skip Stop', style: 'destructive', onPress: () => void queueAndSync('skip-stop') }])}><Text style={styles.skip}>Skip Stop</Text></Pressable>
        </>
      ) : (
        <SectionCard><Text style={styles.allDone}>All stops handled</Text><PrimaryActionButton label="Complete Route" disabled={busy} onPress={() => void queueAndSync('complete-route', {}, false)} /></SectionCard>
      )}
    </PrimaryScreen>
  );
}

const styles = StyleSheet.create({
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  progressText: { color: colors.textSecondary, fontSize: typography.bodySmall },
  link: { color: colors.primary, fontSize: typography.bodySmall, fontWeight: typography.bold },
  stopHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  stopHeading: { flex: 1, gap: spacing.xs },
  stopTitle: { color: colors.textPrimary, fontSize: typography.title, fontWeight: typography.bold },
  address: { color: colors.textSecondary, fontSize: typography.bodySmall, lineHeight: 20 },
  siteNotes: { color: colors.textPrimary, fontSize: typography.bodySmall, lineHeight: 20, borderLeftWidth: 3, borderLeftColor: colors.offline, paddingLeft: spacing.md },
  skip: { minHeight: 44, color: colors.error, fontSize: typography.bodySmall, fontWeight: typography.bold, textAlign: 'center', textAlignVertical: 'center' },
  allDone: { color: colors.success, fontSize: typography.title, fontWeight: typography.bold, textAlign: 'center' },
});