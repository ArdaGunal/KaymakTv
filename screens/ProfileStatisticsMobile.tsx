import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Tv, Film } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProfileStatistics, StatsTab } from '../hooks/useProfileStatistics';
import StatsSummaryRow from '../components/profile/stats/StatsSummaryRow';
import GenreDonutChart from '../components/profile/stats/GenreDonutChart';
import MonthlyFrequencyChart from '../components/profile/stats/MonthlyFrequencyChart';
import RatingDistributionChart from '../components/profile/stats/RatingDistributionChart';
import CompletionProgressBar from '../components/profile/stats/CompletionProgressBar';

export default function ProfileStatisticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('media');
  const [activeTab, setActiveTab] = useState<StatsTab>('shows');

  const { summary, completion, genres, monthly, ratings, hasStats, hasContent } =
    useProfileStatistics(activeTab);

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ChevronLeft size={26} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('detailedAnalysis', 'Detaylı Analiz')}</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.tabsWrap}>
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {hasStats && <StatsSummaryRow summary={summary} />}

        {hasContent ? (
          <>
            <GenreDonutChart data={genres} />
            <MonthlyFrequencyChart data={monthly} activeTab={activeTab} />
            <RatingDistributionChart ratings={ratings} />
            <CompletionProgressBar completion={completion} activeTab={activeTab} />
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {t('statsEmptyTitle', 'Henüz analiz edilecek veri yok')}
            </Text>
            <Text style={styles.emptyText}>
              {t('statsEmptyText', 'Dizi ve film izledikçe burada kişisel istatistiklerin oluşacak.')}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
    marginLeft: -4,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  tabsWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    padding: 4,
  },
  tab: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 12,
  },
  emptyState: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 24,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
  },
});
