import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useTranslation } from 'react-i18next';
import type { MonthlyBar } from './mockChartData';

interface MonthlyFrequencyChartWideProps {
  data: MonthlyBar[];
}

// Sağ sütun: GenreDonutChartWide ile aynı yükseklikte, daha kalın çubuklu
// bir sürüm — dar mobil kartın büyütülmüşü değil, ayrı bileşen.
const MonthlyFrequencyChartWide = ({ data }: MonthlyFrequencyChartWideProps) => {
  const { t } = useTranslation('media');

  const chartData = data.map((bar) => ({
    value: bar.value,
    label: bar.label,
    frontColor: '#3B82F6',
    gradientColor: '#60A5FA',
  }));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('monthlyFrequency', 'Aylık İzleme Frekansı')}</Text>

      <View style={styles.chartWrap}>
        <BarChart
          data={chartData}
          barWidth={30}
          spacing={28}
          barBorderRadius={10}
          showGradient
          hideRules
          yAxisThickness={0}
          xAxisThickness={0}
          xAxisLabelTextStyle={styles.axisLabel}
          yAxisTextStyle={styles.axisLabel}
          noOfSections={4}
          height={220}
          initialSpacing={16}
          endSpacing={8}
        />
      </View>
    </View>
  );
};

export default MonthlyFrequencyChartWide;

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
  },
  axisLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
});
