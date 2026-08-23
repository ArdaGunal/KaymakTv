import React, { memo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { ChevronDown, ChevronUp } from '../icons';
import type { LoggedError } from '../../utils/errorLog';
import { formatTimestamp } from './formatTimestamp';
import RowCopyButton from './RowCopyButton';

interface ErrorEntryRowProps {
  entry: LoggedError;
  locale: string;
}

// Dokununca genişleyip stack/tags gösterir — kayıtların hepsini açık basmak
// (özellikle uzun stack trace'lerle) listeyi kullanılamaz kılar. (Eskiden
// error-log.tsx'te idi, Geliştirici Paneli'nin Hata Günlüğü sekmesine taşındı.)
const ErrorEntryRow = memo(({ entry, locale }: ErrorEntryRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = !!entry.stack || !!entry.tags;
  const isWarning = entry.level === 'warn';

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={hasDetails ? 0.7 : 1}
      onPress={() => hasDetails && setExpanded((prev) => !prev)}
      disabled={!hasDetails}
    >
      <View style={styles.rowHeader}>
        <View style={styles.rowHeaderText}>
          <View style={styles.metaRow}>
            <Text style={styles.timestamp}>{formatTimestamp(entry.timestamp, locale)}</Text>
            <View style={[styles.levelBadge, isWarning ? styles.levelBadgeWarn : styles.levelBadgeError]}>
              <Text style={styles.levelBadgeText}>{isWarning ? 'UYARI' : 'HATA'}</Text>
            </View>
          </View>
          <Text style={styles.context} numberOfLines={1}>{entry.context}</Text>
          <Text style={styles.message} numberOfLines={expanded ? undefined : 2}>
            {entry.message}
          </Text>
        </View>
        <View style={styles.rowHeaderActions}>
          <RowCopyButton value={entry} />
          {hasDetails ? (
            expanded ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />
          ) : null}
        </View>
      </View>

      {expanded && (
        <View style={styles.details}>
          {entry.tags ? <Text style={styles.tags}>{JSON.stringify(entry.tags)}</Text> : null}
          {entry.stack ? <Text style={styles.stack}>{entry.stack}</Text> : null}
        </View>
      )}
    </TouchableOpacity>
  );
});

export default ErrorEntryRow;

const styles = StyleSheet.create({
  row: {
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  rowHeaderText: {
    flex: 1,
    gap: 3,
  },
  rowHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timestamp: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  levelBadgeError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  levelBadgeWarn: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  levelBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#f1f5f9',
    letterSpacing: 0.3,
  },
  context: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '700',
  },
  message: {
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 18,
  },
  details: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  tags: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
  },
  stack: {
    color: '#64748b',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
  },
});
