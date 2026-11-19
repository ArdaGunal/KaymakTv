import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonLoader from '../SkeletonLoader';

/** `CommentItem`'ın yüklenme durumu: avatar dairesi + kullanıcı adı + 1-2 satır yorum metni. */
export default function CommentListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.row}>
          <SkeletonLoader width={38} height={38} borderRadius={19} />
          <View style={styles.content}>
            <SkeletonLoader width="35%" height={12} style={styles.gap} />
            <SkeletonLoader width="90%" height={13} style={styles.gap} />
            <SkeletonLoader width="60%" height={13} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 12 },
  row: { flexDirection: 'row', marginBottom: 20 },
  content: { flex: 1, marginLeft: 10 },
  gap: { marginBottom: 8 },
});
