import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useTranslation } from 'react-i18next';
import type { MonthlyBar } from '../../../hooks/useProfileStatistics';
import type { StatsTab } from '../../../hooks/useProfileStatistics';

interface MonthlyFrequencyChartProps {
  data: MonthlyBar[];
  activeTab: StatsTab;
}

const ACTIVE_COLOR = '#3B82F6';
const IDLE_COLOR = '#1e3a5f';

/**
 * Son 6 ayın etkinlik grafiği. Sütunlara DOKUNULABİLİR: seçilen ayın gerçek
 * değeri başlıkta yazıyla görünür (eskiden yalnızca isimsiz sütunlar vardı ve
 * veriler tamamen sahteydi).
 */
const MonthlyFrequencyChart = ({ data, activeTab }: MonthlyFrequencyChartProps) => {
  const { t } = useTranslation('media');
  // Varsayılan seçim en güncel ay — kullanıcı en çok onu merak eder.
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
        <View style={styles.titleGroup}>
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

      {total === 0 ? (
        <Text style={styles.emptyText}>{t('monthlyNoData', 'Bu dönemde izleme kaydı yok')}</Text>
      ) : (
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
      )}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
    paddingRight: 10,
  },
  titleGroup: {
    flexShrink: 1,
  },
  title: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 2,
  },
  selectedBadge: {
    alignItems: 'flex-end',
  },
  selectedMonth: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '800',
  },
  selectedValue: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 12.5,
    paddingVertical: 12,
  },
  axisLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
  },
});
