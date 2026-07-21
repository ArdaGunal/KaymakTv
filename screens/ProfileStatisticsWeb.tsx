import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Tv, Film } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useProfileStatistics, StatsTab } from '../hooks/useProfileStatistics';
import { getGenreMockData, getMonthlyMockData } from '../components/profile/stats/mockChartData';
import StatsSummaryRowWide from '../components/profile/stats/StatsSummaryRowWide';
import GenreDonutChartWide from '../components/profile/stats/GenreDonutChartWide';
import MonthlyFrequencyChartWide from '../components/profile/stats/MonthlyFrequencyChartWide';
import CompletionProgressBar from '../components/profile/stats/CompletionProgressBar';

// Masaüstü "Detaylı Analiz" ekranı: sonsuz dikey kaydırma yerine, grafikler
// yan yana (grid) yerleşir; tek ekranda çoğu içerik görünür.
export default function ProfileStatisticsScreenWeb() {
  const router = useRouter();
  const { t } = useTranslation('media');
  const [activeTab, setActiveTab] = useState<StatsTab>('shows');

  const { summary, completion, hasStats } = useProfileStatistics(activeTab);

  return (
    <View style={styles.pageBackground}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={20} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('detailedAnalysis', 'Detaylı Analiz')}</Text>

          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'shows' && styles.tabActive]}
              onPress={() => setActiveTab('shows')}
              activeOpacity={0.85}
            >
              <Tv size={13} color={activeTab === 'shows' ? '#2563EB' : '#94a3b8'} />
              <Text style={[styles.tabText, activeTab === 'shows' && styles.tabTextActive]}>
                {t('statsShowsTab', 'Diziler')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'movies' && styles.tabActive]}
              onPress={() => setActiveTab('movies')}
              activeOpacity={0.85}
            >
              <Film size={13} color={activeTab === 'movies' ? '#2563EB' : '#94a3b8'} />
              <Text style={[styles.tabText, activeTab === 'movies' && styles.tabTextActive]}>
                {t('statsMoviesTab', 'Filmler')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {hasStats && <StatsSummaryRowWide summary={summary} />}

        <View style={styles.chartsGrid}>
          <GenreDonutChartWide data={getGenreMockData(activeTab)} />
          <MonthlyFrequencyChartWide data={getMonthlyMockData(activeTab)} />
        </View>

        <CompletionProgressBar completion={completion} activeTab={activeTab} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageBackground: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 1200,
    marginHorizontal: 'auto' as any,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 16,
  },
  backButton: {
    padding: 8,
    backgroundColor: '#1f2937',
    borderRadius: 20,
    ...({ cursor: 'pointer', transition: 'all 0.2s ease' } as any),
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    flex: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 4,
  },
  tab: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: 'rgba(37,99,235,0.16)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  chartsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
    alignItems: 'stretch',
  },
});
