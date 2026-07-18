import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';

import MovieCard from '../../../components/movies/MovieCard';
import SkeletonLoader from '../../../components/SkeletonLoader';
import { useAuth } from '../../../context/AuthContext';
import { useLibrarySelector, useLibraryActions } from '../../../context/LibraryContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import WebCarousel from '../../../components/web/WebCarousel';
import { useRouter } from 'expo-router';
import { useResponsive } from '../../../hooks/useResponsive';
import MoviesMobile from '../../../screens/MoviesMobile';
import { viewAllStore } from '../../../utils/viewAllStore';
import LoginPaywall from '../../../components/LoginPaywall';
import { useMoviesDashboardData } from '../../../hooks/useMoviesDashboardData';

export default function MoviesScreenWeb() {
  const { isDesktop } = useResponsive();
  const router = useRouter();

  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('izleme');
  const [renderedTab, setRenderedTab] = useState('izleme');
  const { t, i18n } = useTranslation('media');

  const [showConfetti, setShowConfetti] = useState(false);
  const [finishedMovieName, setFinishedMovieName] = useState('');

  const { accessToken, isGuest } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Katı seçici: yalnızca film dilimleri — showProgressMap vb. değiştiğinde bu ekran render OLMAZ.
  const { watchlistMovies, calendarMovies, isMoviesLoading } = useLibrarySelector(s => ({
    watchlistMovies: s.watchlistMovies,
    calendarMovies: s.calendarMovies,
    isMoviesLoading: s.isMoviesLoading,
  }));
  const { refreshLibrary } = useLibraryActions();

  const { watchlistMoviesList, upcomingMovies } = useMoviesDashboardData(
    watchlistMovies,
    calendarMovies,
    i18n.language
  );

  const groupedUpcomingMovies = useMemo(() => {
    const groups: { title: string, data: any[] }[] = [];
    upcomingMovies.forEach((movie: any) => {
      const existing = groups.find(g => g.title === movie.dateGroup);
      if (existing) existing.data.push(movie);
      else groups.push({ title: movie.dateGroup, data: [movie] });
    });
    return groups;
  }, [upcomingMovies]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setTimeout(() => setRenderedTab(tab), 50);
  }, []);

  const onRefresh = useCallback(async () => {
    if (!accessToken) return;
    setRefreshing(true);
    await refreshLibrary();
    setRefreshing(false);
  }, [accessToken, refreshLibrary]);

  const handleMovieFinished = useCallback((movieName: string) => {
    setFinishedMovieName(movieName);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3500);
  }, []);

  const renderMovieItem = useCallback(
    ({ item }: { item: any }) => <MovieCard data={item} onMovieFinished={handleMovieFinished} />,
    [handleMovieFinished]
  );

  const openViewAll = useCallback((title: string, data: any[], routeType: string) => {
    viewAllStore.data = data;
    viewAllStore.title = title;
    router.push(`/(protected)/library/view-all?type=${routeType}` as any);
  }, [router]);

  const renderCarousel = (title: string, data: any[], routeType: string = 'movies') => (
    <WebCarousel
      title={title}
      data={data}
      renderItem={renderMovieItem}
      onViewAll={() => openViewAll(title, data, routeType)}
    />
  );

  if (!isDesktop) {
    return <MoviesMobile />;
  }

  if (isGuest) {
    return (
      <View style={styles.pageBackground}>
        <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
          <LoginPaywall message={t('loginToSeeCalendar', 'Yaklaşan filmlerinizi ve kendi izleme takviminizi oluşturmak için aramıza katılın!')} />
        </View>
      </View>
    );
  }

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

        {isMoviesLoading && accessToken ? (
          <View style={{ marginTop: 24 }}>
             <Text style={styles.categoryTitle}>{t('notStarted')}</Text>
             <View style={{ flexDirection: 'row', gap: 16, marginBottom: 32 }}>
                <SkeletonLoader width={180} height={270} borderRadius={8} />
                <SkeletonLoader width={180} height={270} borderRadius={8} />
                <SkeletonLoader width={180} height={270} borderRadius={8} />
                <SkeletonLoader width={180} height={270} borderRadius={8} />
             </View>
          </View>
        ) : renderedTab === 'yaklasan' ? (
          groupedUpcomingMovies.length > 0 ? (
            groupedUpcomingMovies.map(group => (
              <React.Fragment key={group.title}>
                {renderCarousel(group.title, group.data)}
              </React.Fragment>
            ))
          ) : (
            <Text style={styles.emptyText}>{t('noUpcomingMovies')}</Text>
          )
        ) : (
          <>
            {renderCarousel(t('notStarted'), watchlistMoviesList)}

            {watchlistMoviesList.length === 0 && (
              <Text style={styles.emptyText}>{t('noWatchlistMovies')}</Text>
            )}
          </>
        )}

        {showConfetti && (
          <View style={styles.confettiOverlay} pointerEvents="none">
            <View style={styles.congratsContainer}>
              <Text style={styles.congratsTitle}>{t('congrats')}</Text>
              <Text style={styles.congratsText}>{finishedMovieName} {t('movieFinished')}</Text>
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
    alignSelf: 'flex-start',
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
