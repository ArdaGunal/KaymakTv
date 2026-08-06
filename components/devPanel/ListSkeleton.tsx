import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonLoader from '../SkeletonLoader';

/** Performans/Hata Günlüğü listeleri ilk yüklenirken gösterilen ortak
 * iskelet — ikisi de aynı satır şeklini (üç satırlık metin bloğu) taklit eder. */
export default function ListSkeleton() {
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={styles.row}>
          <SkeletonLoader width={90} height={11} style={{ marginBottom: 8 }} />
          <SkeletonLoader width="40%" height={13} style={{ marginBottom: 8 }} />
          <SkeletonLoader width="90%" height={13} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
  },
});
