import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList, RefreshControl, Dimensions, InteractionManager, Platform } from 'react-native';

import MovieCard from '../../../components/movies/MovieCard';
import SkeletonLoader from '../../../components/SkeletonLoader';
import { useAuth } from '../../../context/AuthContext';
import { useLibrary } from '../../../context/LibraryContext';
import { getDateGroup, isFutureDate } from '../../../utils/dateHelper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import ConfettiCannon from 'react-native-confetti-cannon';
import WebCarousel from '../../../components/web/WebCarousel';
import { useRouter } from 'expo-router';
import { useResponsive } from '../../../hooks/useResponsive';
import MoviesMobile from '../../../screens/MoviesMobile';
import { viewAllStore } from '../../../utils/viewAllStore';
import LoginPaywall from '../../../components/LoginPaywall';

const { width } = Dimensions.get('window');

export default function MoviesScreenWeb() {
  const { isDesktop } = useResponsive();
  const router = useRouter();

  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('izleme');
  const [renderedTab, setRenderedTab] = useState('izleme');
  const { t, i18n } = useTranslation('media');
  
  const [watchlistMoviesList, setWatchlistMoviesList] = useState<any[]>([]);
  const [upcomingMovies, setUpcomingMovies] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [finishedMovieName, setFinishedMovieName] = useState('');
  
  const { accessToken, isGuest } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const { watchlistMovies, calendarMovies, isLoading: isLibraryLoading, refreshLibrary } = useLibrary();

  const groupedUpcomingMovies = useMemo(() => {
    const groups: { title: string, data: any[] }[] = [];
    upcomingMovies.forEach(movie => {
      const existing = groups.find(g => g.title === movie.dateGroup);
      if (existing) {
        existing.data.push(movie);
      } else {
        groups.push({ title: movie.dateGroup, data: [movie] });
      }
    });
    return groups;
  }, [upcomingMovies]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setTimeout(() => {
      setRenderedTab(tab);
    }, 50);
  };

  useEffect(() => {
    if (accessToken) {
      if (!isLibraryLoading) {
        InteractionManager.runAfterInteractions(() => {
          processData();
        });
      }
    } else {
      setWatchlistMoviesList([]);
      setUpcomingMovies([]);
      setIsLoading(false);
    }
  }, [accessToken, isLibraryLoading, watchlistMovies, calendarMovies, i18n.language]);

  const onRefresh = React.useCallback(async () => {
    if (!accessToken) return;
    setRefreshing(true);
    await refreshLibrary();
    setRefreshing(false);
  }, [accessToken, refreshLibrary]);

  const processData = async () => {
    setIsLoading(true);
    try {
      const CHUNK_SIZE = 3;
      
      const watchlistTemp: any[] = [];
      const farFutureTemp: any[] = [];
      
      try {
        for (let i = 0; i < watchlistMovies.length; i += CHUNK_SIZE) {
          const chunk = watchlistMovies.slice(i, i + CHUNK_SIZE);
          
          await Promise.all(chunk.map(async (item: any) => {
            const traktId = item?.movie?.ids?.trakt;
            if (!traktId) return;
            const movie = item.movie;
            const tmdbId = movie?.ids?.tmdb;
            
            const releaseDateStr = movie.released;
            let isAired = true;
            
            if (releaseDateStr) {
              isAired = !isFutureDate(releaseDateStr);
            }

            const formattedObj = {
              id: traktId,
              tmdbId: tmdbId,
              title: (movie?.title || t('unnamedMovie')).toUpperCase(),
              year: movie.year,
              releaseDate: releaseDateStr,
              image: null,
              tags: ['WATCHLIST'],
            };

            if (isAired) {
              watchlistTemp.push(formattedObj);
            } else {
              farFutureTemp.push({
                ...formattedObj,
                first_aired: releaseDateStr,
                tags: []
              });
            }
          }));
        }
        
        setWatchlistMoviesList(watchlistTemp);
      } catch (e) {
        console.log('Watchlist movies error:', e);
      }

      try {
        const upcomingTemp: any[] = [];
        const seenMovies = new Set();
        
        for (let i = 0; i < calendarMovies.length; i += CHUNK_SIZE) {
          const chunk = calendarMovies.slice(i, i + CHUNK_SIZE);
          
          await Promise.all(chunk.map(async (item: any) => {
            const traktId = item?.movie?.ids?.trakt;
            if (!traktId) return;
            const movie = item.movie;
            
            if (seenMovies.has(traktId)) return;
            seenMovies.add(traktId);
            
            const tmdbId = movie.ids.tmdb;
            
            if (!isFutureDate(movie.released)) return; 
            
            const dateObj = new Date(movie.released);
            const todayDate = new Date();
            todayDate.setHours(0,0,0,0);
            const targetDate = new Date(dateObj);
            targetDate.setHours(0,0,0,0);
            
            const diffTime = targetDate.getTime() - todayDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            const dateGroup = getDateGroup(dateObj, t);
            
            upcomingTemp.push({
              id: traktId,
              title: (movie?.title || t('unnamedMovie')).toUpperCase(),
              year: movie.year,
              releaseDate: movie.released,
              image: null,
              tags: [],
              rawDate: dateObj.getTime(),
              dateGroup: dateGroup,
              countdownDays: diffDays >= 0 ? diffDays : 0,
              tmdbId: tmdbId
            });
          }));
        }
        
        farFutureTemp.forEach((movie: any) => {
          if (seenMovies.has(movie.id)) return;
          seenMovies.add(movie.id);
          
          if (!isFutureDate(movie.first_aired)) return;

          const todayDate = new Date();
          todayDate.setHours(0,0,0,0);
          const dateObj = new Date(movie.first_aired);
          const targetDate = new Date(dateObj);
          targetDate.setHours(0,0,0,0);
          const diffTime = targetDate.getTime() - todayDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          upcomingTemp.push({
            ...movie,
            rawDate: dateObj.getTime(),
            dateGroup: getDateGroup(dateObj, t),
            countdownDays: diffDays >= 0 ? diffDays : 0,
          });
        });
        
        upcomingTemp.sort((a, b) => a.rawDate - b.rawDate);
        setUpcomingMovies(upcomingTemp);
        
      } catch (e) {
        console.log('Calendar movies error:', e);
      }

    } catch (error: any) {
      console.log('Filmler işlenirken hata oluştu', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMovieFinished = useCallback((movieName: string) => {
    setFinishedMovieName(movieName);
    setShowConfetti(true);
    setTimeout(() => {
      setShowConfetti(false);
    }, 3500);
  }, []);

  const renderCarousel = (title: string, data: any[], routeType: string = 'movies') => {
    return (
      <WebCarousel 
        title={title} 
        data={data} 
        renderItem={({ item }) => <MovieCard data={item} onMovieFinished={handleMovieFinished} />}
        onViewAll={() => {
          viewAllStore.data = data;
          viewAllStore.title = title;
          router.push(`/(protected)/library/view-all?type=${routeType}` as any);
        }}
      />
    );
  };

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

        {isLoading || isLibraryLoading ? (
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

  carouselSection: {
    marginBottom: 40,
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
