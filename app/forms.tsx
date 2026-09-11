import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, ScreenHeader, SegmentedControl, StatusBadge } from '@/components/MobilePrimitives';
import { ErrorState } from '@/components/ErrorState';
import { FormContextSummary } from '@/components/FormContextSummary';
import { LoadingState } from '@/components/LoadingState';
import { StatusBanner } from '@/components/StatusBanner';
import {
  formatSubmittedAt,
  getFormTriggerLabel,
  getSubmissionStatusLabel,
} from '@/features/forms/formPresentation';
import { useFormsActions } from '@/hooks/useFormsActions';
import { useClockingStore } from '@/store/clockingStore';
import { useFormsStore } from '@/store/formsStore';
import { pendingClockInRequirementForm, pendingClockInRequirements, usePendingClockInStore } from '@/store/pendingClockInStore';
import { requirementForm, usePendingClockOutStore, workflowRequirements } from '@/store/pendingClockOutStore';
import { colors, radii, spacing, typography } from '@/theme/colors';
import type { EmployeeForm, EmployeeFormSubmission } from '@/types/forms';

type FormsTab = 'todo' | 'available' | 'completed';
type FormsListItem = { kind: 'form'; value: EmployeeForm } | { kind: 'submission'; value: EmployeeFormSubmission };

const tabs: Array<{ id: FormsTab; label: string }> = [
  { id: 'todo', label: 'To Do' },
  { id: 'available', label: 'Available' },
  { id: 'completed', label: 'Completed' },
];

export default function FormsScreen() {
  const { businessTimeZone } = useClockingStore();
  const { toDo, available, completed, loadedAt, flashMessage, setFlashMessage } = useFormsStore();
  const { refreshForms, loadingWorkspace } = useFormsActions();
  const pendingClockIn = usePendingClockInStore();
  const pendingClockOut = usePendingClockOutStore();
  const [tab, setTab] = useState<FormsTab>('todo');
  const [error, setError] = useState<string | null>(null);
  const requestedRef = useRef(false);
  const selectedInitialTabRef = useRef(false);

  const actionableToDo = useMemo(() => {
    const items = new Map<string, EmployeeForm>();
    const identity = (form: EmployeeForm) => form.workflowOccurrenceId && form.workflowRequirementId
      ? `workflow:${form.workflowOccurrenceId}:${form.workflowRequirementId}`
      : `form:${form.id}:${form.trigger}:${form.periodKey ?? ''}:${form.context?.jobId ?? ''}:${form.context?.equipmentId ?? ''}:${form.context?.divisionId ?? ''}:${form.context?.serviceId ?? ''}:${form.context?.serviceVisitId ?? ''}`;
    for (const form of toDo) items.set(identity(form), form);

    const clockInOccurrenceId = pendingClockIn.workflow?.workflowOccurrenceId;
    if (clockInOccurrenceId) {
      for (const requirement of pendingClockInRequirements(pendingClockIn.workflow).filter((item) => !item.completed)) {
        const form = pendingClockInRequirementForm(requirement);
        if (!form) continue;
        const workflowForm: EmployeeForm = {
          ...form,
          workflowOccurrenceId: clockInOccurrenceId,
          workflowRequirementId: requirement.requirementId,
          requiredFor: 'clock_in',
        };
        items.set(identity(workflowForm), workflowForm);
      }
    }

    const clockOutOccurrenceId = pendingClockOut.workflow?.workflowOccurrenceId;
    if (clockOutOccurrenceId) {
      for (const requirement of workflowRequirements(pendingClockOut.workflow).filter((item) => !item.completed)) {
        const form = requirementForm(requirement);
        if (!form) continue;
        const workflowForm: EmployeeForm = {
          ...form,
          workflowOccurrenceId: clockOutOccurrenceId,
          workflowRequirementId: requirement.workflowRequirementId,
          requiredFor: 'clock_out',
        };
        items.set(identity(workflowForm), workflowForm);
      }
    }
    return [...items.values()];
  }, [pendingClockIn.workflow, pendingClockOut.workflow, toDo]);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    void refreshForms().then((result) => setError(result.ok ? null : (result.error ?? null)));
  }, [refreshForms]);

  useEffect(() => {
    if (!loadedAt || selectedInitialTabRef.current) return;
    selectedInitialTabRef.current = true;
    if (actionableToDo.length === 0 && available.length > 0) setTab('available');
  }, [actionableToDo.length, available.length, loadedAt]);

  const data: FormsListItem[] = tab === 'todo'
    ? actionableToDo.map((value) => ({ kind: 'form', value }))
    : tab === 'available'
      ? available.map((value) => ({ kind: 'form', value }))
      : completed.map((value) => ({ kind: 'submission', value }));

  async function onRefresh() {
    const [result] = await Promise.all([
      refreshForms({ force: true }),
      pendingClockIn.recover(),
      pendingClockOut.recover(),
    ]);
    setError(result.ok ? null : (result.error ?? null));
  }

  function openForm(form: EmployeeForm) {
    router.push({
      pathname: '/form',
      params: {
        list: tab,
        formId: form.id,
        trigger: form.trigger,
        jobId: form.context?.jobId,
        equipmentId: form.context?.equipmentId,
        divisionId: form.context?.divisionId,
        serviceId: form.context?.serviceId,
        serviceVisitId: form.context?.serviceVisitId,
        workflowOccurrenceId: form.workflowOccurrenceId,
        workflowRequirementId: form.workflowRequirementId,
      },
    });
  }

  if (!loadedAt && loadingWorkspace) {
    return <SafeAreaView style={styles.safe} edges={['left', 'right']}><LoadingState label="Loading Forms..." /></SafeAreaView>;
  }

  if (!loadedAt && error) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right']}>
        <View style={styles.stateContent}><ErrorState message={error} onRetry={() => { void onRefresh(); }} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.kind === 'form'
          ? item.value.workflowOccurrenceId && item.value.workflowRequirementId
            ? `${item.value.workflowOccurrenceId}:${item.value.workflowRequirementId}`
            : `${item.value.id}:${item.value.trigger}:${item.value.context?.jobId ?? ''}:${item.value.context?.equipmentId ?? ''}:${item.value.context?.divisionId ?? ''}`
          : item.value.submissionId}
        contentContainerStyle={styles.content}
        refreshing={loadingWorkspace}
        onRefresh={() => { void onRefresh(); }}
        ListHeaderComponent={(
          <View style={styles.header}>
            <ScreenHeader title="Forms" subtitle="Complete and review your employee forms" />
            {flashMessage ? <StatusBanner tone="success" message={flashMessage} /> : null}
            {flashMessage ? (
              <Pressable accessibilityRole="button" onPress={() => setFlashMessage(null)}>
                <Text style={styles.dismiss}>Dismiss</Text>
              </Pressable>
            ) : null}
            {error ? <StatusBanner tone="error" message={error} /> : null}
            <SegmentedControl
              testIDPrefix="forms-tab"
              value={tab}
              onChange={setTab}
              options={tabs.map((item) => ({
                value: item.id,
                label: `${item.label} ${item.id === 'todo' ? actionableToDo.length : item.id === 'available' ? available.length : completed.length}`,
              }))}
            />
          </View>
        )}
        ListEmptyComponent={(
          <EmptyState
            title={tab === 'todo' ? "You're all caught up" : tab === 'available' ? 'No additional forms available' : 'No completed forms yet'}
            message={tab === 'todo' ? 'No forms require your attention.' : tab === 'available' ? 'Optional forms will appear here when available.' : 'Submitted forms will appear here.'}
          />
        )}
        renderItem={({ item }) => item.kind === 'form' ? (
          <Pressable
            testID={`form-row-${item.value.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.value.name}`}
            onPress={() => openForm(item.value)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.rowTop}>
              <Text style={styles.rowTitle}>{item.value.name}</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
            {item.value.category ? <Text style={styles.category}>{item.value.category}</Text> : null}
            <Text style={[styles.reason, item.value.trigger === 'on_demand' && styles.availableReason]}>
              {item.value.requiredFor === 'clock_in'
                ? 'Required for clock-in'
                : item.value.requiredFor === 'clock_out'
                  ? 'Required for clock-out'
                  : getFormTriggerLabel(item.value.trigger)}
            </Text>
            <FormContextSummary context={item.value.context} />
          </Pressable>
        ) : (
          <Pressable
            testID={`submission-row-${item.value.submissionId}`}
            accessibilityRole="button"
            accessibilityLabel={`Open completed ${item.value.formName}`}
            onPress={() => router.push({ pathname: '/form-submission', params: { id: item.value.submissionId } })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.rowTop}>
              <Text style={styles.rowTitle}>{item.value.formName}</Text>
              <StatusBadge
                label={getSubmissionStatusLabel(item.value.status)}
                tone={item.value.status === 'approved' ? 'success' : item.value.status === 'rejected' ? 'error' : 'neutral'}
              />
            </View>
            <Text style={styles.rowMeta}>Submitted {formatSubmittedAt(item.value.submittedAt, businessTimeZone)}</Text>
            <FormContextSummary context={item.value.context} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  stateContent: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  header: { gap: spacing.md, paddingBottom: spacing.md },
  dismiss: { color: colors.primary, fontSize: typography.bodySmall, fontWeight: typography.bold, textAlign: 'right' },
  row: { gap: spacing.xs, minHeight: 72, borderTopWidth: 1, borderTopColor: colors.divider, paddingVertical: spacing.md },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  rowTitle: { flex: 1, color: colors.textPrimary, fontSize: typography.body, fontWeight: typography.bold },
  category: { color: colors.textMuted, fontSize: typography.caption, fontWeight: typography.semibold, textTransform: 'uppercase' },
  reason: { color: colors.primary, fontSize: typography.bodySmall, fontWeight: typography.bold },
  availableReason: { color: colors.textSecondary },
  rowMeta: { color: colors.textSecondary, fontSize: typography.bodySmall },
  chevron: { color: colors.textMuted, fontSize: 24 },
  pressed: { opacity: 0.65 },
});