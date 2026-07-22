import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar, TouchableOpacity } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, Settings, List as ListIcon, Tv, Film, Plus } from 'lucide-react-native';
import HorizontalShowList from '../components/HorizontalShowList';
import { useAuth } from '../context/AuthContext';
import { useLibrarySelector } from '../context/LibraryContext';
import { useRouter } from 'expo-router';
import SkeletonLoader from '../components/SkeletonLoader';
import ListCard from '../components/profile/ListCard';
import ProfileStats from '../components/profile/ProfileStats';
import ListCardSkeleton from '../components/profile/ListCardSkeleton';
import ListsEmptyCard from '../components/profile/ListsEmptyCard';
import SectionHeader from '../components/profile/SectionHeader';
import {
  POSTER_CARD_WIDTH,
  POSTER_CARD_HEIGHT,
  CARD_GAP,
  SECTION_PADDING_H,
  SECTION_SPACING,
} from '../components/profile/profileMetrics';
import { useProfileLists } from '../hooks/useProfileLists';
import { useTranslation } from 'react-i18next';
import LoginPaywall from '../components/LoginPaywall';

const mapMedia = (items: any[], type: 'show' | 'movie') =>
  items.map((item: any) => ({
    id: type === 'show' ? item.show?.ids?.trakt : item.movie?.ids?.trakt,
    title: type === 'show' ? item.show?.title : item.movie?.title,
    tmdbId: type === 'show' ? item.show?.ids?.tmdb : item.movie?.ids?.tmdb,
  }));

const sortRecent = (items: any[]) =>
  [...items].sort((a: any, b: any) => new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime());

// Bölüm iskeleti: yalnızca o bölümün verisi henüz yokken gösterilir.
// Ölçüler gerçek şeritlerle aynı kaynaktan gelir → veri gelince layout kaymaz.
const SectionSkeleton = () => (
  <View style={{ marginBottom: SECTION_SPACING, marginLeft: SECTION_PADDING_H }}>
    <SkeletonLoader width={120} height={20} borderRadius={6} style={{ marginBottom: 12 }} />
    <View style={{ flexDirection: 'row', gap: CARD_GAP }}>
      <SkeletonLoader width={POSTER_CARD_WIDTH} height={POSTER_CARD_HEIGHT} borderRadius={8} />
      <SkeletonLoader width={POSTER_CARD_WIDTH} height={POSTER_CARD_HEIGHT} borderRadius={8} />
      <SkeletonLoader width={POSTER_CARD_WIDTH} height={POSTER_CARD_HEIGHT} borderRadius={8} />
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

  const seeAllLabel = t('seeAll', 'Tümü');

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
        <Text style={styles.headerTitle}>{t('profileTitle', 'Profil')}</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/(protected)/account')}>
          <Settings size={22} color="#cbd5e1" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}>
        <ProfileStats />

        {/* Listelerim — her zaman görünür bölüm: doluysa kartlar, boşsa davetkâr
            bilgilendirici kart, veri gelmemişse iskelet. */}
        <View style={styles.listsSection}>
          <SectionHeader
            title={t('myLists', 'Listelerim')}
            icon={<ListIcon size={14} color="#60a5fa" />}
            iconTint="#60a5fa"
            count={lists.length}
            seeAllLabel={seeAllLabel}
            onSeeAll={lists.length > 0 ? () => router.push('/(protected)/library/lists') : undefined}
          />

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
            <View style={styles.sectionInset}>
              <ListsEmptyCard onPress={() => router.push('/(protected)/(tabs)/explore')} />
            </View>
          )}
        </View>

        {/* Diziler — Tier 1 verisi, ilk gelen bölüm */}
        {shows.length > 0 ? (
          <HorizontalShowList
            title={t('shows')}
            titleIcon={<Tv size={14} color="#60a5fa" />}
            titleTint="#60a5fa"
            data={shows}
            seeAllLabel={seeAllLabel}
            onShowAll={() => router.push('/(protected)/library/shows')}
          />
        ) : isLibraryLoading ? (
          <SectionSkeleton />
        ) : null}

        {favShowsList.length > 0 && (
          <HorizontalShowList
            title={t('favShows')}
            titleIcon={<Heart size={13} color="#f87171" fill="#f87171" />}
            titleTint="#f87171"
            data={favShowsList}
            seeAllLabel={seeAllLabel}
            onShowAll={() => router.push('/(protected)/library/favShows')}
          />
        )}

        {/* Filmler — Tier 2/3 verisi, kendi iskeletiyle gelir */}
        {movies.length > 0 ? (
          <HorizontalShowList
            title={t('movies')}
            titleIcon={<Film size={14} color="#60a5fa" />}
            titleTint="#60a5fa"
            data={movies}
            seeAllLabel={seeAllLabel}
            onShowAll={() => router.push('/(protected)/library/movies')}
            type="movie"
          />
        ) : isMoviesLoading ? (
          <SectionSkeleton />
        ) : null}

        {favMoviesList.length > 0 ? (
          <HorizontalShowList
            title={t('favMovies')}
            titleIcon={<Heart size={13} color="#f87171" fill="#f87171" />}
            titleTint="#f87171"
            data={favMoviesList}
            seeAllLabel={seeAllLabel}
            onShowAll={() => router.push('/(protected)/library/favMovies')}
            type="movie"
          />
        ) : !isLibraryLoading && !isMoviesLoading ? (
          <View style={styles.emptyFavSection}>
            <SectionHeader
              title={t('favMovies')}
              icon={<Heart size={13} color="#f87171" fill="#f87171" />}
              iconTint="#f87171"
              seeAllLabel={seeAllLabel}
            />
            <View style={styles.sectionInset}>
              <TouchableOpacity
                style={styles.emptyFavCard}
                activeOpacity={0.75}
                onPress={() => router.push('/(protected)/(tabs)/explore')}
              >
                <View style={styles.emptyFavPlusChip}>
                  <Plus size={18} color="#93c5fd" />
                </View>
                <Text style={styles.emptyFavText}>{t('addFavMovies')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B1120' },
  container: { flex: 1 },
  // Başlık şeridi de içerikle AYNI ızgaraya (16px) hizalandı — eskiden 20px'ti
  // ve altındaki kartlarla hizasız duruyordu.
  topHeader: {
    paddingHorizontal: SECTION_PADDING_H,
    paddingTop: 8,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.6,
  },
  settingsButton: {
    padding: 9,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  content: { paddingBottom: 40 },
  sectionInset: { paddingHorizontal: SECTION_PADDING_H },
  listsSection: { marginBottom: SECTION_SPACING },
  listsScrollContent: { paddingHorizontal: SECTION_PADDING_H, paddingBottom: 4 },
  emptyFavSection: { marginBottom: SECTION_SPACING },
  emptyFavCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 88,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.18)',
    borderStyle: 'dashed',
  },
  emptyFavPlusChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(59,130,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFavText: { color: '#94a3b8', fontSize: 12.5, fontWeight: '600', letterSpacing: 0.3 },
});
