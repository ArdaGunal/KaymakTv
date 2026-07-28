import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../../context/AuthContext';
import { useLibrarySelector } from '../../../context/LibraryContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { useProfileLists } from '../../../hooks/useProfileLists';
import { useMyTraktProfile } from '../../../hooks/useMyTraktProfile';
import ProfileMobile from '../../../screens/ProfileMobile';
import WebCarousel from '../../../components/web/WebCarousel';
import EpisodeCard from '../../../components/EpisodeCard';
import MovieCard from '../../../components/movies/MovieCard';
import ListCard from '../../../components/profile/ListCard';
import ListCardSkeleton from '../../../components/profile/ListCardSkeleton';
import ListsEmptyCard from '../../../components/profile/ListsEmptyCard';
import LoginPaywall from '../../../components/LoginPaywall';
import ProfileStats from '../../../components/profile/ProfileStats';
import ProfileHeader from '../../../components/profile/ProfileHeader';
import ProfileHeaderSkeleton from '../../../components/profile/ProfileHeaderSkeleton';
import ProfileTabs, { ProfileTabKey } from '../../../components/profile/ProfileTabs';
import ProfileActivityTab from '../../../components/profile/ProfileActivityTab';
import { DESKTOP_CARD_WIDTH, DESKTOP_CARD_HEIGHT, DESKTOP_CARD_GAP } from '../../../components/profile/profileMetrics';

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
  const { profile, followersCount, followingCount, isLoading: isProfileLoading } = useMyTraktProfile();
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('summary');

  const shows = useMemo(() => mapMedia(sortRecent(watchedShows || []).slice(0, 100), 'show'), [watchedShows]);
  const movies = useMemo(() => mapMedia(sortRecent(watchedMovies || []).slice(0, 100), 'movie'), [watchedMovies]);
  const favShowsList = useMemo(() => mapMedia((favShows || []).slice(0, 100), 'show'), [favShows]);
  const favMoviesList = useMemo(() => mapMedia((favMovies || []).slice(0, 100), 'movie'), [favMovies]);

  const renderShowItem = useCallback(({ item }: { item: any }) => <EpisodeCard data={item} />, []);
  const renderMovieItem = useCallback(({ item }: { item: any }) => <MovieCard data={item} />, []);
  // ESKİ HATA (bulundu ve düzeltildi): `ListCard` varsayılan olarak
  // `Dimensions.get('window').width`'in yüzdesi kadar genişlik alıyordu — bu
  // mobil ekran için doğruydu ama geniş bir masaüstü penceresinde (ör. 1440px)
  // kolayca 400px'i aşıyor, komşu Diziler/Filmler kartlarından (sabit 180px)
  // çok daha büyük görünüyordu. Burada masaüstüne özgü SABİT ölçüler geçiliyor.
  const renderListItem = useCallback(({ item }: { item: any }) => (
    <ListCard data={item} cardWidth={DESKTOP_CARD_WIDTH} cardHeight={DESKTOP_CARD_HEIGHT} gap={DESKTOP_CARD_GAP} />
  ), []);

  // Mobildeki `ProfileMobile.tsx` ile aynı hedef: `/library/{type}` — kişisel
  // kütüphanenin tamamını, gerçek arama + kategori filtresiyle gösteren ekran.
  const openViewAll = useCallback((routeType: string) => {
    router.push(`/(protected)/library/${routeType}` as any);
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
        onViewAll={() => openViewAll(routeType)}
      />
    );
  };

  return (
    <View style={styles.pageBackground}>
      {/* ScrollView'ın dışında, sabit (scroll ile kaymayan) köşe ikonu —
          eskiden ayrı bir satır olarak 32px'lik boş bir marj bırakıyordu. */}
      <TouchableOpacity
        style={[styles.settingsButton, { top: insets.top + 16 }]}
        onPress={() => router.push('/(protected)/account')}
      >
        <Settings size={24} color="#ffffff" />
      </TouchableOpacity>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {isProfileLoading || !profile ? (
          <ProfileHeaderSkeleton />
        ) : (
          <ProfileHeader profile={profile} followersCount={followersCount} followingCount={followingCount} />
        )}

        <View style={styles.tabsWrap}>
          <ProfileTabs activeTab={activeTab} onChange={setActiveTab} />
        </View>

        {activeTab === 'activity' ? (
          <ProfileActivityTab traktSlug={profile?.ids?.slug ?? null} />
        ) : (
          <>
            <ProfileStats />

            <View style={styles.carouselsContainer}>
              {/* Listelerim — her zaman görünür: doluysa carousel, boşsa davetkâr kart */}
              {lists.length > 0 ? (
                <WebCarousel
                  title={t('myLists', 'Listelerim')}
                  data={lists}
                  renderItem={renderListItem}
                  onViewAll={() => openViewAll('lists')}
                />
              ) : (
                <View style={styles.listsSection}>
                  <Text style={styles.carouselTitle}>{t('myLists', 'Listelerim')}</Text>
                  {isListsLoading ? (
                    <ListCardSkeleton cardWidth={DESKTOP_CARD_WIDTH} cardHeight={DESKTOP_CARD_HEIGHT} gap={DESKTOP_CARD_GAP} />
                  ) : (
                    <View style={styles.listsEmptyWrap}>
                      <ListsEmptyCard onPress={() => router.push('/(protected)/(tabs)/explore')} />
                    </View>
                  )}
                </View>
              )}

              {renderCarousel(t('shows'), shows, 'shows', renderShowItem)}
              {/* DÜZELTİLDİ: bu ikisi eskiden 'shows'/'movies' gönderiyordu (favori
                  değil, tüm izlenenler tipi) — eski `view-all` ekranı `type`'ı yalnızca
                  kart görünümü seçmek için kullandığı için zararsızdı (favShows da
                  EpisodeCard ile render olur), ama artık `type` `/library/{type}`'ın
                  HANGİ VERİYİ ÇEKECEĞİNİ belirlediği için yanlış tip "Tümünü Gör"ü
                  favoriler yerine tüm kütüphaneye götürürdü. */}
              {renderCarousel(t('favShows'), favShowsList, 'favShows', renderShowItem)}
              {renderCarousel(t('movies'), movies, 'movies', renderMovieItem)}
              {renderCarousel(t('favMovies'), favMoviesList, 'favMovies', renderMovieItem)}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageBackground: {
    flex: 1,
    backgroundColor: '#0B1120',
    position: 'relative',
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
  settingsButton: {
    position: 'absolute',
    right: 24,
    zIndex: 1,
    padding: 8,
    backgroundColor: '#1f2937',
    borderRadius: 20,
    ...( { cursor: 'pointer', transition: 'all 0.2s ease' } as any)
  },
  tabsWrap: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  carouselsContainer: {
    gap: 16,
  },
  // Bu başlık, "Listelerim" boş durumundayken WebCarousel render EDİLMEDİĞİ
  // için (carousel `data.length === 0` olunca null döner) elle çizilir.
  // Font boyutu WebCarousel'in kendi `categoryTitle` stiliyle (24px) BİREBİR
  // eşleşecek şekilde ayarlandı — eskiden 20px'ti, dolu/boş durumlar arasında
  // geçişte başlık boyutu görünür şekilde zıplıyordu.
  carouselTitle: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  listsSection: {
    marginBottom: 8,
  },
  listsEmptyWrap: {
    maxWidth: 560,
  },
});
