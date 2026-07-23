import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useTranslation } from 'react-i18next';
import type { MonthlyBar, StatsTab } from '../../../hooks/useProfileStatistics';

interface MonthlyFrequencyChartWideProps {
  data: MonthlyBar[];
  activeTab: StatsTab;
}

const ACTIVE_COLOR = '#3B82F6';
const IDLE_COLOR = '#1e3a5f';

// Sağ sütun: GenreDonutChartWide ile aynı yükseklikte, daha kalın çubuklu
// bir sürüm — dar mobil kartın büyütülmüşü değil, ayrı bileşen.
const MonthlyFrequencyChartWide = ({ data, activeTab }: MonthlyFrequencyChartWideProps) => {
  const { t } = useTranslation('media');
  const [selectedIndex, setSelectedIndex] = useState(data.length - 1);

  useEffect(() => {
    setSelectedIndex(data.length - 1);
  }, [data]);

  const chartData = useMemo(
    () => data.map((bar, index) => ({
      value: bar.value,
      label: bar.label,
      frontColor: index === selectedIndex ? ACTIVE_COLOR : IDLE_COLOR,
      gradientColor: index === selectedIndex ? '#60A5FA' : '#24507f',
      onPress: () => setSelectedIndex(index),
    })),
    [data, selectedIndex]
  );

  const total = useMemo(() => data.reduce((sum, bar) => sum + bar.value, 0), [data]);
  const selected = data[Math.min(Math.max(selectedIndex, 0), data.length - 1)];

  const selectedText = selected
    ? activeTab === 'shows'
      ? t('monthItemsShows', '{{count}} dizi', { count: selected.value })
      : t('monthItemsMovies', '{{count}} film', { count: selected.value })
    : '';

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>{t('monthlyFrequency', 'Aylık İzleme Frekansı')}</Text>
          <Text style={styles.subtitle}>{t('lastSixMonths', 'Son 6 ay')}</Text>
        </View>
        {selected ? (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedMonth}>{selected.label}</Text>
            <Text style={styles.selectedValue}>{selectedText}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.chartWrap}>
        {total === 0 ? (
          <Text style={styles.emptyText}>{t('monthlyNoData', 'Bu dönemde izleme kaydı yok')}</Text>
        ) : (
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
        )}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 20,
  },
  title: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
  },
  selectedBadge: {
    alignItems: 'flex-end',
  },
  selectedMonth: {
    color: '#60a5fa',
    fontSize: 15,
    fontWeight: '800',
  },
  selectedValue: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    paddingVertical: 40,
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
