import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { formatTimestamp, formatDuration, calculateDuration } from '../utils/timeUtils';

export default function ClockScreen() {
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState(null);
  const [history, setHistory] = useState([]);

  const handleClockIn = useCallback(() => {
    const now = new Date();
    setClockInTime(now);
    setIsClockedIn(true);
  }, []);

  const handleClockOut = useCallback(() => {
    const now = new Date();
    const entry = {
      id: String(now.getTime()),
      clockIn: clockInTime,
      clockOut: now,
      duration: calculateDuration(clockInTime, now),
    };
    setHistory((prev) => [entry, ...prev]);
    setClockInTime(null);
    setIsClockedIn(false);
  }, [clockInTime]);

  const renderHistoryItem = ({ item }) => (
    <View style={styles.historyItem}>
      <Text style={styles.historyDate}>
        {formatTimestamp(item.clockIn, 'date')}
      </Text>
      <View style={styles.historyRow}>
        <Text style={styles.historyLabel}>In:</Text>
        <Text style={styles.historyValue}>{formatTimestamp(item.clockIn, 'time')}</Text>
      </View>
      <View style={styles.historyRow}>
        <Text style={styles.historyLabel}>Out:</Text>
        <Text style={styles.historyValue}>{formatTimestamp(item.clockOut, 'time')}</Text>
      </View>
      <View style={styles.historyRow}>
        <Text style={styles.historyLabel}>Duration:</Text>
        <Text style={styles.historyValue}>{formatDuration(item.duration)}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>OliveOps</Text>
      <Text style={styles.subtitle}>Employee Time Tracking</Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Status</Text>
        <Text style={[styles.statusText, isClockedIn ? styles.statusIn : styles.statusOut]}>
          {isClockedIn ? 'Clocked In' : 'Clocked Out'}
        </Text>
        {isClockedIn && clockInTime && (
          <Text style={styles.clockedInSince}>
            Since {formatTimestamp(clockInTime, 'time')}
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, isClockedIn ? styles.buttonOut : styles.buttonIn]}
        onPress={isClockedIn ? handleClockOut : handleClockIn}
        accessibilityLabel={isClockedIn ? 'Clock Out' : 'Clock In'}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>
          {isClockedIn ? 'Clock Out' : 'Clock In'}
        </Text>
      </TouchableOpacity>

      {history.length > 0 && (
        <View style={styles.historyContainer}>
          <Text style={styles.historyTitle}>Recent Shifts</Text>
          <FlatList
            data={history}
            keyExtractor={(item) => item.id}
            renderItem={renderHistoryItem}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C5F2E',
    textAlign: 'center',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 30,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  statusLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 22,
    fontWeight: '700',
  },
  statusIn: {
    color: '#16A34A',
  },
  statusOut: {
    color: '#DC2626',
  },
  clockedInSince: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 6,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 30,
  },
  buttonIn: {
    backgroundColor: '#2C5F2E',
  },
  buttonOut: {
    backgroundColor: '#DC2626',
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  historyContainer: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  historyItem: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  historyLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  historyValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
});
