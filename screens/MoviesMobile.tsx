import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SectionList, FlatList, RefreshControl, Dimensions, Alert, InteractionManager, Platform } from 'react-native';
import LoadingIndicator from '../components/LoadingIndicator';

import ConfettiCannon from 'react-native-confetti-cannon';
import MovieCard from '../components/movies/MovieCard';
import LoginPaywall from '../components/LoginPaywall';
import { getMoviePoster } from '../services/tmdbApi';
import SkeletonLoader from '../components/SkeletonLoader';
import { useAuth } from '../context/AuthContext';
import { useLibrary } from '../context/LibraryContext';
import { getDateGroup, isFutureDate } from '../utils/dateHelper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

export default function MoviesScreen() {
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
  const { watchlistMovies, calendarMovies, isLoading: isLibraryLoading } = useLibrary();

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

  const processData = async () => {
    setIsLoading(true);
    try {
      const CHUNK_SIZE = 3;
      
      // 1. Watchlist (İzleme Listesi)
      const watchlistTemp: any[] = [];
      const farFutureTemp: any[] = [];
      
      try {
        // Fallback: if cache is empty but we are processing, watchlistMovies will be empty
        // Since movies don't have progress calculation, they just appear instantly if cache exists.
        for (let i = 0; i < watchlistMovies.length; i += CHUNK_SIZE) {
          const chunk = watchlistMovies.slice(i, i + CHUNK_SIZE);
          
          await Promise.all(chunk.map(async (item: any) => {
            const traktId = item?.movie?.ids?.trakt;
            if (!traktId) return;
            const movie = item.movie;
            const tmdbId = movie?.ids?.tmdb;
            let imageUrl = null;
            
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
              image: imageUrl,
              tags: ['WATCHLIST'],
            };

            if (isAired) {
              watchlistTemp.push(formattedObj);
            } else {
              // Gelecekte çıkacak olanlar Takvimde (Uzak Gelecek) listelenmeli
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

      // 2. Takvim (Yaklaşanlar)
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
            let imageUrl = null;
            
            if (!isFutureDate(movie.released)) return; // Geçmiş filmleri atla
            
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
              image: imageUrl,
              tags: [],
              rawDate: dateObj.getTime(),
              dateGroup: dateGroup,
              countdownDays: diffDays >= 0 ? diffDays : 0,
            });
          }));
        }
        
        // Uzak Gelecek Filmlerini (33 Gün Sonrası) Ekleyelim
        farFutureTemp.forEach((movie: any) => {
          if (seenMovies.has(movie.id)) return;
          seenMovies.add(movie.id);
          
          if (!isFutureDate(movie.first_aired)) return; // Geçmiş filmleri atla

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

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setTimeout(() => {
      setRenderedTab(tab);
    }, 50);
  };

  if (isGuest) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LoginPaywall message={t('loginToSeeCalendar', 'Yaklaşan filmlerinizi ve kendi izleme takviminizi oluşturmak için aramıza katılın!')} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
          renderItem={({ item }) => <MovieCard data={item} onMovieFinished={handleMovieFinished} />}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.calendarDateHeader}>{title}</Text>
          )}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          stickySectionHeadersEnabled={false}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={3}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('noUpcomingMovies')}</Text>
          }
        />
      ) : (
        <FlatList
          data={watchlistMoviesList}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => <MovieCard data={item} onMovieFinished={handleMovieFinished} />}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          style={styles.scrollView}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={3}
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
  
  // Segmented Control
  segmentedControlContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    padding: 4,
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  segmentedTabActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)', // Soft Glass Effect
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

  scrollView: { flex: 1, paddingHorizontal: 12 },
  scrollContent: { paddingTop: 12 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#a3a3a3', marginTop: 12, fontSize: 14 },
  categoryList: { paddingBottom: 24 },
  emptyText: { color: '#64748b', textAlign: 'center', paddingVertical: 40, fontStyle: 'italic' },
  calendarDateHeader: { color: '#a3a3a3', fontSize: 13, fontWeight: 'bold', letterSpacing: 1, marginTop: 16, marginBottom: 12, marginLeft: 4 },
  confettiOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  congratsContainer: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 24, borderRadius: 16, alignItems: 'center' },
  congratsTitle: { fontSize: 28, fontWeight: 'bold', color: '#3B82F6', marginBottom: 8 },
  congratsText: { fontSize: 16, color: '#ffffff', textAlign: 'center' },
});
