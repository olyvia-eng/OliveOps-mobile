import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { loadServiceVisitDetail } from '@/api/serviceVisitsApi';
import { loadEmployeeForms } from '@/api/formsApi';
import { EmptyState, InfoRow, ListRow, ScreenHeader, SectionCard, SectionHeader, StatusBadge } from '@/components/MobilePrimitives';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { serviceVisitPlaceLabel, serviceVisitStatusLabel, serviceVisitStatusTone, serviceVisitTimeLabel } from '@/features/serviceVisits/presentation';
import { useClockingActions } from '@/hooks/useClockingActions';
import { pickSinglePhoto, type PhotoSource } from '@/services/photoPicker';
import { loadServiceVisitOutbox, queueServiceVisitCompletion, queueServiceVisitNote, queueServiceVisitPhoto, replayServiceVisitOutbox, type ServiceVisitOutboxOperation } from '@/services/serviceVisitOutbox';
import { createRequestMeta, createFormClientSubmissionId } from '@/services/requestGuards';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { usePendingClockInStore } from '@/store/pendingClockInStore';
import { colors, spacing, typography } from '@/theme/colors';
import type { EmployeeForm } from '@/types/forms';
import type { ServiceVisitDetailResponse, ServiceVisitErrorCode } from '@/types/serviceVisit';
import { ApiError } from '@/types/errors';
import { formatBusinessDate } from '@/utils/businessTime';

const COMPLETION_MESSAGES: Partial<Record<ServiceVisitErrorCode, string>> = {
  VISIT_HAS_ACTIVE_TIME_ENTRIES: 'Clock out all employees from this Visit before completing it.',
  VISIT_REQUIRED_FORMS_OUTSTANDING: 'Complete the required Visit Forms before completing this Visit.',
  VISIT_REQUIRED_PHOTOS_OUTSTANDING: 'Add the required Visit photos before completing this Visit.',
  VISIT_REQUIRED_NOTE_OUTSTANDING: 'Add a Visit note before completing this Visit.',
  VISIT_STATUS_INVALID: 'This Visit can no longer be completed.',
  VISIT_NOT_ASSIGNED: 'This Visit is no longer assigned to you.',
  VISIT_REVISION_CONFLICT: 'This Visit changed. Refresh and try again.',
  VISIT_NOT_FOUND: 'This Visit is no longer available.',
  INVALID_CLIENT_SUBMISSION_ID: 'The completion request could not be verified. Try again.',
};

export default function ServiceVisitScreen() {
  const { jobId = '', visitId = '' } = useLocalSearchParams<{ jobId?: string; visitId?: string }>();
  const { accessToken, user } = useAuthStore();
  const { businessTimeZone, companyFeatures, currentActiveEntryId, timeEntries, todayServiceVisits, upcomingServiceVisits } = useClockingStore();
  const { clockIn, loading: clocking } = useClockingActions();
  const pendingClockIn = usePendingClockInStore();
  const [detail, setDetail] = useState<ServiceVisitDetailResponse | null>(null);
  const [visitForms, setVisitForms] = useState<EmployeeForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [pendingOperations, setPendingOperations] = useState<ServiceVisitOutboxOperation[]>([]);
  const completionId = useRef(createFormClientSubmissionId().replace('form-submission:', 'complete:'));
  const noteId = useRef(createFormClientSubmissionId().replace('form-submission:', 'note:'));
  const summary = useMemo(
    () => [...todayServiceVisits, ...upcomingServiceVisits].find((visit) => visit.id === visitId),
    [todayServiceVisits, upcomingServiceVisits, visitId],
  );
  const activeEntry = currentActiveEntryId
    ? timeEntries.find((entry) => entry.id === currentActiveEntryId && entry.status === 'clocked_in')
    : undefined;
  const thisVisitActive = activeEntry?.serviceVisitId === visitId;
  const featureAvailable = companyFeatures?.recurringServices === true || thisVisitActive;
  const identityKey = user?.employeeId ? `${user.businessId}:${user.id}:${user.employeeId}` : null;

  const refreshOutbox = useCallback(async () => {
    if (!identityKey || !visitId) return [];
    const operations = await loadServiceVisitOutbox(identityKey, visitId);
    setPendingOperations(operations);
    return operations;
  }, [identityKey, visitId]);

  const refresh = useCallback(async () => {
    if (!featureAvailable || !jobId || !visitId) return;
    setLoading(true);
    setError(null);
    try {
      if (identityKey) await replayServiceVisitOutbox(identityKey, accessToken);
      const [nextDetail, forms] = await Promise.all([
        loadServiceVisitDetail(jobId, visitId, accessToken),
        loadEmployeeForms(accessToken, { jobId, serviceId: summary?.serviceId, serviceVisitId: visitId }),
      ]);
      setDetail(nextDetail);
      setVisitForms([...forms.toDo, ...forms.available].filter((form, index, all) => all.findIndex((item) => item.id === form.id) === index));
      await refreshOutbox();
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : 'Could not refresh this Visit.');
      await refreshOutbox();
    } finally {
      setLoading(false);
    }
  }, [accessToken, featureAvailable, identityKey, jobId, refreshOutbox, summary?.serviceId, visitId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function startWork() {
    if (!user?.employeeId || !detail) return;
    setError(null);
    const request = createRequestMeta(user.employeeId);
    const result = await clockIn(user.employeeId, 'job', [detail.visit.jobId], undefined, request, undefined, undefined, {
      jobId: detail.visit.jobId,
      serviceId: detail.visit.serviceId,
      serviceVisitId: detail.visit.id,
      serviceName: detail.service.name,
      propertyName: summary ? serviceVisitPlaceLabel(summary) : undefined,
    });
    if (!result.ok) {
      setError(result.error ?? 'Could not start this Visit.');
      await refresh();
      return;
    }
    const pending = 'pendingWorkflow' in result ? result.pendingWorkflow : undefined;
    if (pending) {
      await pendingClockIn.acceptWorkflow(pending);
      router.replace('/home');
      return;
    }
    router.replace('/active-shift');
  }

  async function submitNote() {
    if (!detail || !identityKey || !note.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await queueServiceVisitNote({
        identityKey,
        jobId,
        serviceId: detail.visit.serviceId,
        serviceVisitId: detail.visit.id,
        clientSubmissionId: noteId.current,
        text: note.trim(),
      });
      setNote('');
      noteId.current = createFormClientSubmissionId().replace('form-submission:', 'note:');
      await refresh();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : 'Could not add the Visit note.');
    } finally {
      setBusy(false);
    }
  }

  async function addPhoto(source: PhotoSource) {
    if (!detail || !identityKey || busy) return;
    try {
      const asset = await pickSinglePhoto(source);
      if (!asset) return;
      setBusy(true);
      await queueServiceVisitPhoto({
        identityKey,
        jobId: detail.visit.jobId,
        serviceId: detail.visit.serviceId,
        serviceVisitId: detail.visit.id,
        clientSubmissionId: `photo:${Date.now().toString(36)}`,
        sourceUri: asset.uri,
      });
      await refresh();
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : 'Could not add the Visit photo.');
    } finally {
      setBusy(false);
    }
  }

  async function completeVisit() {
    if (!detail || !identityKey || busy) return;
    setBusy(true);
    setError(null);
    try {
      await queueServiceVisitCompletion({
        identityKey,
        jobId,
        serviceId: detail.visit.serviceId,
        serviceVisitId: detail.visit.id,
        clientSubmissionId: completionId.current,
      });
      await refresh();
    } catch (completeError) {
      const code = completeError instanceof ApiError ? completeError.code as ServiceVisitErrorCode | undefined : undefined;
      setError(code && COMPLETION_MESSAGES[code] ? COMPLETION_MESSAGES[code]! : 'Could not complete this Visit. Refresh and try again.');
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!featureAvailable) return <Screen><ScreenHeader title="Service Visit" /><EmptyState title="Visit unavailable" message="Service Visits are not available for this company." /></Screen>;
  if (loading && !detail) return <Screen><ScreenHeader title="Service Visit" /><StatusBanner tone="info" message="Loading Visit..." /></Screen>;
  if (!detail) return <Screen><ScreenHeader title="Service Visit" />{error ? <StatusBanner tone="error" message={error} /> : null}<EmptyState title="Visit unavailable" message="This Visit could not be loaded." action={<PrimaryActionButton label="Retry" onPress={() => void refresh()} />} /></Screen>;

  const { visit, service, completion } = detail;
  const place = summary ? serviceVisitPlaceLabel(summary) : detail.job.title;
  const canStart = ['scheduled', 'in_progress'].includes(visit.status) && !activeEntry;
  const queuedPhotoCount = pendingOperations.filter((operation) => operation.type === 'photo').length;
  const queuedNoteCount = pendingOperations.filter((operation) => operation.type === 'note').length;
  const pendingCompletion = pendingOperations.find((operation) => operation.type === 'complete');
  const failedOperation = pendingOperations.find((operation) => operation.status === 'failed');
  const effectivePhotoCount = completion.photoCount + queuedPhotoCount;
  const effectiveNoteCount = completion.noteCount + queuedNoteCount;
  const canComplete = ['scheduled', 'in_progress'].includes(visit.status)
    && completion.activeTimeEntryCount === 0
    && completion.missingFormIds.length === 0
    && effectivePhotoCount >= completion.minimumPhotoCount
    && (!completion.noteRequired || effectiveNoteCount > 0)
    && !pendingCompletion;

  return (
    <Screen testID="service-visit-screen">
      <ScreenHeader title={service.name} subtitle={place} action={<StatusBadge label={serviceVisitStatusLabel(visit.status)} tone={serviceVisitStatusTone(visit.status)} />} />
      {error ? <StatusBanner tone="error" message={error} /> : null}
      {pendingOperations.length > 0 ? <StatusBanner
        tone={failedOperation ? 'error' : 'offline'}
        message={failedOperation
          ? `${failedOperation.type === 'complete' ? 'Visit completion' : failedOperation.type === 'photo' ? 'A Visit photo' : 'A Visit note'} could not sync. ${failedOperation.errorCode && COMPLETION_MESSAGES[failedOperation.errorCode as ServiceVisitErrorCode] ? COMPLETION_MESSAGES[failedOperation.errorCode as ServiceVisitErrorCode] : failedOperation.error ?? 'Refresh and try again.'}`
          : `${pendingOperations.length} Visit ${pendingOperations.length === 1 ? 'change is' : 'changes are'} waiting to sync.`}
      /> : null}
      <SectionCard>
        {service.description ? <Text style={styles.description}>{service.description}</Text> : null}
        {summary?.propertyAddress ? <InfoRow label="Address" value={summary.propertyAddress} /> : null}
        <InfoRow label="Date" value={formatBusinessDate(new Date(`${visit.scheduledDate}T12:00:00`), businessTimeZone, { weekday: 'short', month: 'short', day: 'numeric' })} />
        {summary ? <InfoRow label="Time" value={serviceVisitTimeLabel(summary, businessTimeZone)} /> : null}
        {detail.crew ? <InfoRow label="Crew" value={detail.crew.name} /> : null}
      </SectionCard>

      {thisVisitActive ? <StatusBanner tone="success" message="You are currently working on this Visit." /> : null}
      {canStart ? <PrimaryActionButton label={clocking ? 'Starting Work...' : 'Start Work'} disabled={clocking} onPress={() => void startWork()} /> : null}
      {thisVisitActive ? <PrimaryActionButton label="View Active Shift" onPress={() => router.push('/active-shift')} /> : null}

      <View style={styles.section}>
        <SectionHeader title="Forms" />
        {visitForms.length ? <SectionCard>{visitForms.map((form) => <ListRow key={form.id} title={form.name} subtitle={form.completionRequirement === 'required' ? 'Required' : undefined} onPress={() => router.push({ pathname: '/form', params: { list: 'todo', formId: form.id, trigger: form.trigger, jobId: visit.jobId, serviceId: visit.serviceId, serviceVisitId: visit.id, returnTo: `/service-visit?jobId=${visit.jobId}&visitId=${visit.id}` } })} />)}</SectionCard> : <Text style={styles.muted}>No Visit Forms</Text>}
      </View>

      <View style={styles.section}>
        <SectionHeader title="SOPs" />
        {detail.sops.length ? <SectionCard>{detail.sops.map((sop) => <ListRow key={`${sop.sopId}:${sop.version}`} title={sop.title} subtitle={sop.shortDescription || sop.category} onPress={() => router.push({ pathname: '/sop-detail', params: { sopId: sop.sopId, expectedVersion: String(sop.version) } })} />)}</SectionCard> : <Text style={styles.muted}>No SOPs for this Visit</Text>}
      </View>

      <View style={styles.section}>
        <SectionHeader title={`Photos (${effectivePhotoCount})`} />
        <View style={styles.inlineActions}>
          <SecondaryButton label="Camera" disabled={busy} onPress={() => void addPhoto('camera')} />
          <SecondaryButton label="Photo Library" disabled={busy} onPress={() => void addPhoto('library')} />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Notes" />
        {(visit.visitNotes ?? []).map((item) => <SectionCard key={item.id}><Text style={styles.note}>{item.text}</Text><Text style={styles.meta}>{[item.authorName, new Date(item.createdAt).toLocaleString()].filter(Boolean).join(' · ')}</Text></SectionCard>)}
        <TextInput accessibilityLabel="Visit note" multiline value={note} onChangeText={setNote} placeholder="Add an operational note" placeholderTextColor={colors.inputPlaceholder} style={styles.input} />
        <SecondaryButton label={busy ? 'Adding Note...' : 'Add Note'} disabled={busy || !note.trim()} onPress={() => void submitNote()} />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Completion" />
        <SectionCard>
          {completion.requiredFormIds.length ? <InfoRow label="Required Forms" value={`${completion.completedFormIds.length}/${completion.requiredFormIds.length}`} /> : null}
          {completion.minimumPhotoCount > 0 ? <InfoRow label="Photos" value={`${effectivePhotoCount}/${completion.minimumPhotoCount}`} /> : null}
          {completion.noteRequired ? <InfoRow label="Visit Note" value={effectiveNoteCount > 0 ? 'Complete' : 'Missing'} /> : null}
          {completion.activeTimeEntryCount > 0 ? <Text style={styles.blocked}>Clock out before completing this Visit.</Text> : null}
        </SectionCard>
        {visit.status === 'completed' ? <StatusBanner tone="success" message="This Visit is complete." /> : null}
        {['skipped', 'cancelled'].includes(visit.status) ? <StatusBanner tone="info" message={`This Visit is ${visit.status}.`} /> : null}
        {pendingCompletion ? <StatusBanner tone="offline" message="Visit completion is waiting to sync." /> : null}
        {['scheduled', 'in_progress'].includes(visit.status) ? <PrimaryActionButton label={busy ? 'Completing...' : 'Complete Visit'} disabled={busy || !canComplete} onPress={() => Alert.alert('Complete Visit?', 'Clock out and confirm all required evidence before completing this Visit.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Complete Visit', onPress: () => void completeVisit() }])} /> : null}
      </View>
      <Pressable accessibilityRole="button" onPress={() => void refresh()}><Text style={styles.refresh}>Refresh Visit</Text></Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  description: { color: colors.textPrimary, fontSize: typography.body, lineHeight: 23 },
  muted: { color: colors.textSecondary, fontSize: typography.bodySmall },
  note: { color: colors.textPrimary, fontSize: typography.body },
  meta: { color: colors.textMuted, fontSize: typography.caption },
  input: { minHeight: 96, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface, color: colors.textPrimary, padding: spacing.md, textAlignVertical: 'top' },
  inlineActions: { gap: spacing.sm },
  blocked: { color: colors.error, fontSize: typography.bodySmall, fontWeight: '600' },
  refresh: { color: colors.primary, fontSize: typography.bodySmall, fontWeight: '700', textAlign: 'center', padding: spacing.md },
});