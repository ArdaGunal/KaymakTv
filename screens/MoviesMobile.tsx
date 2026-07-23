import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, SectionList, FlatList, Dimensions, Platform } from 'react-native';

import ConfettiCannon from 'react-native-confetti-cannon';
import MovieCard from '../components/movies/MovieCard';
import LoginPaywall from '../components/LoginPaywall';
import SkeletonLoader from '../components/SkeletonLoader';
import { useAuth } from '../context/AuthContext';
import { useLibrarySelector } from '../context/LibraryContext';
import { useTrackingStore } from '../store/tracking/useTrackingStore';
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

  const { accessToken, isGuest } = useAuth();

  // Katı seçici: yalnızca film dilimleri okunur; dizi/progress güncellemeleri bu ekranı render etmez.
  const { watchlistMovies, calendarMovies, isMoviesLoading } = useLibrarySelector(s => ({
    watchlistMovies: s.watchlistMovies,
    calendarMovies: s.calendarMovies,
    isMoviesLoading: s.isMoviesLoading,
  }));

  // Dizi kartlarındaki 3-nokta menüsüyle (Bırak/Listeye Ekle/Favorile/Paylaş)
  // aynı özellik film kartlarında da olsun istendi — "Bırakıldı" durumu dizilerle
  // aynı izole tracking store'dan (droppedMovieIds) geliyor.
  const droppedMovieIds = useTrackingStore((s) => s.droppedMovieIds);
  const toggleDroppedMovieStatus = useTrackingStore((s) => s.toggleDroppedMovieStatus);
  const hydrateTracking = useTrackingStore((s) => s.hydrate);

  useEffect(() => {
    hydrateTracking();
  }, [hydrateTracking]);

  const { watchlistMoviesList, upcomingMovies } = useMoviesDashboardData(
    accessToken ? watchlistMovies : [],
    accessToken ? calendarMovies : [],
    i18n.language
  );

  const groupedUpcomingMovies = useMemo(() => groupByDateGroup(upcomingMovies), [upcomingMovies]);

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
        isDropped={droppedMovieIds.includes(item.id)}
        onToggleDropped={() => toggleDroppedMovieStatus(item.id)}
      />
    ),
    [handleMovieFinished, droppedMovieIds, toggleDroppedMovieStatus]
  );

  if (isGuest) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LoginPaywall message={t('loginToSeeCalendar', 'Yaklaşan filmlerinizi ve kendi izleme takviminizi oluşturmak için aramıza katılın!')} />
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
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('noUpcomingMovies')}</Text>
          }
        />
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
