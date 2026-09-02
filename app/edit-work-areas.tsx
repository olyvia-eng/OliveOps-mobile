import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useNavigation } from 'expo-router';
import * as clockingApi from '@/api/clockingApi';
import { ListRow, ScreenHeader, SectionHeader, StatusBadge } from '@/components/MobilePrimitives';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { SecondaryButton } from '@/components/SecondaryButton';
import { StatusBanner } from '@/components/StatusBanner';
import { formatDurationMinutes, getCurrentShiftSegments, getWorkTypeLabel } from '@/features/clocking/presentation';
import {
  changeDraftWorkArea,
  changeSharedBoundary,
  createWorkAreaTimelineDraft,
  defaultSplitAt,
  eligibleWorkAreasForSegment,
  isEditableSharedBoundary,
  replaceCurrentShiftTimeline,
  segmentDurationMinutes,
  serializeEditableWorkAreaSegments,
  splitWorkAreaSegment,
  workAreaTimelineDraftFingerprint,
  type WorkAreaTimelineDraftSegment,
} from '@/features/clocking/workAreaTimeline';
import { isOnline } from '@/services/connectivity';
import { createRequestMeta } from '@/services/requestGuards';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { colors, radii, spacing, typography } from '@/theme/colors';
import type { CurrentShiftWorkAreaTimelineResponse } from '@/types/api';
import { ApiError } from '@/types/errors';
import { businessDateKey, businessLocalDateTimeToIso, businessTimeValue, formatBusinessTime } from '@/utils/businessTime';
import { toUserFacingError } from '@/utils/userFacingError';

type Selection = { kind: 'area' | 'split'; segmentIndex: number; splitAt?: string };
type BoundarySelection =
  | { kind: 'boundary'; boundaryIndex: number; originalAt: string; draftDate: Date; minimumAt: string; maximumAt: string }
  | { kind: 'split'; segmentIndex: number; originalAt: string; draftDate: Date; minimumAt: string; maximumAt: string };

function pickerDate(instant: string, timeZone: string) {
  const [hour, minute] = businessTimeValue(new Date(instant), timeZone).split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

function boundaryIso(originalAt: string, date: Date, timeZone: string) {
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return businessLocalDateTimeToIso(businessDateKey(new Date(originalAt), timeZone), time, timeZone);
}

function codeFor(error: unknown) {
  return error instanceof ApiError ? error.code?.toLowerCase() : undefined;
}

export default function EditWorkAreasScreen() {
  const navigation = useNavigation();
  const { accessToken, user } = useAuthStore();
  const {
    businessTimeZone,
    clockingCapabilities,
    currentActiveEntryId,
    jobs,
    timeEntries,
    setClockingCapabilities,
    setCurrentActiveEntryId,
    setTimeEntries,
  } = useClockingStore();
  const [authoritative, setAuthoritative] = useState<CurrentShiftWorkAreaTimelineResponse | null>(null);
  const [draft, setDraft] = useState<WorkAreaTimelineDraftSegment[]>([]);
  const [initialFingerprint, setInitialFingerprint] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [boundarySelection, setBoundarySelection] = useState<BoundarySelection | null>(null);
  const savingRef = useRef(false);
  const savedRef = useRef(false);
  const requestIdRef = useRef('');

  const dirty = workAreaTimelineDraftFingerprint(draft) !== initialFingerprint;
  const editable = Boolean(clockingCapabilities.editShiftWorkAreas && authoritative?.canEdit && !offline);
  const draftComplete = draft.filter((segment) => segment.editable).every((segment) => Boolean(segment.jobId && segment.workAreaId));
  const localTimeline = useMemo(() => getCurrentShiftSegments(timeEntries, user?.employeeId, currentActiveEntryId), [currentActiveEntryId, timeEntries, user?.employeeId]);

  const acceptTimeline = useCallback((response: CurrentShiftWorkAreaTimelineResponse, message?: string) => {
    const nextDraft = createWorkAreaTimelineDraft(response.timeline);
    setAuthoritative(response);
    setDraft(nextDraft);
    setInitialFingerprint(workAreaTimelineDraftFingerprint(nextDraft));
    requestIdRef.current = createRequestMeta(response.activeEntryId).requestId;
    setNotice(message ?? null);
  }, []);

  const loadTimeline = useCallback(async (message?: string) => {
    setLoading(true);
    setError(null);
    const online = await isOnline();
    setOffline(!online);
    if (!online) {
      const response = {
        ok: true,
        timeline: localTimeline,
        activeEntryId: currentActiveEntryId ?? '',
        timelineRevision: '',
        canEdit: false,
      };
      acceptTimeline(response, message);
      setLoading(false);
      return;
    }
    try {
      acceptTimeline(await clockingApi.loadCurrentShiftWorkAreaTimeline(accessToken), message);
    } catch (loadError) {
      setError(toUserFacingError(loadError, 'Could not load the current shift timeline.'));
    } finally {
      setLoading(false);
    }
  }, [acceptTimeline, accessToken, currentActiveEntryId, localTimeline]);

  useEffect(() => { void loadTimeline(); }, []);

  useEffect(() => navigation.addListener('beforeRemove', (event: { preventDefault: () => void; data: { action: unknown } }) => {
    if (!dirty || savedRef.current) return;
    event.preventDefault();
    Alert.alert('Discard changes?', "Your Work Area changes haven't been saved.", [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(event.data.action as never) },
    ]);
  }), [dirty, navigation]);

  const totalMinutes = useMemo(() => draft.reduce((total, segment) => total + segmentDurationMinutes(segment), 0), [draft]);

  function openAreaSelection(segmentIndex: number) {
    if (!editable || !draft[segmentIndex]?.editable) return;
    setSelection({ kind: 'area', segmentIndex });
  }

  function beginSplit(segmentIndex: number) {
    if (!editable) return;
    const segment = draft[segmentIndex];
    const splitAt = defaultSplitAt(segment);
    if (!splitAt) {
      setError('This segment is too short to split.');
      return;
    }
    const maximumMs = (segment.endAt ? Date.parse(segment.endAt) : Date.now()) - 60000;
    setBoundarySelection({
      kind: 'split',
      segmentIndex,
      originalAt: splitAt,
      draftDate: pickerDate(splitAt, businessTimeZone),
      minimumAt: new Date(Date.parse(segment.startAt) + 60000).toISOString(),
      maximumAt: new Date(maximumMs).toISOString(),
    });
  }

  function chooseWorkArea(workArea: { id: string; name: string }) {
    if (!selection) return;
    setDraft((current) => selection.kind === 'split' && selection.splitAt
      ? splitWorkAreaSegment(current, selection.segmentIndex, selection.splitAt, workArea)
      : changeDraftWorkArea(current, selection.segmentIndex, workArea));
    setSelection(null);
    setError(null);
  }

  function openBoundary(boundaryIndex: number) {
    if (!editable || !isEditableSharedBoundary(draft, boundaryIndex)) return;
    const originalAt = draft[boundaryIndex].startAt;
    const maximumMs = (draft[boundaryIndex].endAt ? Date.parse(draft[boundaryIndex].endAt!) : Date.now()) - 60000;
    setBoundarySelection({
      kind: 'boundary',
      boundaryIndex,
      originalAt,
      draftDate: pickerDate(originalAt, businessTimeZone),
      minimumAt: new Date(Date.parse(draft[boundaryIndex - 1].startAt) + 60000).toISOString(),
      maximumAt: new Date(maximumMs).toISOString(),
    });
  }

  async function save() {
    if (savingRef.current || !authoritative || !dirty) return;
    savingRef.current = true;
    if (!await isOnline()) {
      savingRef.current = false;
      setOffline(true);
      setError('Reconnect to edit Work Area times.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await clockingApi.reconcileCurrentShiftWorkAreas({
        clientRequestId: requestIdRef.current,
        timelineRevision: authoritative.timelineRevision,
        segments: serializeEditableWorkAreaSegments(draft),
      }, accessToken);
      setTimeEntries(replaceCurrentShiftTimeline(timeEntries, authoritative.timeline, response.timeline));
      setCurrentActiveEntryId(response.activeEntryId);
      savedRef.current = true;
      router.replace('/clock-out');
    } catch (saveError) {
      const code = codeFor(saveError);
      if (code === 'shift_timeline_changed') {
        await loadTimeline("Your shift changed while you were editing. We've refreshed the latest times.");
      } else if (code === 'shift_work_area_edit_not_allowed' || code === 'current_shift_self_service_forbidden') {
        setClockingCapabilities({ ...clockingCapabilities, editShiftWorkAreas: false });
        setError('Work Area editing is no longer available for your account.');
      } else {
        setError(toUserFacingError(saveError, 'Work Area changes could not be saved. Please try again.'));
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const selectedSegment = selection ? draft[selection.segmentIndex] : null;
  const availableAreas = selectedSegment ? eligibleWorkAreasForSegment(selectedSegment, jobs) : [];

  return (
    <Screen>
      <ScreenHeader title="Edit Work Areas" subtitle="Adjust today's Work Area times" />
      {offline ? <StatusBanner tone="offline" message="Reconnect to edit Work Area times." /> : null}
      {notice ? <StatusBanner tone="info" message={notice} /> : null}
      {error ? <StatusBanner tone="error" message={error} /> : null}
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.meta}>Loading shift...</Text></View>
      ) : (
        <>
          <SectionHeader title={draft[0]?.jobId ? jobs.find((job) => job.id === draft[0].jobId)?.title ?? 'Current Job' : "Today's Shift"} />
          <View style={styles.timeline}>
            {draft.map((segment, index) => (
              <View key={segment.draftId} testID={`timeline-segment-${index}`} style={[styles.segment, !segment.editable && styles.lockedSegment]}>
                <View style={styles.segmentTop}>
                  <Text style={styles.timeRange}>
                    {formatBusinessTime(new Date(segment.startAt), businessTimeZone, { hour: 'numeric', minute: '2-digit' })}
                    {' - '}
                    {segment.endAt ? formatBusinessTime(new Date(segment.endAt), businessTimeZone, { hour: 'numeric', minute: '2-digit' }) : 'Now'}
                  </Text>
                  <Text style={styles.duration}>{formatDurationMinutes(segmentDurationMinutes(segment))}</Text>
                </View>
                {segment.editable ? (
                  <Pressable testID={`work-area-${index}`} accessibilityRole="button" style={styles.largeRow} onPress={() => openAreaSelection(index)}>
                    <View style={styles.rowText}>
                      <Text style={styles.areaName}>{segment.workAreaName ?? 'Choose Work Area'}</Text>
                      <Text style={styles.meta}>{segment.jobId ? jobs.find((job) => job.id === segment.jobId)?.title ?? 'Current Job' : ''}</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                ) : (
                  <View style={styles.largeRow}>
                    <View style={styles.rowText}><Text style={styles.areaName}>{getWorkTypeLabel(segment.workType)}</Text><Text style={styles.meta}>Locked</Text></View>
                    <StatusBadge label="Locked" />
                  </View>
                )}
                {index > 0 && isEditableSharedBoundary(draft, index) ? (
                  <Pressable testID={`boundary-${index}`} accessibilityRole="button" style={styles.boundaryButton} onPress={() => openBoundary(index)}>
                    <Text style={styles.boundaryText}>Change boundary at {formatBusinessTime(new Date(segment.startAt), businessTimeZone, { hour: 'numeric', minute: '2-digit' })}</Text>
                  </Pressable>
                ) : null}
                {segment.editable && editable ? (
                  <Pressable testID={`split-segment-${index}`} accessibilityRole="button" style={styles.splitButton} onPress={() => beginSplit(index)}>
                    <Text style={styles.splitText}>+ Add Work Area Change</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>{formatDurationMinutes(totalMinutes)}</Text></View>
          {!authoritative?.canEdit && !offline ? <StatusBanner tone="info" message="Work Area editing is not available for this shift." /> : null}
          <View style={styles.actions}>
            <SecondaryButton label="Cancel" onPress={() => router.back()} />
            <PrimaryActionButton label={saving ? 'Saving changes...' : 'Save Changes'} disabled={!editable || !dirty || !draftComplete || saving} onPress={() => { void save(); }} />
          </View>
        </>
      )}

      <Modal transparent animationType="slide" visible={Boolean(selection)} onRequestClose={() => setSelection(null)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelection(null)} accessibilityLabel="Cancel Work Area selection" />
          <View style={styles.sheet}>
            <SectionHeader title={selection?.kind === 'split' ? 'Choose New Work Area' : 'Change Work Area'} />
            {availableAreas.map((area) => (
              <ListRow key={area.id} testID={`work-area-option-${area.id}`} title={area.name} selected={selectedSegment?.workAreaId === area.id} onPress={() => chooseWorkArea(area)} />
            ))}
            <SecondaryButton label="Cancel" onPress={() => setSelection(null)} />
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="slide" visible={Boolean(boundarySelection)} onRequestClose={() => setBoundarySelection(null)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setBoundarySelection(null)} accessibilityLabel="Cancel boundary selection" />
          <View style={styles.sheet}>
            <View style={styles.pickerToolbar}>
              <Pressable accessibilityRole="button" onPress={() => setBoundarySelection(null)}><Text style={styles.toolbarAction}>Cancel</Text></Pressable>
              <Text style={styles.pickerTitle}>{boundarySelection?.kind === 'split' ? 'Add Work Area Change' : 'Change Work Area Time'}</Text>
              <Pressable
                testID="boundary-done"
                accessibilityRole="button"
                onPress={() => {
                  if (!boundarySelection) return;
                  const next = boundaryIso(boundarySelection.originalAt, boundarySelection.draftDate, businessTimeZone);
                  if (next && boundarySelection.kind === 'boundary') {
                    setDraft((current) => changeSharedBoundary(current, boundarySelection.boundaryIndex, next));
                  } else if (next && boundarySelection.kind === 'split') {
                    setSelection({ kind: 'split', segmentIndex: boundarySelection.segmentIndex, splitAt: next });
                  }
                  setBoundarySelection(null);
                }}
              ><Text style={styles.toolbarAction}>Done</Text></Pressable>
            </View>
            {boundarySelection ? (
              <DateTimePicker
                testID="boundary-time-picker"
                value={boundarySelection.draftDate}
                mode="time"
                display="spinner"
                minimumDate={pickerDate(boundarySelection.minimumAt, businessTimeZone)}
                maximumDate={pickerDate(boundarySelection.maximumAt, businessTimeZone)}
                minuteInterval={1}
                onChange={(_, selected) => { if (selected) setBoundarySelection((current) => current ? { ...current, draftDate: selected } : null); }}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  timeline: { gap: spacing.sm },
  segment: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radii.lg, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
  lockedSegment: { backgroundColor: colors.surfaceMuted },
  segmentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  timeRange: { flex: 1, color: colors.textSecondary, fontSize: typography.bodySmall },
  duration: { color: colors.textPrimary, fontSize: typography.bodySmall, fontWeight: typography.bold },
  largeRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  rowText: { flex: 1, gap: 2 },
  areaName: { color: colors.textPrimary, fontSize: typography.body, fontWeight: typography.bold },
  meta: { color: colors.textSecondary, fontSize: typography.bodySmall },
  chevron: { color: colors.textMuted, fontSize: 26 },
  boundaryButton: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, paddingHorizontal: spacing.md },
  boundaryText: { color: colors.primary, fontSize: typography.bodySmall, fontWeight: typography.semibold },
  splitButton: { minHeight: 44, justifyContent: 'center' },
  splitText: { color: colors.primary, fontSize: typography.bodySmall, fontWeight: typography.bold },
  totalRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.divider },
  totalLabel: { color: colors.textPrimary, fontSize: typography.body, fontWeight: typography.bold },
  totalValue: { color: colors.primary, fontSize: typography.title, fontWeight: typography.bold },
  actions: { gap: spacing.sm },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23, 32, 25, 0.35)' },
  sheet: { maxHeight: '75%', backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  pickerToolbar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  pickerTitle: { flex: 1, textAlign: 'center', color: colors.textPrimary, fontSize: typography.body, fontWeight: typography.bold },
  toolbarAction: { color: colors.primary, fontSize: typography.body, fontWeight: typography.semibold },
});