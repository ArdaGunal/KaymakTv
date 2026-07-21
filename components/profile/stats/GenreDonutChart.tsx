import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { useTranslation } from 'react-i18next';
import type { GenreSlice } from './mockChartData';

interface GenreDonutChartProps {
  data: GenreSlice[];
}

const GenreDonutChart = ({ data }: GenreDonutChartProps) => {
  const { t } = useTranslation('media');
  const topGenre = data.reduce((max, item) => (item.value > max.value ? item : max), data[0]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('favoriteGenres', 'Favori Türler')}</Text>

      <View style={styles.chartRow}>
        <PieChart
          data={data}
          donut
          radius={64}
          innerRadius={44}
          innerCircleColor="#0f172a"
          centerLabelComponent={() => (
            <View style={styles.centerLabel}>
              <Text style={styles.centerValue}>%{topGenre.value}</Text>
              <Text style={styles.centerCaption} numberOfLines={1}>{topGenre.label}</Text>
            </View>
          )}
        />

        <View style={styles.legend}>
          {data.map((slice) => (
            <View key={slice.label} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
              <Text style={styles.legendLabel} numberOfLines={1}>{slice.label}</Text>
              <Text style={styles.legendValue}>%{slice.value}</Text>
            </View>
          ))}
        </View>
      </View>
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
  title: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 16,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  centerLabel: {
    alignItems: 'center',
    justifyContent: 'center',
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
    maxWidth: 60,
    textAlign: 'center',
  },
  legend: {
    flex: 1,
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
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
