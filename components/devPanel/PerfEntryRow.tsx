import React, { memo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import type { PerfMark } from '../../utils/perfLog';
import { SLOW_THRESHOLD_MS, CRITICAL_THRESHOLD_MS } from '../../utils/perfLog';
import { formatTimestamp } from './formatTimestamp';
import DurationBar from './DurationBar';
import StatusBadge from './StatusBadge';
import RowCopyButton from './RowCopyButton';

interface PerfEntryRowProps {
  entry: PerfMark;
  locale: string;
}

const COLOR_OK = '#22c55e';
const COLOR_MODERATE = '#f59e0b';
const COLOR_CRITICAL = '#ef4444';

function severityColor(durationMs: number): string {
  if (durationMs > CRITICAL_THRESHOLD_MS) return COLOR_CRITICAL;
  if (durationMs > SLOW_THRESHOLD_MS) return COLOR_MODERATE;
  return COLOR_OK;
}

const PerfEntryRow = memo(({ entry, locale }: PerfEntryRowProps) => {
  const color = severityColor(entry.durationMs);

  return (
    <View style={styles.row}>
      <View style={styles.headerLine}>
        <View style={[styles.dot, { backgroundColor: color, shadowColor: color }]} />
        <Text style={styles.name} numberOfLines={1}>
          {entry.name}
        </Text>
        <View style={[styles.durationBadge, { backgroundColor: `${color}16`, borderColor: `${color}35` }]}>
          <Text style={[styles.duration, { color }]}>{entry.durationMs}ms</Text>
        </View>
        <RowCopyButton value={entry} />
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.category}>[{entry.category}]</Text>
        {entry.statusCode ? <StatusBadge statusCode={entry.statusCode} /> : null}
        <Text style={styles.timestamp}>{formatTimestamp(entry.timestamp, locale)}</Text>
      </View>

      <DurationBar durationMs={entry.durationMs} color={color} />
    </View>
  );
});

export default PerfEntryRow;

const styles = StyleSheet.create({
  row: {
    backgroundColor: 'rgba(27, 32, 42, 0.75)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: 14,
    gap: 8,
  },
  headerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  name: {
    flex: 1,
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
  },
  durationBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  duration: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  category: {
    color: '#8c90a0',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timestamp: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
