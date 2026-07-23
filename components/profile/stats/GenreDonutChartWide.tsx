import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { useTranslation } from 'react-i18next';
import type { GenreSlice } from '../../../hooks/useProfileStatistics';

interface GenreDonutChartWideProps {
  data: GenreSlice[];
}

// Sol sütun: geniş ekranda kocaman, ortalanmış bir pasta grafik + altında
// yatay bir lejant. Mobil sürümle AYNI gerçek veriyi kullanır, yalnızca sunumu
// masaüstüne göre yeniden düzenler; dilimler ve lejant burada da seçilebilir.
const GenreDonutChartWide = ({ data }: GenreDonutChartWideProps) => {
  const { t } = useTranslation('media');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [data]);

  const chartData = useMemo(
    () => data.map((slice, index) => ({
      value: slice.value,
      color: slice.color,
      opacity: index === selectedIndex ? 1 : 0.45,
    })),
    [data, selectedIndex]
  );

  // ESKİ HATA: `data.reduce(fn, data[0])` boş dizide `max.value` okurken
  // çöküyordu. Veri artık sahte değil gerçek olduğundan (ve gerçekten boş
  // olabildiğinden) boş durum açıkça ele alınıyor.
  if (data.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{t('favoriteGenres', 'Favori Türler')}</Text>
        <Text style={styles.emptyText}>{t('genresNoData', 'Tür verisi bulunamadı')}</Text>
      </View>
    );
  }

  const selected = data[Math.min(selectedIndex, data.length - 1)];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('favoriteGenres', 'Favori Türler')}</Text>

      <View style={styles.chartWrap}>
        <PieChart
          data={chartData}
          donut
          radius={100}
          innerRadius={70}
          innerCircleColor="#0f172a"
          onPress={(_item: unknown, index: number) => setSelectedIndex(index)}
          centerLabelComponent={() => (
            <View style={styles.centerLabel}>
              <Text style={styles.centerValue}>%{selected.percent}</Text>
              <Text style={styles.centerCaption}>{selected.label}</Text>
              <Text style={styles.centerCount}>
                {t('genreTitleCount', '{{count}} içerikte', { count: selected.value })}
              </Text>
            </View>
          )}
        />
      </View>

      <View style={styles.legend}>
        {data.map((slice, index) => {
          const isSelected = index === selectedIndex;
          return (
            <Pressable
              key={slice.slug ?? '__other'}
              onPress={() => setSelectedIndex(index)}
              style={[styles.legendItem, isSelected && styles.legendItemActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
              <Text style={styles.legendLabel}>{slice.label}</Text>
              <Text style={styles.legendValue}>{slice.value}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export default GenreDonutChartWide;

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    padding: 24,
  },
  title: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 20,
  },
  chartWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  centerLabel: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerValue: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  centerCaption: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  centerCount: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    paddingVertical: 16,
  },
  legendItemActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '500',
  },
  legendValue: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
});
