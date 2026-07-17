import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Settings, Heart, List as ListIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../../context/AuthContext';
import { useLibrary } from '../../../context/LibraryContext';
import { useResponsive } from '../../../hooks/useResponsive';
import ProfileMobile from '../../../screens/ProfileMobile';
import WebCarousel from '../../../components/web/WebCarousel';
import { viewAllStore } from '../../../utils/viewAllStore';
import EpisodeCard from '../../../components/EpisodeCard';
import MovieCard from '../../../components/movies/MovieCard';
import ListCard from '../../../components/ListCard.web';
import LoadingIndicator from '../../../components/LoadingIndicator';
import MediaPoster from '../../../components/MediaPoster';
import LoginPaywall from '../../../components/LoginPaywall';

export default function ProfileScreenWeb() {
  const { isDesktop } = useResponsive();
  const { accessToken, isGuest } = useAuth();
  const { watchedShows, watchedMovies, customLists, favShows, favMovies, isLoading: isLibraryLoading } = useLibrary();
  const router = useRouter();
  const { t, i18n } = useTranslation('media');
  const insets = useSafeAreaInsets();
  
  const [isLoading, setIsLoading] = useState(true);

  const [lists, setLists] = useState<any[]>([]);
  const [shows, setShows] = useState<any[]>([]);
  const [movies, setMovies] = useState<any[]>([]);
  const [favShowsState, setFavShowsState] = useState<any[]>([]);
  const [favMoviesState, setFavMoviesState] = useState<any[]>([]);

  useEffect(() => {
    if (isDesktop && accessToken) {
      if (!isLibraryLoading) {
        processData();
      }
    } else {
      setIsLoading(false);
    }
  }, [
    isDesktop,
    accessToken, 
    isLibraryLoading, 
    watchedShows?.length, 
    watchedMovies?.length, 
    customLists?.length, 
    favShows?.length, 
    favMovies?.length,
    i18n.language
  ]);

  if (!isDesktop) {
    return <ProfileMobile />;
  }

  const mapData = (items: any[], type: 'show' | 'movie') => {
    return items.map((item: any) => ({
      id: type === 'show' ? item.show?.ids?.trakt : item.movie?.ids?.trakt,
      rawTraktId: type === 'show' ? item.show?.ids?.trakt : item.movie?.ids?.trakt,
      title: type === 'show' ? item.show?.title : item.movie?.title,
      showName: type === 'show' ? item.show?.title : undefined,
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

  const renderCarousel = (title: string, data: any[], routeType: string, CardComponent: React.ComponentType<any>) => {
    if (!data || data.length === 0) return null;
    
    return (
      <WebCarousel 
        title={title} 
        data={data} 
        renderItem={({ item }) => <CardComponent data={item} />}
        onViewAll={() => {
          viewAllStore.data = data;
          viewAllStore.title = title;
          router.push(`/(protected)/library/view-all?type=${routeType}` as any);
        }}
      />
    );
  };

  if (!accessToken || isGuest) {
    return (
      <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LoginPaywall message={t('profileLoginReq', 'Profilinizi görüntülemek ve istatistiklerinize ulaşmak için giriş yapın.')} />
      </View>
    );
  }

  return (
    <View style={styles.pageBackground}>
      <style dangerouslySetInnerHTML={{ __html: `
        .list-card:hover { transform: scale(1.05); }
        .list-card:hover .hover-overlay { background-color: rgba(255,255,255,0.1) !important; }
      `}} />
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topHeader}>
          <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/(protected)/user-settings')}>
            <Settings size={28} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {isLoading || isLibraryLoading ? (
          <View style={styles.centered}>
            <LoadingIndicator />
          </View>
        ) : (
          <View style={styles.carouselsContainer}>
            {renderCarousel(t('lists'), lists, 'lists', ListCard)}
            {renderCarousel(t('shows'), shows, 'shows', EpisodeCard)}
            {renderCarousel(t('favShows'), favShowsState, 'shows', EpisodeCard)}
            {renderCarousel(t('movies'), movies, 'movies', MovieCard)}
            {renderCarousel(t('favMovies'), favMoviesState, 'movies', MovieCard)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageBackground: { 
    flex: 1, 
    backgroundColor: '#0B1120',
  },
  safeArea: { 
    flex: 1, 
    backgroundColor: '#0B1120',
  },
  container: { 
    flex: 1 
  },
  contentContainer: { 
    width: '100%', 
    maxWidth: 1200, 
    marginHorizontal: 'auto',
    paddingHorizontal: 20,
  },
  topHeader: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end',
    marginBottom: 32,
  },
  settingsButton: { 
    padding: 8,
    backgroundColor: '#1f2937',
    borderRadius: 20,
    ...( { cursor: 'pointer', transition: 'all 0.2s ease' } as any)
  },
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    minHeight: 300,
  },
  loginText: { 
    color: '#ffffff', 
    fontSize: 16 
  },
  carouselsContainer: {
    gap: 16,
  }
});
