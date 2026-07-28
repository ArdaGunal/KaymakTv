import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonLoader from '../SkeletonLoader';

export default function ProfileHeaderSkeleton() {
  return (
    <View style={styles.container}>
      <SkeletonLoader width={96} height={96} borderRadius={48} style={styles.gap14} />
      <SkeletonLoader width={140} height={18} borderRadius={5} style={styles.gap8} />
      <SkeletonLoader width={90} height={13} borderRadius={4} style={styles.gap16} />
      <View style={styles.statsRow}>
        <SkeletonLoader width={64} height={36} borderRadius={8} />
        <SkeletonLoader width={64} height={36} borderRadius={8} />
      </View>
      <SkeletonLoader width={140} height={40} borderRadius={20} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  gap14: { marginBottom: 14 },
  gap8: { marginBottom: 8 },
  gap16: { marginBottom: 16 },
  statsRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 18,
  },
});
