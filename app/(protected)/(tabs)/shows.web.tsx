import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';

import EpisodeCard from '../../../components/EpisodeCard';
import SkeletonLoader from '../../../components/SkeletonLoader';
import InlineRater from '../../../components/InlineRater';
import { addRating, getTrendingShows } from '../../../services/traktApi';
import { useAuth } from '../../../context/AuthContext';
import { useLibrarySelector, useLibraryActions } from '../../../context/LibraryContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import WebCarousel from '../../../components/web/WebCarousel';
import { useRouter } from 'expo-router';
import { useResponsive } from '../../../hooks/useResponsive';
import IndexMobile from '../../../screens/IndexMobile';
import { viewAllStore } from '../../../utils/viewAllStore';
import LoginPaywall from '../../../components/LoginPaywall';
import { useDashboardData } from '../../../hooks/useDashboardData';

export default function DizilerScreenWeb() {
  const { isDesktop } = useResponsive();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('izleme');
  const [renderedTab, setRenderedTab] = useState('izleme');
  const { t, i18n } = useTranslation('media');

  const [trendingFallback, setTrendingFallback] = useState<any[]>([]);
  const [isTrendingLoading, setIsTrendingLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [finishedShow, setFinishedShow] = useState<{name: string, id: number} | null>(null);

  const { accessToken, isGuest } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Katı seçici: yalnızca dizi dilimleri okunur; film dilimleri değiştiğinde bu ekran render olmaz.
  const { watchedShows, watchlistShows, calendarShows, showProgressMap, calendarSeasonsMap, isLibraryLoading } = useLibrarySelector(s => ({
    watchedShows: s.watchedShows,
    watchlistShows: s.watchlistShows,
    calendarShows: s.calendarShows,
    showProgressMap: s.showProgressMap,
    calendarSeasonsMap: s.calendarSeasonsMap,
    isLibraryLoading: s.isLoading,
  }));
  const { refreshLibrary } = useLibraryActions();

  // Ağır veri harmanlama işi mobil ile ORTAK hook'ta ve memoize edilmiş durumda.
  const { upNextShows, inactiveShows, watchlistShowsList, upcomingShows } = useDashboardData(
    watchedShows,
    watchlistShows,
    calendarShows,
    showProgressMap,
    calendarSeasonsMap,
    i18n.language
  );

  const groupedUpcomingShows = useMemo(() => {
    const groups: { title: string, data: any[] }[] = [];
    upcomingShows.forEach((show: any) => {
      const existing = groups.find(g => g.title === show.dateGroup);
      if (existing) existing.data.push(show);
      else groups.push({ title: show.dateGroup, data: [show] });
    });
    return groups;
  }, [upcomingShows]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    // Geçiş animasyonu takılmasın diye ağır liste render'ı bir tık ertelenir.
    setTimeout(() => setRenderedTab(tab), 50);
  }, []);

  const fetchTrendingFallback = useCallback(async () => {
    setIsTrendingLoading(true);
    try {
      const data = await getTrendingShows();
      const formattedData = data.map((item: any, index: number) => ({
        id: item.show.ids.trakt,
        showName: (item.show?.title || t('unnamedShow')).toUpperCase(),
        season: 1,
        episode: 1,
        title: `${item.show.year || ''} - ${item.watchers} ${t('watching')}`,
        tags: index < 3 ? ['TRENDING'] : [],
        image: null,
      }));
      setTrendingFallback(formattedData);
    } catch (error) {
      console.log('Trendler çekilemedi', error);
    } finally {
      setIsTrendingLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!accessToken && !isGuest) {
      fetchTrendingFallback();
    }
  }, [accessToken, isGuest, fetchTrendingFallback]);

  const onRefresh = useCallback(async () => {
    if (!accessToken) return;
    setRefreshing(true);
    await refreshLibrary();
    setRefreshing(false);
  }, [accessToken, refreshLibrary]);

  const handleShowFinished = useCallback((showName: string, showId: number) => {
    setFinishedShow({ name: showName, id: showId });
    setShowConfetti(true);
  }, []);

  // Tek stable renderItem: her carousel'e aynı referans gider,
  // WebCarousel'in React.memo'su böylece gereksiz render'ları eleyebilir.
  const renderEpisodeItem = useCallback(
    ({ item }: { item: any }) => <EpisodeCard data={item} onShowFinished={handleShowFinished} />,
    [handleShowFinished]
  );

  const openViewAll = useCallback((title: string, data: any[], routeType: string) => {
    viewAllStore.data = data;
    viewAllStore.title = title;
    router.push(`/(protected)/library/view-all?type=${routeType}` as any);
  }, [router]);

  const renderCarousel = (title: string, data: any[], routeType: string = 'shows') => (
    <WebCarousel
      title={title}
      data={data}
      renderItem={renderEpisodeItem}
      onViewAll={() => openViewAll(title, data, routeType)}
    />
  );

  if (!isDesktop) {
    return <IndexMobile />;
  }

  if (isGuest) {
    return (
      <View style={styles.pageBackground}>
        <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
          <LoginPaywall message={t('loginToSeeCalendar', 'Yaklaşan dizilerinizi ve kendi izleme takviminizi oluşturmak için aramıza katılın!')} />
        </View>
      </View>
    );
  }

  const effectiveUpNext = accessToken ? upNextShows : trendingFallback;
  const isLoading = accessToken ? isLibraryLoading : isTrendingLoading;

  return (
    <View style={styles.pageBackground}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ffffff"
            colors={['#ffffff']}
            progressBackgroundColor="#262626"
          />
        }
      >
        <View style={styles.segmentedControlContainer}>
          <TouchableOpacity
            style={[styles.segmentedTab, activeTab === 'izleme' && styles.segmentedTabActive]}
            onPress={() => handleTabChange('izleme')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentedTabText, activeTab === 'izleme' && styles.segmentedTabTextActive]}>{t('watchlistTab')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentedTab, activeTab === 'yaklasan' && styles.segmentedTabActive]}
            onPress={() => handleTabChange('yaklasan')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentedTabText, activeTab === 'yaklasan' && styles.segmentedTabTextActive]}>{t('upcomingTab')}</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={{ marginTop: 24 }}>
             <Text style={styles.categoryTitle}>{t('upNext')}</Text>
             <View style={{ flexDirection: 'row', gap: 16, marginBottom: 32 }}>
                <SkeletonLoader width={180} height={270} borderRadius={8} />
                <SkeletonLoader width={180} height={270} borderRadius={8} />
                <SkeletonLoader width={180} height={270} borderRadius={8} />
                <SkeletonLoader width={180} height={270} borderRadius={8} />
             </View>

             <Text style={styles.categoryTitle}>{t('notStarted')}</Text>
             <View style={{ flexDirection: 'row', gap: 16 }}>
                <SkeletonLoader width={180} height={270} borderRadius={8} />
                <SkeletonLoader width={180} height={270} borderRadius={8} />
             </View>
          </View>
        ) : renderedTab === 'yaklasan' && accessToken ? (
          groupedUpcomingShows.length > 0 ? (
            groupedUpcomingShows.map(group => (
              <React.Fragment key={group.title}>
                {renderCarousel(group.title, group.data)}
              </React.Fragment>
            ))
          ) : (
            <Text style={styles.emptyText}>{t('noUpcomingShows')}</Text>
          )
        ) : !accessToken ? (
          <>
            <View style={styles.filterRow}>
              <View style={styles.filterPill}>
                <Text style={styles.filterPillText}>{t('trendShowsApi')}</Text>
              </View>
            </View>
            {renderCarousel(t('trendShowsApi'), effectiveUpNext)}
          </>
        ) : (
          <>
            {renderCarousel(t('upNext'), upNextShows)}
            {renderCarousel(t('notStarted'), watchlistShowsList)}
            {renderCarousel(t('inactive'), inactiveShows)}

            {upNextShows.length === 0 && watchlistShowsList.length === 0 && inactiveShows.length === 0 && (
              <Text style={styles.emptyText}>{t('noShowsInCategory')}</Text>
            )}
          </>
        )}

        {showConfetti && finishedShow && (
          <View style={styles.confettiOverlay}>
            <View style={styles.congratsContainer}>
              <Text style={styles.congratsTitle}>{t('congrats')}</Text>
              <Text style={styles.congratsText}>{finishedShow.name} {t('showFinished')}</Text>

              <View style={{ marginTop: 24, padding: 16, backgroundColor: '#262626', borderRadius: 8, alignItems: 'center' }}>
                 <Text style={{color: '#fff', fontWeight: 'bold', marginBottom: 8}}>{t('howWasShow')}</Text>
                 <InlineRater
                   onRate={async (val) => {
                     await addRating(finishedShow.id, 'show', val);
                     setTimeout(() => setShowConfetti(false), 800);
                   }}
                 />
              </View>

              <TouchableOpacity
                style={{ marginTop: 16, padding: 8 }}
                onPress={() => setShowConfetti(false)}
              >
                 <Text style={{color: '#a3a3a3'}}>{t('close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageBackground: { flex: 1, backgroundColor: '#0B1120' },
  container: { flex: 1 },
  contentContainer: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 32,
  },

  segmentedControlContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    padding: 4,
    marginBottom: 32,
    alignSelf: 'flex-start', // Left align
    minWidth: 300,
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  segmentedTabActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  segmentedTabText: {
    fontWeight: '600',
    color: '#a3a3a3',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  segmentedTabTextActive: {
    color: '#3B82F6',
    fontWeight: 'bold',
  },

  filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  filterPill: { backgroundColor: 'rgba(82, 82, 82, 0.5)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 9999 },
  filterPillText: { color: '#ffffff', fontSize: 12, fontWeight: '600', letterSpacing: 1 },

  categoryTitle: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    letterSpacing: 0.5,
  },

  emptyText: { color: '#64748b', paddingVertical: 40, fontStyle: 'italic', fontSize: 16 },
  confettiOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  congratsContainer: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 32, borderRadius: 16, alignItems: 'center' },
  congratsTitle: { fontSize: 32, fontWeight: 'bold', color: '#3B82F6', marginBottom: 12 },
  congratsText: { fontSize: 18, color: '#ffffff', textAlign: 'center' },
});
