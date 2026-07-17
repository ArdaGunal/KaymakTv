import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonLoader from '../SkeletonLoader';

const CARD_WIDTH = 160;
const CARD_HEIGHT = 220;
const COUNT = 4;

/**
 * Listelerin yüklenmesi sırasında gösterilen shimmer skeleton.
 * Kart boyutları ListCard ile birebir eşleşir → layout shift olmaz.
 */
export default function ListCardSkeleton() {
  return (
    <View style={styles.row}>
      {Array.from({ length: COUNT }).map((_, i) => (
        <View key={i} style={styles.item}>
          <SkeletonLoader
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            borderRadius={14}
            style={styles.card}
          />
          {/* Title placeholder */}
          <SkeletonLoader
            width={CARD_WIDTH * 0.75}
            height={12}
            borderRadius={6}
            style={styles.titleSkeleton}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 14,
  },
  item: {
    alignItems: 'flex-start',
  },
  card: {
    marginBottom: 8,
  },
  titleSkeleton: {
    marginLeft: 2,
  },
});
