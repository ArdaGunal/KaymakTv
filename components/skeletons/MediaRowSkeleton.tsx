import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonLoader from '../SkeletonLoader';

interface MediaRowSkeletonProps {
  count?: number;
  rowHeight?: number;
  posterWidth?: number;
  paddingHorizontal?: number;
}

/**
 * `ShowCard` (keşfet mobil listesi) ve liste-detay satırlarının yüklenme
 * durumu — poster + iki metin satırı, yatay bir kart şeklinde. Varsayılan
 * ölçüler `ShowCard.tsx`teki `card`/`posterContainer` (height 144, poster
 * genişliği 96) ile AYNIDIR.
 */
export default function MediaRowSkeleton({
  count = 6,
  rowHeight = 144,
  posterWidth = 96,
  paddingHorizontal = 16,
}: MediaRowSkeletonProps) {
  return (
    <View style={{ paddingHorizontal }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.row, { height: rowHeight }]}>
          <SkeletonLoader width={posterWidth} height={rowHeight} borderRadius={0} />
          <View style={styles.content}>
            <SkeletonLoader width="70%" height={16} style={styles.gap} />
            <SkeletonLoader width="45%" height={12} style={styles.gap} />
            <SkeletonLoader width="30%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: '#172033',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#22304A',
  },
  content: { flex: 1, padding: 12, justifyContent: 'center' },
  gap: { marginBottom: 8 },
});
