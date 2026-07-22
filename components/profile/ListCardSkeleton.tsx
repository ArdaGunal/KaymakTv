import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonLoader from '../SkeletonLoader';
import {
  POSTER_CARD_WIDTH,
  POSTER_CARD_HEIGHT,
  CARD_GAP,
  SECTION_PADDING_H,
} from './profileMetrics';

const COUNT = 4;

/**
 * Listelerin yüklenmesi sırasında gösterilen shimmer skeleton.
 * Ölçüler `ListCard` ile AYNI kaynaktan (`profileMetrics`) geldiği için
 * gerçek kartlar geldiğinde layout kaymaz.
 */
export default function ListCardSkeleton() {
  return (
    <View style={styles.row}>
      {Array.from({ length: COUNT }).map((_, i) => (
        <View key={i}>
          <SkeletonLoader
            width={POSTER_CARD_WIDTH}
            height={POSTER_CARD_HEIGHT}
            borderRadius={8}
          />
          <SkeletonLoader
            width={POSTER_CARD_WIDTH * 0.8}
            height={11}
            borderRadius={5}
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
    paddingHorizontal: SECTION_PADDING_H,
    gap: CARD_GAP,
  },
  titleSkeleton: {
    marginTop: 9,
  },
});
