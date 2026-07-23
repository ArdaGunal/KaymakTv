import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { useTranslation } from 'react-i18next';
import type { GenreSlice } from '../../../hooks/useProfileStatistics';

interface GenreDonutChartProps {
  data: GenreSlice[];
}

/**
 * Favori türler halkası — dilimler ve lejant satırları SEÇİLEBİLİR.
 * Seçilen türün gerçek içerik sayısı ve yüzdesi halkanın ortasında görünür;
 * eskiden yalnızca en büyük dilimin yüzdesi sabit olarak yazıyordu.
 */
const GenreDonutChart = ({ data }: GenreDonutChartProps) => {
  const { t } = useTranslation('media');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Sekme değişince (dizi ↔ film) liste tamamen yenilenir; eski seçim indeksi
  // yeni listede taşmasın diye başa alınır.
  useEffect(() => {
    setSelectedIndex(0);
  }, [data]);

  const chartData = useMemo(
    () => data.map((slice, index) => ({
      value: slice.value,
      color: slice.color,
      // Seçili dilim öne çıksın: diğerleri hafifçe soluklaşır.
      opacity: index === selectedIndex ? 1 : 0.45,
    })),
    [data, selectedIndex]
  );

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
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t('favoriteGenres', 'Favori Türler')}</Text>
        <Text style={styles.hint}>{t('tapForDetail', 'Detay için dokun')}</Text>
      </View>

      <View style={styles.chartRow}>
        <PieChart
          data={chartData}
          donut
          radius={64}
          innerRadius={44}
          innerCircleColor="#0f172a"
          onPress={(_item: unknown, index: number) => setSelectedIndex(index)}
          centerLabelComponent={() => (
            <View style={styles.centerLabel}>
              <Text style={styles.centerValue}>%{selected.percent}</Text>
              <Text style={styles.centerCaption} numberOfLines={2}>{selected.label}</Text>
            </View>
          )}
        />

        <View style={styles.legend}>
          {data.map((slice, index) => {
            const isSelected = index === selectedIndex;
            return (
              <Pressable
                key={slice.slug ?? '__other'}
                onPress={() => setSelectedIndex(index)}
                style={[styles.legendRow, isSelected && styles.legendRowActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
                <Text
                  style={[styles.legendLabel, isSelected && styles.legendLabelActive]}
                  numberOfLines={1}
                >
                  {slice.label}
                </Text>
                {/* Yüzdenin yanında GERÇEK içerik sayısı da gösteriliyor —
                    "%40" tek başına kaç diziye denk geldiğini söylemiyordu. */}
                <Text style={[styles.legendValue, isSelected && styles.legendValueActive]}>
                  {slice.value}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={styles.footer}>
        {selected.label} · {t('genreTitleCount', '{{count}} içerikte', { count: selected.value })}
      </Text>
    </View>
  );
};

export default GenreDonutChart;

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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
  },
  hint: {
    color: '#64748b',
    fontSize: 10.5,
    fontWeight: '500',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 12.5,
    paddingVertical: 12,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  centerLabel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  centerValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  centerCaption: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '600',
    maxWidth: 66,
    textAlign: 'center',
  },
  legend: {
    flex: 1,
    gap: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 8,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  legendRowActive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  legendLabelActive: {
    color: '#f1f5f9',
    fontWeight: '600',
  },
  legendValue: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  legendValueActive: {
    color: '#e2e8f0',
  },
  footer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
});
