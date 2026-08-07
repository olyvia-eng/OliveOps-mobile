import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { OfflineNotice } from '@/components/OfflineNotice';
import { PrimaryActionButton } from '@/components/PrimaryActionButton';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { useClockingActions } from '@/hooks/useClockingActions';
import { createRequestMeta } from '@/services/requestGuards';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';
import { colors } from '@/theme/colors';

export default function ClockInScreen() {
  const { user } = useAuthStore();
  const { jobs } = useClockingStore();
  const { clockIn, loading, refreshWorkContext } = useClockingActions();
  const [selectedJobId, setSelectedJobId] = useState('');
  const [retryMeta, setRetryMeta] = useState<{ requestId: string; idempotencyKey: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshWorkContext();
  }, [refreshWorkContext]);

  const assignedJobs = useMemo(() => {
    const employeeId = user?.employeeId;
    return jobs.filter((job) => {
      if (job.status !== 'scheduled' && job.status !== 'in_progress') return false;
      if (!employeeId) return true;
      if (!Array.isArray(job.assignedEmployeeIds) || job.assignedEmployeeIds.length === 0) return true;
      return job.assignedEmployeeIds.includes(employeeId);
    });
  }, [jobs, user?.employeeId]);

  const canSubmit = useMemo(() => Boolean(user?.employeeId && selectedJobId), [selectedJobId, user?.employeeId]);

  async function submitClockIn(metaOverride?: { requestId: string; idempotencyKey: string }) {
    if (!user?.employeeId) {
      setError('Employee profile is not linked to this account.');
      return;
    }

    if (!selectedJobId) {
      setError('Select an assigned job before clocking in.');
      return;
    }

    setStatus(null);
    setError(null);

    const meta = metaOverride ?? retryMeta ?? createRequestMeta(user.employeeId);
    setRetryMeta(meta);

    const result = await clockIn(user.employeeId, [selectedJobId], meta);

    if (!result.ok) {
      setError(result.error || 'Clock-in failed.');
      return;
    }

    setRetryMeta(null);
    setStatus('Clock-in submitted successfully.');
    router.replace('/active-shift');
  }

  return (
    <Screen>
      <OfflineNotice />
      <View style={styles.card}>
        <Text style={styles.title}>Clock In</Text>
        <Text style={styles.help}>Choose your assigned job and confirm your shift.</Text>
        {assignedJobs.length === 0 ? (
          <StatusBanner tone="info" message="No assigned scheduled/in-progress jobs available." />
        ) : (
          <View style={styles.jobsList}>
            {assignedJobs.map((job) => {
              const selected = selectedJobId === job.id;
              return (
                <Pressable
                  key={job.id}
                  onPress={() => setSelectedJobId(job.id)}
                  style={[styles.jobRow, selected && styles.jobRowSelected]}
                >
                  <View style={styles.jobTextBlock}>
                    <Text style={styles.jobTitle}>{job.title || 'Untitled Job'}</Text>
                    <Text style={styles.jobMeta}>{job.status.replace('_', ' ')}</Text>
                  </View>
                  <View style={[styles.checkDot, selected && styles.checkDotSelected]}>
                    {selected ? <Text style={styles.checkMark}>✓</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {status ? <StatusBanner tone="success" message={status} /> : null}
      {error ? <StatusBanner tone="error" message={error} /> : null}

      <PrimaryActionButton
        label={loading ? 'Clocking in...' : 'Clock In'}
        disabled={!canSubmit || loading}
        onPress={() => void submitClockIn()}
      />

      {error && retryMeta ? (
        <PrimaryActionButton
          label="Retry Clock In"
          disabled={loading}
          onPress={() => void submitClockIn(retryMeta)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 10,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 31,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  help: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
  },
  jobsList: {
    gap: 10,
  },
  jobRow: {
    minHeight: 64,
    borderRadius: 12,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  jobRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.inputFocusBackground,
  },
  jobTextBlock: {
    flex: 1,
    gap: 4,
  },
  jobTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '600',
  },
  jobMeta: {
    color: colors.textSecondary,
    fontSize: 14,
    textTransform: 'capitalize',
  },
  checkDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkDotSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkMark: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
});
