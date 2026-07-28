import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonLoader from '../../../components/SkeletonLoader';

function FeedSkeletonRow() {
  return (
    <View style={styles.card}>
      <SkeletonLoader width={40} height={40} borderRadius={20} />
      <View style={styles.body}>
        <SkeletonLoader width="40%" height={13} borderRadius={4} />
        <SkeletonLoader width="80%" height={13} borderRadius={4} style={styles.gapTop} />
        <SkeletonLoader width="25%" height={10} borderRadius={4} style={styles.gapTop} />
      </View>
      <SkeletonLoader width={40} height={56} borderRadius={8} />
    </View>
  );
}

export default function FeedSkeleton() {
  return (
    <View>
      {Array.from({ length: 4 }).map((_, i) => (
        <FeedSkeletonRow key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#172033',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#22304A',
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  body: {
    flex: 1,
  },
  gapTop: {
    marginTop: 6,
  },
});
