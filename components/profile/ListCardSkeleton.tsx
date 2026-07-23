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

interface ListCardSkeletonProps {
  /** `ListCard`'daki aynı override — bkz. o dosyadaki açıklama. */
  cardWidth?: number;
  cardHeight?: number;
  gap?: number;
}

/**
 * Listelerin yüklenmesi sırasında gösterilen shimmer skeleton.
 * Ölçüler `ListCard` ile AYNI kaynaktan (`profileMetrics`) geldiği için
 * gerçek kartlar geldiğinde layout kaymaz — `cardWidth`/`cardHeight`/`gap`
 * verilmediğinde varsayılan (mobil) ölçüler kullanılır.
 */
export default function ListCardSkeleton({
  cardWidth = POSTER_CARD_WIDTH,
  cardHeight = POSTER_CARD_HEIGHT,
  gap = CARD_GAP,
}: ListCardSkeletonProps) {
  return (
    <View style={[styles.row, { gap }]}>
      {Array.from({ length: COUNT }).map((_, i) => (
        <View key={i}>
          <SkeletonLoader
            width={cardWidth}
            height={cardHeight}
            borderRadius={8}
          />
          <SkeletonLoader
            width={cardWidth * 0.8}
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
  },
  titleSkeleton: {
    marginTop: 9,
  },
});
