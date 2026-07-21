import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { useTranslation } from 'react-i18next';
import type { GenreSlice } from './mockChartData';

interface GenreDonutChartWideProps {
  data: GenreSlice[];
}

// Sol sütun: geniş ekranda kocaman, ortalanmış bir pasta grafik + altında
// yatay bir lejant. mockChartData.ts'teki aynı veriyi kullanır, yalnızca
// sunumu masaüstüne göre yeniden düzenler.
const GenreDonutChartWide = ({ data }: GenreDonutChartWideProps) => {
  const { t } = useTranslation('media');
  const topGenre = data.reduce((max, item) => (item.value > max.value ? item : max), data[0]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('favoriteGenres', 'Favori Türler')}</Text>

      <View style={styles.chartWrap}>
        <PieChart
          data={data}
          donut
          radius={100}
          innerRadius={70}
          innerCircleColor="#0f172a"
          centerLabelComponent={() => (
            <View style={styles.centerLabel}>
              <Text style={styles.centerValue}>%{topGenre.value}</Text>
              <Text style={styles.centerCaption}>{topGenre.label}</Text>
            </View>
          )}
        />
      </View>

      <View style={styles.legend}>
        {data.map((slice) => (
          <View key={slice.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
            <Text style={styles.legendLabel}>{slice.label}</Text>
            <Text style={styles.legendValue}>%{slice.value}</Text>
          </View>
        ))}
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
