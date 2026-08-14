import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatusBadgeProps {
  statusCode: number;
}

/** HTTP durum koduna göre renklendirilmiş küçük rozet — 2xx yeşil, 3xx mavi,
 * 4xx turuncu, 5xx kırmızı. Yalnızca `category: 'network'` satırlarında ve
 * `statusCode` doluyken render edilir (bkz. PerfEntryRow.tsx). */
function colorFor(statusCode: number): { bg: string; text: string } {
  if (statusCode >= 500) return { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171' };
  if (statusCode >= 400) return { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24' };
  if (statusCode >= 300) return { bg: 'rgba(96, 165, 250, 0.15)', text: '#60a5fa' };
  return { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80' };
}

const StatusBadge = memo(({ statusCode }: StatusBadgeProps) => {
  const { bg, text } = colorFor(statusCode);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text }]}>{statusCode}</Text>
    </View>
  );
});

export default StatusBadge;

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
  },
});
