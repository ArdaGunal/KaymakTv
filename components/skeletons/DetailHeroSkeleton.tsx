import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import SkeletonLoader from '../SkeletonLoader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ROW_CARD_WIDTH = SCREEN_WIDTH * 0.28;
const ROW_CARD_HEIGHT = ROW_CARD_WIDTH * 1.5;

/**
 * Film/dizi/bölüm detay sayfasının (`MediaHero` + `MediaCast` +
 * `HorizontalMediaList`) yüklenme durumu. Ölçüler o bileşenlerdeki gerçek
 * değerlerle AYNI kaynaktan alınır (backdrop 280, poster 110x165, cast/benzer
 * kart genişliği ekran genişliğinin %28'i) — gerçek içerik geldiğinde
 * skeleton'dan gerçek layout'a geçiş sıçramasız olur.
 *
 * `hasPoster=false` (bölüm detay sayfası): `MediaHero`nun aksine bölüm
 * başlığının yanında ayrı bir poster YOKTUR — tüm genişlikte bir "still"
 * görseli var, altında dikey akan başlık/meta bloğu. Bu durumda poster
 * sütunu atlanır, başlık bloğu backdrop'un TAM ALTINA dikey yerleşir.
 */
export default function DetailHeroSkeleton({ hasPoster = true }: { hasPoster?: boolean }) {
  return (
    <View style={styles.container}>
      <SkeletonLoader width="100%" height={280} borderRadius={0} />

      <View style={hasPoster ? styles.headerRow : styles.headerColumn}>
        {hasPoster && <SkeletonLoader width={110} height={165} borderRadius={8} />}
        <View style={hasPoster ? styles.textColumn : styles.textColumnFull}>
          <SkeletonLoader width="85%" height={22} style={styles.gap} />
          <SkeletonLoader width="50%" height={13} style={styles.gap} />
          <SkeletonLoader width="65%" height={13} style={styles.gap} />
          <View style={styles.pillRow}>
            <SkeletonLoader width={64} height={26} borderRadius={13} />
            <SkeletonLoader width={64} height={26} borderRadius={13} />
            <SkeletonLoader width={36} height={26} borderRadius={13} />
          </View>
        </View>
      </View>

      <View style={styles.overviewSection}>
        <SkeletonLoader width="100%" height={13} style={styles.gap} />
        <SkeletonLoader width="100%" height={13} style={styles.gap} />
        <SkeletonLoader width="70%" height={13} />
      </View>

      <View style={styles.section}>
        <SkeletonLoader width={80} height={16} style={styles.sectionTitleGap} />
        <View style={styles.row}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonLoader key={i} width={100} height={150} borderRadius={8} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SkeletonLoader width={120} height={16} style={styles.sectionTitleGap} />
        <View style={styles.row}>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonLoader key={i} width={ROW_CARD_WIDTH} height={ROW_CARD_HEIGHT} borderRadius={8} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: -60,
  },
  headerColumn: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  textColumn: { flex: 1, marginLeft: 16, justifyContent: 'flex-end', paddingBottom: 8 },
  textColumnFull: { justifyContent: 'flex-start' },
  gap: { marginBottom: 8 },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  overviewSection: { paddingHorizontal: 16, marginTop: 24 },
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitleGap: { marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10 },
});
