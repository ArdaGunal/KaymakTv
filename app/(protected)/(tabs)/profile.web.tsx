import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../../context/AuthContext';
import { useLibrarySelector } from '../../../context/LibraryContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { useProfileLists } from '../../../hooks/useProfileLists';
import ProfileMobile from '../../../screens/ProfileMobile';
import WebCarousel from '../../../components/web/WebCarousel';
import { viewAllStore } from '../../../utils/viewAllStore';
import EpisodeCard from '../../../components/EpisodeCard';
import MovieCard from '../../../components/movies/MovieCard';
import ListCard from '../../../components/profile/ListCard';
import ListCardSkeleton from '../../../components/profile/ListCardSkeleton';
import ListsEmptyCard from '../../../components/profile/ListsEmptyCard';
import LoginPaywall from '../../../components/LoginPaywall';
import ProfileStats from '../../../components/profile/ProfileStats';

const mapMedia = (items: any[], type: 'show' | 'movie') =>
  items.map((item: any) => ({
    id: type === 'show' ? item.show?.ids?.trakt : item.movie?.ids?.trakt,
    rawTraktId: type === 'show' ? item.show?.ids?.trakt : item.movie?.ids?.trakt,
    title: type === 'show' ? item.show?.title : item.movie?.title,
    showName: type === 'show' ? item.show?.title : undefined,
    tmdbId: type === 'show' ? item.show?.ids?.tmdb : item.movie?.ids?.tmdb,
  }));

const sortRecent = (items: any[]) =>
  [...items].sort((a: any, b: any) => new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime());

export default function ProfileScreenWeb() {
  const { isDesktop } = useResponsive();
  const { accessToken, isGuest } = useAuth();
  const router = useRouter();
  const { t } = useTranslation('media');
  const insets = useSafeAreaInsets();

  // Katı seçici: yalnızca profil dilimleri.
  const { watchedShows, watchedMovies, customLists, favShows, favMovies, isLibraryLoading } = useLibrarySelector(s => ({
    watchedShows: s.watchedShows,
    watchedMovies: s.watchedMovies,
    customLists: s.customLists,
    favShows: s.favShows,
    favMovies: s.favMovies,
    isLibraryLoading: s.isLoading,
  }));

  const { lists, isLoading: isListsLoading } = useProfileLists(customLists, isLibraryLoading);

  const shows = useMemo(() => mapMedia(sortRecent(watchedShows || []).slice(0, 100), 'show'), [watchedShows]);
  const movies = useMemo(() => mapMedia(sortRecent(watchedMovies || []).slice(0, 100), 'movie'), [watchedMovies]);
  const favShowsList = useMemo(() => mapMedia((favShows || []).slice(0, 100), 'show'), [favShows]);
  const favMoviesList = useMemo(() => mapMedia((favMovies || []).slice(0, 100), 'movie'), [favMovies]);

  const renderShowItem = useCallback(({ item }: { item: any }) => <EpisodeCard data={item} />, []);
  const renderMovieItem = useCallback(({ item }: { item: any }) => <MovieCard data={item} />, []);
  const renderListItem = useCallback(({ item }: { item: any }) => <ListCard data={item} />, []);

  const openViewAll = useCallback((title: string, data: any[], routeType: string) => {
    viewAllStore.data = data;
    viewAllStore.title = title;
    router.push(`/(protected)/library/view-all?type=${routeType}` as any);
  }, [router]);

  if (!isDesktop) {
    return <ProfileMobile />;
  }

  if (!accessToken || isGuest) {
    return (
      <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LoginPaywall message={t('profileLoginReq', 'Profilinizi görüntülemek ve istatistiklerinize ulaşmak için giriş yapın.')} />
      </View>
    );
  }

  const renderCarousel = (title: string, data: any[], routeType: string, renderItem: any) => {
    if (!data || data.length === 0) return null;
    return (
      <WebCarousel
        title={title}
        data={data}
        renderItem={renderItem}
        onViewAll={() => openViewAll(title, data, routeType)}
      />
    );
  };

  return (
    <View style={styles.pageBackground}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topHeader}>
          <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/(protected)/account')}>
            <Settings size={28} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <ProfileStats />

        <View style={styles.carouselsContainer}>
          {/* Listelerim — her zaman görünür: doluysa carousel, boşsa davetkâr kart */}
          {lists.length > 0 ? (
            <WebCarousel
              title={t('myLists', 'Listelerim')}
              data={lists}
              renderItem={renderListItem}
              onViewAll={() => openViewAll(t('myLists', 'Listelerim'), lists, 'lists')}
            />
          ) : (
            <View style={styles.listsSection}>
              <Text style={styles.carouselTitle}>{t('myLists', 'Listelerim')}</Text>
              {isListsLoading ? (
                <ListCardSkeleton />
              ) : (
                <View style={styles.listsEmptyWrap}>
                  <ListsEmptyCard onPress={() => router.push('/(protected)/(tabs)/explore')} />
                </View>
              )}
            </View>
          )}

          {renderCarousel(t('shows'), shows, 'shows', renderShowItem)}
          {renderCarousel(t('favShows'), favShowsList, 'shows', renderShowItem)}
          {renderCarousel(t('movies'), movies, 'movies', renderMovieItem)}
          {renderCarousel(t('favMovies'), favMoviesList, 'movies', renderMovieItem)}
        </View>
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
  carouselsContainer: {
    gap: 16,
  },
  carouselTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingLeft: 4,
  },
  listsSection: {
    marginBottom: 8,
  },
  listsEmptyWrap: {
    maxWidth: 560,
  },
});
