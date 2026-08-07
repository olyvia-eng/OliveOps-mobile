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
        <Text style={styles.help}>Choose your assigned job and confirm.</Text>
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
                  <Text style={styles.jobTitle}>{job.title || 'Untitled Job'}</Text>
                  <Text style={styles.jobMeta}>{selected ? 'Selected' : job.status.replace('_', ' ')}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {status ? <StatusBanner tone="success" message={status} /> : null}
      {error ? <StatusBanner tone="error" message={error} /> : null}

      <PrimaryActionButton
        label={loading ? 'Submitting...' : 'Confirm Clock In'}
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
    backgroundColor: '#111827',
    padding: 16,
    gap: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  help: {
    color: '#CBD5E1',
    fontSize: 14,
  },
  jobsList: {
    gap: 10,
  },
  jobRow: {
    minHeight: 64,
    borderRadius: 10,
    borderColor: '#334155',
    borderWidth: 1,
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    gap: 4,
  },
  jobRowSelected: {
    borderColor: '#16A34A',
    backgroundColor: '#052E16',
  },
  jobTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  jobMeta: {
    color: '#CBD5E1',
    fontSize: 14,
  },
});
