import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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

/** Süreye göre üç ayrık bant (bkz. utils/perfLog.ts): yeşil/turuncu/kırmızı.
 * Nokta, süre metni VE süre çubuğu AYNI fonksiyonu kullanır — tutarsızlık
 * (nokta yeşil ama çubuk turuncu gibi) imkânsız. */
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
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.name} numberOfLines={1}>{entry.name}</Text>
        <Text style={[styles.duration, { color }]}>{entry.durationMs}ms</Text>
        <RowCopyButton value={entry} />
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.category}>[{entry.category}]</Text>
        {/* statusCode yalnızca 'network' satırlarında dolu (bkz. utils/perfLog.ts) —
            'startup' aşamaları bir HTTP isteği olmadığından rozet göstermez. */}
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
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
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
  },
  name: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  duration: {
    fontSize: 15,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
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
});
