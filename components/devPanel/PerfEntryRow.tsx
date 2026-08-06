import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PerfMark } from '../../utils/perfLog';
import { SLOW_THRESHOLD_MS } from '../../utils/perfLog';
import { formatTimestamp } from './formatTimestamp';

interface PerfEntryRowProps {
  entry: PerfMark;
  locale: string;
}

const PerfEntryRow = memo(({ entry, locale }: PerfEntryRowProps) => {
  const isSlow = entry.durationMs > SLOW_THRESHOLD_MS;

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: isSlow ? '#f59e0b' : '#22c55e' }]} />
      <View style={styles.textWrap}>
        <Text style={styles.name} numberOfLines={1}>{entry.name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.category}>[{entry.category}]</Text>
          <Text style={styles.timestamp}>{formatTimestamp(entry.timestamp, locale)}</Text>
        </View>
      </View>
      <Text style={[styles.duration, isSlow && styles.durationSlow]}>{entry.durationMs}ms</Text>
    </View>
  );
});

export default PerfEntryRow;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  textWrap: {
    flex: 1,
    gap: 3,
  },
  name: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  category: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  timestamp: {
    color: '#475569',
    fontSize: 11,
  },
  duration: {
    color: '#22c55e',
    fontSize: 15,
    fontWeight: '700',
  },
  durationSlow: {
    color: '#f59e0b',
  },
});
