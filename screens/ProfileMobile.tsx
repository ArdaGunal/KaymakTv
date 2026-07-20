import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar, TouchableOpacity, Dimensions } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, Settings, List as ListIcon } from 'lucide-react-native';
import HorizontalShowList from '../components/HorizontalShowList';
import { useAuth } from '../context/AuthContext';
import { useLibrarySelector } from '../context/LibraryContext';
import { useRouter } from 'expo-router';
import SkeletonLoader from '../components/SkeletonLoader';
import ListCard from '../components/profile/ListCard';
import ListCardSkeleton from '../components/profile/ListCardSkeleton';
import ListsEmptyCard from '../components/profile/ListsEmptyCard';
import { useProfileLists } from '../hooks/useProfileLists';
import { useTranslation } from 'react-i18next';
import LoginPaywall from '../components/LoginPaywall';

const { width } = Dimensions.get('window');
const SKELETON_W = width * 0.28;
const SKELETON_H = SKELETON_W * 1.5;

const mapMedia = (items: any[], type: 'show' | 'movie') =>
  items.map((item: any) => ({
    id: type === 'show' ? item.show?.ids?.trakt : item.movie?.ids?.trakt,
    title: type === 'show' ? item.show?.title : item.movie?.title,
    tmdbId: type === 'show' ? item.show?.ids?.tmdb : item.movie?.ids?.tmdb,
  }));

const sortRecent = (items: any[]) =>
  [...items].sort((a: any, b: any) => new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime());

// Bölüm iskeleti: yalnızca o bölümün verisi henüz yokken gösterilir.
const SectionSkeleton = () => (
  <View style={{ marginBottom: 24, marginLeft: 16 }}>
    <SkeletonLoader width={120} height={24} style={{ marginBottom: 12 }} />
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <SkeletonLoader width={SKELETON_W} height={SKELETON_H} borderRadius={8} />
      <SkeletonLoader width={SKELETON_W} height={SKELETON_H} borderRadius={8} />
      <SkeletonLoader width={SKELETON_W} height={SKELETON_H} borderRadius={8} />
    </View>
  </View>
);

export default function ProfileScreen() {
  const { accessToken, isGuest } = useAuth();
  const router = useRouter();
  const { t } = useTranslation('media');
  const insets = useSafeAreaInsets();

  // Katı seçici: yalnızca profilin ihtiyacı olan dilimler.
  const { watchedShows, watchedMovies, customLists, favShows, favMovies, isLibraryLoading, isMoviesLoading } = useLibrarySelector(s => ({
    watchedShows: s.watchedShows,
    watchedMovies: s.watchedMovies,
    customLists: s.customLists,
    favShows: s.favShows,
    favMovies: s.favMovies,
    isLibraryLoading: s.isLoading,
    isMoviesLoading: s.isMoviesLoading,
  }));

  const { lists, isLoading: isListsLoading } = useProfileLists(customLists, isLibraryLoading);

  // Kopya state yok: her bölüm doğrudan store'dan memoize türetilir,
  // veri dilimi geldiği AN ekranda belirir (kademeli yükleme).
  const shows = useMemo(() => mapMedia(sortRecent(watchedShows || []).slice(0, 100), 'show'), [watchedShows]);
  const movies = useMemo(() => mapMedia(sortRecent(watchedMovies || []).slice(0, 100), 'movie'), [watchedMovies]);
  const favShowsList = useMemo(() => mapMedia((favShows || []).slice(0, 100), 'show'), [favShows]);
  const favMoviesList = useMemo(() => mapMedia((favMovies || []).slice(0, 100), 'movie'), [favMovies]);

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

      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}>
        <View style={styles.headerSpacer} />

        {/* Listelerim — her zaman görünür bölüm: doluysa kartlar, boşsa davetkâr
            bilgilendirici kart, veri gelmemişse iskelet. */}
        <View style={styles.listsSectionHeader}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <ListIcon size={18} color="#e2e8f0" style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitleInline}>{t('myLists', 'Listelerim')}</Text>
              {lists.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{lists.length}</Text>
                </View>
              )}
            </View>
            {lists.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/(protected)/library/lists')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.seeAllText}>{t('seeAll', 'Tümü')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {lists.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.listsScrollContent}
            >
              {lists.map((item) => (
                <ListCard key={String(item.id)} data={item} />
              ))}
            </ScrollView>
          ) : isListsLoading ? (
            <ListCardSkeleton />
          ) : (
            <View style={{ paddingHorizontal: 16 }}>
              <ListsEmptyCard onPress={() => router.push('/(protected)/(tabs)/explore')} />
            </View>
          )}
        </View>

        {/* Diziler — Tier 1 verisi, ilk gelen bölüm */}
        {shows.length > 0 ? (
          <HorizontalShowList
            title={t('shows')}
            data={shows}
            onShowAll={() => router.push('/(protected)/library/shows')}
          />
        ) : isLibraryLoading ? (
          <SectionSkeleton />
        ) : null}

        {favShowsList.length > 0 && (
          <HorizontalShowList
            title={t('favShows')}
            titleIcon={<Heart size={20} color="#ef4444" fill="#ef4444" />}
            data={favShowsList}
            onShowAll={() => router.push('/(protected)/library/favShows')}
          />
        )}

        {/* Filmler — Tier 2/3 verisi, kendi iskeletiyle gelir */}
        {movies.length > 0 ? (
          <HorizontalShowList
            title={t('movies')}
            data={movies}
            onShowAll={() => router.push('/(protected)/library/movies')}
            type="movie"
          />
        ) : isMoviesLoading ? (
          <SectionSkeleton />
        ) : null}

        {favMoviesList.length > 0 ? (
          <HorizontalShowList
            title={t('favMovies')}
            titleIcon={<Heart size={20} color="#ef4444" fill="#ef4444" />}
            data={favMoviesList}
            onShowAll={() => router.push('/(protected)/library/favMovies')}
            type="movie"
          />
        ) : !isLibraryLoading && !isMoviesLoading ? (
          <View style={styles.emptyFavContainer}>
            <View style={styles.emptyFavHeader}>
              <Heart size={20} color="#ef4444" fill="#ef4444" style={{marginRight: 8}} />
              <Text style={styles.emptyFavTitle}>{t('favMovies')}</Text>
            </View>
            <TouchableOpacity
              style={styles.emptyFavCard}
              activeOpacity={0.7}
              onPress={() => router.push('/(protected)/(tabs)/explore')}
            >
              <Text style={styles.plusIcon}>+</Text>
              <Text style={styles.emptyFavText}>{t('addFavMovies')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
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
  emptyFavContainer: { paddingHorizontal: 16, marginBottom: 24 },
  emptyFavHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  emptyFavTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  emptyFavCard: { height: 120, backgroundColor: '#172033', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2A364F', borderStyle: 'dashed' },
  plusIcon: { color: '#ffffff', fontSize: 32, fontWeight: '300', marginBottom: 4 },
  emptyFavText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  // Lists section
  listsSectionHeader: { marginBottom: 24 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitleInline: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  countBadge: {
    marginLeft: 8,
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: { color: '#cbd5e1', fontSize: 12, fontWeight: '700' },
  seeAllText: { color: '#3b82f6', fontSize: 13, fontWeight: '600' },
  listsScrollContent: { paddingHorizontal: 16, paddingBottom: 8 },
});
