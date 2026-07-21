import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useTranslation } from 'react-i18next';
import type { MonthlyBar } from './mockChartData';

interface MonthlyFrequencyChartProps {
  data: MonthlyBar[];
}

const MonthlyFrequencyChart = ({ data }: MonthlyFrequencyChartProps) => {
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

      <BarChart
        data={chartData}
        barWidth={22}
        spacing={22}
        barBorderRadius={8}
        showGradient
        hideRules
        yAxisThickness={0}
        xAxisThickness={0}
        xAxisLabelTextStyle={styles.axisLabel}
        yAxisTextStyle={styles.axisLabel}
        noOfSections={4}
        height={140}
        initialSpacing={12}
        endSpacing={4}
      />
    </View>
  );
};

export default MonthlyFrequencyChart;

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    padding: 18,
    paddingRight: 8,
  },
  title: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 16,
  },
  axisLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
  },
});
