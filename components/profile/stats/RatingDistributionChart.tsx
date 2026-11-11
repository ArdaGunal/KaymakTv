import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Star } from '../../icons';
import { useTranslation } from 'react-i18next';
import type { ProfileStatsRatings } from '../../../hooks/useProfileStatistics';
import { formatRating } from '../../../utils/formatRating';
import { MOBILE_PALETTE, nativeColor } from '../../../constants/mobilePalette';

interface RatingDistributionChartProps {
  ratings: ProfileStatsRatings;
}

const BAR_AREA_HEIGHT = 96;
const MIN_BAR_HEIGHT = 3;

/**
 * Kullanıcının verdiği puanların dağılımı — UYGULAMA GENELİNDEKİ 5 YILDIZLIK
 * ölçekte (0.5 artışlarla). Trakt puanları dahili olarak 1-10 tam sayı olarak
 * saklanır; `formatRating` her yerde (StarSlider, MediaHero…)
 * bunu ikiye bölüp "X/5" gösterir. Burada da AYNI dönüşüm kullanılıyor —
 * aksi halde kullanıcı puan verirken 1-5 yıldız seçip burada "7.9" gibi 10'luk
 * bir ortalama görür, iki ekran farklı ölçek konuşurdu.
 *
 * Bilinçli olarak grafik kütüphanesi KULLANILMIYOR: on adet basit sütun için
 * `flex` yükseklikleri hem daha az bağımlılık hem de tam kontrol demek
 * (dokunma alanı, seçili durum, sıfır değerli sütunun görünürlüğü).
 */
const RatingDistributionChart = ({ ratings }: RatingDistributionChartProps) => {
  const { t } = useTranslation('media');
  const [selectedScore, setSelectedScore] = useState<number | null>(null);

  if (ratings.total === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{t('ratingDistribution', 'Puan Dağılımı')}</Text>
        <Text style={styles.emptyText}>{t('ratingsNoData', 'Henüz puan vermedin')}</Text>
      </View>
    );
  }

  const maxCount = Math.max(...ratings.bars.map((bar) => bar.count), 1);
  const selected = selectedScore ? ratings.bars.find((b) => b.score === selectedScore) : null;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.titleGroup}>
          <Text style={styles.title}>{t('ratingDistribution', 'Puan Dağılımı')}</Text>
          <Text style={styles.subtitle}>
            {selected
              ? `${formatRating(selected.rawScore)} ★ · ${t('ratedCount', '{{count}} puanlama', { count: selected.count })}`
              : t('ratedCount', '{{count}} puanlama', { count: ratings.total })}
          </Text>
        </View>

        <View style={styles.averageBadge}>
          <Star size={12} color={Platform.OS === 'web' ? '#fbbf24' : MOBILE_PALETTE.rating} fill={Platform.OS === 'web' ? '#fbbf24' : MOBILE_PALETTE.rating} />
          {/* `average` zaten 5'lik ölçekte; `formatRating` ham (1-10) beklediği
              için ×2 ile geri çevrilip AYNI biçimlendirme kuralına (tam sayıda
              ondalık gösterme) tabi tutuluyor. */}
          <Text style={styles.averageValue}>{formatRating(ratings.average * 2)}</Text>
          <Text style={styles.averageMax}>/5</Text>
        </View>
      </View>

      <View style={styles.barsRow}>
        {ratings.bars.map((bar) => {
          const isSelected = selectedScore === bar.score;
          const ratio = bar.count / maxCount;
          const height = bar.count > 0 ? Math.max(ratio * BAR_AREA_HEIGHT, 6) : MIN_BAR_HEIGHT;

          return (
            <Pressable
              key={bar.score}
              style={styles.barColumn}
              onPress={() => setSelectedScore(isSelected ? null : bar.score)}
              accessibilityRole="button"
              accessibilityLabel={`${formatRating(bar.rawScore)}: ${bar.count}`}
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[styles.barCount, isSelected && styles.barCountActive]}>
                {bar.count > 0 ? bar.count : ''}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    { height },
                    bar.count === 0 && styles.barEmpty,
                    isSelected && styles.barSelected,
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, isSelected && styles.barLabelActive]}>
                {formatRating(bar.rawScore)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export default RatingDistributionChart;

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    padding: 18,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  titleGroup: {
    flexShrink: 1,
  },
  title: {
    color: nativeColor('text', '#e2e8f0'),
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: nativeColor('mutedDeep', '#64748b'),
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
  },
  averageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: Platform.OS === 'web' ? 'rgba(251,191,36,0.12)' : MOBILE_PALETTE.ratingTint,
    borderWidth: 1,
    borderColor: Platform.OS === 'web' ? 'rgba(251,191,36,0.22)' : MOBILE_PALETTE.ratingBorder,
  },
  averageValue: {
    color: Platform.OS === 'web' ? '#fbbf24' : MOBILE_PALETTE.rating,
    fontSize: 14,
    fontWeight: '800',
  },
  averageMax: {
    color: Platform.OS === 'web' ? 'rgba(251,191,36,0.6)' : MOBILE_PALETTE.rating,
    opacity: Platform.OS === 'web' ? 1 : 0.65,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyText: {
    color: nativeColor('mutedDeep', '#64748b'),
    fontSize: 12.5,
    paddingVertical: 12,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  barCount: {
    color: nativeColor('mutedDeep', '#64748b'),
    fontSize: 9,
    fontWeight: '700',
    height: 12,
  },
  barCountActive: {
    color: nativeColor('text', '#e2e8f0'),
  },
  barTrack: {
    height: BAR_AREA_HEIGHT,
    justifyContent: 'flex-end',
    width: '100%',
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    borderRadius: 5,
    backgroundColor: nativeColor('primary', '#2563EB'),
  },
  barEmpty: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  barSelected: {
    backgroundColor: nativeColor('steel', '#60a5fa'),
  },
  barLabel: {
    color: nativeColor('mutedDeep', '#64748b'),
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
  },
  barLabelActive: {
    color: nativeColor('text', '#f1f5f9'),
    fontWeight: '800',
  },
});
