import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar, TouchableOpacity, Platform, Dimensions } from 'react-native';
import LoadingIndicator from '../components/LoadingIndicator';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, Settings } from 'lucide-react-native';
import HorizontalShowList from '../components/HorizontalShowList';
import { useAuth } from '../context/AuthContext';
import { useLibrary } from '../context/LibraryContext';
import { useRouter } from 'expo-router';
import { getShowPoster, getMoviePoster } from '../services/tmdbApi';
import SkeletonLoader from '../components/SkeletonLoader';
import { useTranslation } from 'react-i18next';
import LoginPaywall from '../components/LoginPaywall';

export default function ProfileScreen() {
  const { accessToken, isGuest } = useAuth();
  const { watchedShows, watchedMovies, customLists, favShows, favMovies, isLoading: isLibraryLoading } = useLibrary();
  const router = useRouter();
  const { t, i18n } = useTranslation('media');
  const insets = useSafeAreaInsets();
  
  const { width } = Dimensions.get('window');
  const skeletonWidth = width * 0.28;
  const skeletonHeight = skeletonWidth * 1.5;
  
  const [isLoading, setIsLoading] = useState(true);

  const [lists, setLists] = useState<any[]>([]);
  const [shows, setShows] = useState<any[]>([]);
  const [movies, setMovies] = useState<any[]>([]);
  const [favShowsState, setFavShowsState] = useState<any[]>([]);
  const [favMoviesState, setFavMoviesState] = useState<any[]>([]);

  useEffect(() => {
    if (accessToken) {
      if (!isLibraryLoading) {
        processData();
      }
    } else {
      setIsLoading(false);
    }
  }, [
    accessToken, 
    isLibraryLoading, 
    watchedShows?.length, 
    watchedMovies?.length, 
    customLists?.length, 
    favShows?.length, 
    favMovies?.length,
    i18n.language
  ]);

  const mapData = (items: any[], type: 'show' | 'movie') => {
    return items.map((item: any) => ({
      id: type === 'show' ? item.show?.ids?.trakt : item.movie?.ids?.trakt,
      title: type === 'show' ? item.show?.title : item.movie?.title,
      tmdbId: type === 'show' ? item.show?.ids?.tmdb : item.movie?.ids?.tmdb,
    }));
  };

  const processData = async () => {
    setIsLoading(true);
    try {
      if (watchedShows && watchedShows.length > 0) {
        const recentShows = [...watchedShows]
          .sort((a: any, b: any) => new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime())
          .slice(0, 100); 
        setShows(mapData(recentShows, 'show'));
      } else {
        setShows([]);
      }

      if (watchedMovies && watchedMovies.length > 0) {
        const recentMovies = [...watchedMovies]
          .sort((a: any, b: any) => new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime())
          .slice(0, 100);
        setMovies(mapData(recentMovies, 'movie'));
      } else {
        setMovies([]);
      }

      if (customLists && customLists.length > 0) {
        const formattedLists = customLists.map((item: any) => ({
          id: item.ids?.trakt,
          title: item.name,
          image: null, 
        }));
        setLists(formattedLists);
      } else {
        setLists([]);
      }

      if (favShows && favShows.length > 0) {
        setFavShowsState(mapData([...favShows].slice(0, 100), 'show'));
      } else {
        setFavShowsState([]);
      }

      if (favMovies && favMovies.length > 0) {
        setFavMoviesState(mapData([...favMovies].slice(0, 100), 'movie'));
      } else {
        setFavMoviesState([]);
      }

    } catch (error) {
      console.log('Profil verileri formatlama hatası:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!accessToken || isGuest) {
    return (
      <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LoginPaywall message={t('profileLoginReq', 'Profilinizi görüntülemek ve istatistiklerinize ulaşmak için giriş yapın.')} />
      </View>
    );
  }

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/(protected)/user-settings')}>
          <Settings size={24} color="#a3a3a3" />
        </TouchableOpacity>
      </View>

      {isLoading || isLibraryLoading ? (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <View style={styles.headerSpacer} />
          <View style={{ marginBottom: 24, marginLeft: 16 }}>
            <SkeletonLoader width={120} height={24} style={{ marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <SkeletonLoader width={skeletonWidth} height={skeletonHeight} borderRadius={8} />
              <SkeletonLoader width={skeletonWidth} height={skeletonHeight} borderRadius={8} />
              <SkeletonLoader width={skeletonWidth} height={skeletonHeight} borderRadius={8} />
            </View>
          </View>
          <View style={{ marginBottom: 24, marginLeft: 16 }}>
            <SkeletonLoader width={120} height={24} style={{ marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <SkeletonLoader width={skeletonWidth} height={skeletonHeight} borderRadius={8} />
              <SkeletonLoader width={skeletonWidth} height={skeletonHeight} borderRadius={8} />
              <SkeletonLoader width={skeletonWidth} height={skeletonHeight} borderRadius={8} />
            </View>
          </View>
        </ScrollView>
      ) : (
        <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}>
          <View style={styles.headerSpacer} />
          
          <HorizontalShowList 
            title={t('lists')} 
            data={lists} 
            onShowAll={() => router.push('/(protected)/library/lists')}
            type="list"
          />

          <HorizontalShowList 
            title={t('shows')} 
            data={shows} 
            onShowAll={() => router.push('/(protected)/library/shows')}
          />

          <HorizontalShowList 
            title={t('favShows')} 
            titleIcon={<Heart size={20} color="#ef4444" fill="#ef4444" />}
            data={favShowsState} 
            onShowAll={() => router.push('/(protected)/library/favShows')}
          />

          <HorizontalShowList 
            title={t('movies')} 
            data={movies} 
            onShowAll={() => router.push('/(protected)/library/movies')}
            type="movie"
          />

          {favMoviesState.length > 0 ? (
            <HorizontalShowList 
              title={t('favMovies')} 
              titleIcon={<Heart size={20} color="#ef4444" fill="#ef4444" />}
              data={favMoviesState} 
              onShowAll={() => router.push('/(protected)/library/favMovies')}
              type="movie"
            />
          ) : (
            <View style={styles.emptyFavContainer}>
              <View style={styles.emptyFavHeader}>
                <Heart size={20} color="#ef4444" fill="#ef4444" style={{marginRight: 8}} />
                <Text style={styles.emptyFavTitle}>{t('favMovies')}</Text>
              </View>
              <View style={styles.emptyFavCard}>
                <Text style={styles.plusIcon}>+</Text>
                <Text style={styles.emptyFavText}>{t('addFavMovies')}</Text>
              </View>
            </View>
          )}

        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B1120' },
  container: { flex: 1 },
  topHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'flex-end' },
  settingsButton: { padding: 4 },
  content: { paddingTop: 8, paddingBottom: 40 },
  headerSpacer: { height: 8 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#a3a3a3', marginTop: 12 },
  loginText: { color: '#ffffff', fontSize: 16 },
  emptyFavContainer: { paddingHorizontal: 16, marginBottom: 24 },
  emptyFavHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  emptyFavTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  emptyFavCard: { height: 120, backgroundColor: '#172033', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2A364F', borderStyle: 'dashed' },
  plusIcon: { color: '#ffffff', fontSize: 32, fontWeight: '300', marginBottom: 4 },
  emptyFavText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
});
