import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, SectionList, FlatList, RefreshControl, Dimensions, Platform } from 'react-native';

import ConfettiCannon from 'react-native-confetti-cannon';
import MovieCard from '../components/movies/MovieCard';
import LoginPaywall from '../components/LoginPaywall';
import SkeletonLoader from '../components/SkeletonLoader';
import SyncErrorState from '../components/SyncErrorState';
import { useAuth } from '../context/AuthContext';
import { useLibrarySelector, useLibraryActions } from '../context/LibraryContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useMoviesDashboardData } from '../hooks/useMoviesDashboardData';
import { groupByDateGroup } from '../utils/groupByDateGroup';
import SegmentedTabControl from '../components/index/SegmentedTabControl';

const { width } = Dimensions.get('window');

export default function MoviesScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('izleme');
  const [renderedTab, setRenderedTab] = useState('izleme');
  const { t, i18n } = useTranslation('media');

  const [showConfetti, setShowConfetti] = useState(false);
  const [finishedMovieName, setFinishedMovieName] = useState('');

  const { accessToken, isGuest, authProvider } = useAuth();

  // Katı seçici: yalnızca film dilimleri okunur; dizi/progress güncellemeleri bu ekranı render etmez.
  const { watchlistMovies, calendarMovies, isMoviesLoading, hiddenMovieIds, hasSyncError } = useLibrarySelector(s => ({
    watchlistMovies: s.watchlistMovies,
    calendarMovies: s.calendarMovies,
    isMoviesLoading: s.isMoviesLoading,
    hiddenMovieIds: s.hiddenMovieIds,
    hasSyncError: s.hasSyncError,
  }));

  // Dizi kartlarındaki 3-nokta menüsüyle (Bırak/Listeye Ekle/Favorile/Paylaş)
  // aynı özellik film kartlarında da var — "Bırak" doğrudan Trakt'ın
  // "İlerlemeyi Gizle" uç noktasına bağlıdır (bkz. toggleHiddenFromProgress),
  // dizilerle birebir aynı mekanizma.
  const { toggleHiddenFromProgress, refreshLibrary } = useLibraryActions();

  // Pull-to-refresh: `refreshLibrary` zaten hata durumunda ("Tekrar Dene",
  // SyncErrorState) kullanılıyordu — burada aşağı çekme jestine bağlanıyor.
  // `force=true` ile çağırdığı için (bkz. useLibraryActions) TTL'yi atlar.
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshLibrary();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshLibrary]);

  const { watchlistMoviesList, upcomingMovies } = useMoviesDashboardData(
    accessToken ? watchlistMovies : [],
    accessToken ? calendarMovies : [],
    i18n.language,
    hiddenMovieIds
  );

  const groupedUpcomingMovies = useMemo(() => groupByDateGroup(upcomingMovies), [upcomingMovies]);

  // "Boş" ile "senkron başarısız oldu" ayrımı — bkz. SyncErrorState.tsx /
  // screens/IndexMobile.tsx'teki AYNI mantık.
  const showWatchlistSyncError =
    renderedTab === 'izleme' && !isMoviesLoading && watchlistMoviesList.length === 0 && hasSyncError;
  const showUpcomingSyncError =
    renderedTab === 'yaklasan' && groupedUpcomingMovies.length === 0 && hasSyncError;

  const handleMovieFinished = useCallback((movieName: string) => {
    setFinishedMovieName(movieName);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3500);
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    // Sekme geçiş animasyonu takılmasın diye ağır liste render'ı bir tık ertelenir.
    setTimeout(() => setRenderedTab(tab), 50);
  }, []);

  const renderMovieItem = useCallback(
    ({ item }: { item: any }) => (
      <MovieCard
        data={item}
        onMovieFinished={handleMovieFinished}
        onToggleDropped={() => toggleHiddenFromProgress(item.id, 'movie', false)}
      />
    ),
    [handleMovieFinished, toggleHiddenFromProgress]
  );

  if (isGuest) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LoginPaywall message={t('loginToSeeCalendar', 'Yaklaşan filmlerinizi ve kendi izleme takviminizi oluşturmak için aramıza katılın!')} />
      </View>
    );
  }

  // create_new — bkz. docs/HISTORY.md Madde 221. Google-only (Trakt'sız)
  // kullanıcı: Filmler sekmesi kişisel Trakt senkron verisi gerektirdiği
  // için "Trakt'a bağla" boş durumu gösterilir.
  if (authProvider === 'google') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LoginPaywall
          title={t('common:connectTraktTitle', 'Trakt Hesabını Bağla')}
          message={t('common:connectTraktDesc', 'Kütüphaneni görmek ve senkronlamak için Trakt hesabını bağlaman gerekiyor.')}
          buttonLabel={t('common:connectTraktButton', "Trakt'a Bağlan")}
        />
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

      {isMoviesLoading && accessToken ? (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
          <View style={{ marginBottom: 16 }}>
            <SkeletonLoader width={100} height={20} style={{ marginBottom: 12, marginLeft: 16 }} />
            <View style={{ paddingHorizontal: 16 }}>
              <SkeletonLoader width="100%" height={144} borderRadius={8} style={{ marginBottom: 12 }} />
              <SkeletonLoader width="100%" height={144} borderRadius={8} style={{ marginBottom: 12 }} />
              <SkeletonLoader width="100%" height={144} borderRadius={8} />
            </View>
          </View>
        </ScrollView>
      ) : showUpcomingSyncError ? (
        <SyncErrorState onRetry={refreshLibrary} />
      ) : renderedTab === 'yaklasan' ? (
        <SectionList
          sections={groupedUpcomingMovies}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMovieItem}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.calendarDateHeader}>{title}</Text>
          )}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          stickySectionHeadersEnabled={false}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={3}
          removeClippedSubviews={Platform.OS !== 'web'}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#ffffff" />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('noUpcomingMovies')}</Text>
          }
        />
      ) : showWatchlistSyncError ? (
        <SyncErrorState onRetry={refreshLibrary} />
      ) : (
        <FlatList
          data={watchlistMoviesList}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMovieItem}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          style={styles.scrollView}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={3}
          removeClippedSubviews={Platform.OS !== 'web'}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#ffffff" />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('noWatchlistMovies')}</Text>
          }
        />
      )}

      {showConfetti && (
        <View style={styles.confettiOverlay} pointerEvents="none">
          {Platform.OS !== 'web' && (
            <ConfettiCannon count={200} origin={{ x: width / 2, y: -20 }} fallSpeed={3000} fadeOut={true} />
          )}
          <View style={styles.congratsContainer}>
            <Text style={styles.congratsTitle}>{t('congrats')}</Text>
            <Text style={styles.congratsText}>{finishedMovieName} {t('movieFinished')}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },

  scrollView: { flex: 1, paddingHorizontal: 12 },
  scrollContent: { paddingTop: 12 },
  emptyText: { color: '#64748b', textAlign: 'center', paddingVertical: 40, fontStyle: 'italic' },
  calendarDateHeader: { color: '#a3a3a3', fontSize: 13, fontWeight: 'bold', letterSpacing: 1, marginTop: 16, marginBottom: 12, marginLeft: 4 },
  confettiOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  congratsContainer: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 24, borderRadius: 16, alignItems: 'center' },
  congratsTitle: { fontSize: 28, fontWeight: 'bold', color: '#3B82F6', marginBottom: 8 },
  congratsText: { fontSize: 16, color: '#ffffff', textAlign: 'center' },
});
