import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, ScrollView, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import SkeletonLoader from '../components/SkeletonLoader';
import LoginPaywall from '../components/LoginPaywall';
import { addRating } from '../services/traktApi';
import { getTrendingShows } from '../services/traktApi';
import { useAuth } from '../context/AuthContext';
import { useLibrarySelector, useLibraryActions } from '../context/LibraryContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from '../utils/secureStorage';
import { useTranslation } from 'react-i18next';
import { useDashboardData } from '../hooks/useDashboardData';
import { groupByDateGroup } from '../utils/groupByDateGroup';
import SegmentedTabControl from '../components/index/SegmentedTabControl';
import UpcomingSectionList from '../components/index/UpcomingSectionList';
import TrendingFallbackList from '../components/index/TrendingFallbackList';
import WatchlistSectionList from '../components/index/WatchlistSectionList';
import CelebrationOverlay from '../components/index/CelebrationOverlay';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type CollapsedState = { upNext: boolean; inactive: boolean; dropped: boolean; watchlist: boolean };

// Kategori aç/kapa animasyonu. Hazır preset'ler (özellikle scale içerenler)
// Android'de SectionList ile takılma/kayma yapabiliyor; yalnızca opacity +
// easeInEaseOut kullanan bu kısa config her iki platformda da stabil.
const COLLAPSE_ANIMATION = {
  duration: 240,
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

export default function DizilerScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('izleme');
  const [renderedTab, setRenderedTab] = useState('izleme');
  const { t, i18n } = useTranslation('media');

  const [trendingFallback, setTrendingFallback] = useState<any[]>([]);

  const [collapsed, setCollapsed] = useState<CollapsedState>({
    upNext: false,
    inactive: true,
    dropped: true,
    watchlist: true
  });

  const [isLoading, setIsLoading] = useState(true);
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

  const {
    upNextShows,
    inactiveShows,
    watchlistShowsList,
    upcomingShows
  } = useDashboardData(
    watchedShows,
    watchlistShows,
    calendarShows,
    showProgressMap,
    calendarSeasonsMap,
    i18n.language
  );

  const groupedUpcomingShows = useMemo(() => groupByDateGroup(upcomingShows), [upcomingShows]);

  const loadCollapsedState = async () => {
    try {
      const savedState = await SecureStore.getItemAsync('kaymak_collapsed_state');
      if (savedState) {
        setCollapsed(JSON.parse(savedState));
      }
    } catch (error) {
      console.log('Kategori durumu yüklenemedi', error);
    }
  };

  useEffect(() => {
    loadCollapsedState();
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setTimeout(() => {
      setRenderedTab(tab);
    }, 50);
  };

  const fetchTrendingFallback = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getTrendingShows();
      const formattedData = await Promise.all(data.map(async (item: any, index: number) => {
        return {
          id: item.show.ids.trakt,
          showName: (item.show?.title || t('unnamedShow')).toUpperCase(),
          season: 1,
          episode: 1,
          title: `${item.show.year || ''} - ${item.watchers} ${t('watching')}`,
          tags: index < 3 ? ['TRENDING'] : [],
          image: null,
        };
      }));
      setTrendingFallback(formattedData);
    } catch (error) {
      console.log('Trendler çekilemedi', error);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (accessToken) {
      setIsLoading(isLibraryLoading);
    } else if (!isGuest) {
      fetchTrendingFallback();
    }
  }, [accessToken, isLibraryLoading, isGuest, fetchTrendingFallback]);

  // Bir önceki aç/kapa animasyonu bitmeden gelen dokunuş, Android'de
  // LayoutAnimation'ı yarıda kesip listeyi "takılı" bırakabiliyor — animasyon
  // süresi boyunca yeni dokunuşları yut.
  const toggleLockRef = useRef(0);

  const toggleCategory = async (category: keyof CollapsedState) => {
    const now = Date.now();
    if (now - toggleLockRef.current < COLLAPSE_ANIMATION.duration + 40) return;
    toggleLockRef.current = now;

    LayoutAnimation.configureNext(COLLAPSE_ANIMATION);
    const newState = { ...collapsed, [category]: !collapsed[category] };
    setCollapsed(newState);
    try {
      await SecureStore.setItemAsync('kaymak_collapsed_state', JSON.stringify(newState));
    } catch (error) {
      // sessiz hata
    }
  };

  const onRefresh = useCallback(async () => {
    if (!accessToken) return;
    setRefreshing(true);
    await refreshLibrary();
    setRefreshing(false);
  }, [accessToken, refreshLibrary]);

  const handleShowFinished = useCallback((showName: string, showId: number) => {
    setFinishedShow({ name: showName, id: showId });
    setShowConfetti(true);
    // Modal'ı hemen kapatmıyoruz, kullanıcının puan vermesini bekleyebiliriz.
    // Confetti kendi kendine bitiyor.
  }, []);

  const izlemeSections = useMemo(() => {
    const sections = [];
    const effectiveUpNext = upNextShows.length > 0 ? upNextShows : trendingFallback;
    if (effectiveUpNext.length > 0) {
      sections.push({
        title: t('upNext'),
        key: 'upNext',
        data: collapsed.upNext ? [] : effectiveUpNext,
        count: effectiveUpNext.length,
      });
    }
    if (watchlistShowsList.length > 0) {
      sections.push({
        title: t('notStarted'),
        key: 'watchlist',
        data: collapsed.watchlist ? [] : watchlistShowsList,
        count: watchlistShowsList.length,
      });
    }
    if (inactiveShows.length > 0) {
      sections.push({
        title: t('inactive'),
        key: 'inactive',
        data: collapsed.inactive ? [] : inactiveShows,
        count: inactiveShows.length,
      });
    }
    return sections;
  }, [upNextShows, watchlistShowsList, inactiveShows, collapsed, i18n.language, trendingFallback]);

  if (isGuest) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LoginPaywall message={t('loginToSeeCalendar', 'Yaklaşan dizilerinizi ve kendi izleme takviminizi oluşturmak için aramıza katılın!')} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <SegmentedTabControl
        activeTab={activeTab}
        onTabChange={handleTabChange}
        watchlistLabel={t('watchlistTab')}
        upcomingLabel={t('upcomingTab')}
      />

      {isLoading || isLibraryLoading ? (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
          <View style={styles.skeletonBlock}>
            <SkeletonLoader width={100} height={20} style={styles.skeletonTitle} />
            <View style={styles.skeletonRows}>
              <SkeletonLoader width="100%" height={144} borderRadius={8} style={styles.skeletonRow} />
              <SkeletonLoader width="100%" height={144} borderRadius={8} style={styles.skeletonRow} />
              <SkeletonLoader width="100%" height={144} borderRadius={8} />
            </View>
          </View>
        </ScrollView>
      ) : renderedTab === 'yaklasan' && accessToken ? (
        <UpcomingSectionList
          sections={groupedUpcomingShows}
          onShowFinished={handleShowFinished}
          refreshing={refreshing}
          onRefresh={onRefresh}
          insets={insets}
          emptyLabel={t('noUpcomingShows')}
        />
      ) : !accessToken ? (
        <TrendingFallbackList
          data={upNextShows}
          onShowFinished={handleShowFinished}
          insets={insets}
          trendLabel={t('trendShowsApi')}
        />
      ) : (
        <WatchlistSectionList
          sections={izlemeSections}
          collapsed={collapsed}
          onToggleCategory={toggleCategory}
          onShowFinished={handleShowFinished}
          refreshing={refreshing}
          onRefresh={onRefresh}
          insets={insets}
          emptyLabel={t('noShowsInCategory')}
        />
      )}

      {showConfetti && finishedShow && (
        <CelebrationOverlay
          finishedShow={finishedShow}
          onRate={async (val) => { await addRating(finishedShow.id, 'show', val); }}
          onClose={() => setShowConfetti(false)}
          howWasShowLabel={t('howWasShow')}
          congratsLabel={t('congrats')}
          showFinishedLabel={t('showFinished')}
          closeLabel={t('close')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  scrollContent: { paddingTop: 12 },
  skeletonBlock: { marginBottom: 16 },
  skeletonTitle: { marginBottom: 12, marginLeft: 16 },
  skeletonRows: { paddingHorizontal: 16 },
  skeletonRow: { marginBottom: 12 },
});
