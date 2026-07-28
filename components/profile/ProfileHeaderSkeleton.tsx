import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonLoader from '../SkeletonLoader';

export default function ProfileHeaderSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <SkeletonLoader width={72} height={72} borderRadius={36} />
        <View style={styles.rightCol}>
          <View style={styles.statsRow}>
            <SkeletonLoader width={50} height={30} borderRadius={6} />
            <SkeletonLoader width={50} height={30} borderRadius={6} />
          </View>
          <SkeletonLoader width="100%" height={34} borderRadius={10} />
        </View>
      </View>
      <SkeletonLoader width={130} height={16} borderRadius={5} style={{ marginBottom: 4, marginTop: 4 }} />
      <SkeletonLoader width={80} height={12} borderRadius={4} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginBottom: 10,
  },
  rightCol: {
    flex: 1,
    gap: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
});
