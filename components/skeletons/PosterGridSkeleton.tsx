import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonLoader from '../SkeletonLoader';

interface PosterGridSkeletonProps {
  /** Sütun sayısı — çağıran ekranın gerçek `numColumns`/`NUM_COLUMNS` değeriyle AYNI olmalı. */
  columns: number;
  /** Toplam kaç satır gösterileceği (satır = columns kadar kart). */
  rows?: number;
  /** Sabit piksel genişlik (mobil) veya yüzde/`calc()` string (web) — verilmezse sütun sayısına göre yüzde hesaplanır. */
  cardWidth?: number | string;
  /** Sabit piksel yükseklik. `aspectRatio` verilmişse yoksayılır. */
  cardHeight?: number;
  /** Web grid'lerinde kart genişliği `calc()`/yüzde olduğundan sabit piksel yükseklik hesaplanamaz — bunun yerine gerçek kartla AYNI en-boy oranı kullanılır. */
  aspectRatio?: number;
  gap?: number;
  paddingHorizontal?: number;
}

/**
 * `LibraryMobile`, `library/[type].web.tsx` ve `ExploreWebGrid` desktop
 * grid'inin yüklenme durumu. Poster grid'i olan her ekran aynı sütun
 * sayısı/aralıkla bu bileşeni kullanır — gerçek kartlar geldiğinde satır
 * sayısı/genişliği kaymaz.
 */
export default function PosterGridSkeleton({
  columns,
  rows = 3,
  cardWidth,
  cardHeight = 210,
  aspectRatio,
  gap = 8,
  paddingHorizontal = 12,
}: PosterGridSkeletonProps) {
  const resolvedWidth = cardWidth ?? `${(100 / columns).toFixed(3)}%`;
  const count = columns * rows;

  return (
    <View style={[styles.grid, { paddingHorizontal, gap }]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.cell, { width: resolvedWidth as any }]}>
          {aspectRatio != null ? (
            <View style={{ width: '100%', aspectRatio, borderRadius: 8, overflow: 'hidden' }}>
              <SkeletonLoader width="100%" height="100%" borderRadius={0} />
            </View>
          ) : (
            <SkeletonLoader width="100%" height={cardHeight} borderRadius={8} />
          )}
          <SkeletonLoader width="70%" height={11} borderRadius={5} style={styles.titleGap} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { marginBottom: 12 },
  titleGap: { marginTop: 8 },
});
