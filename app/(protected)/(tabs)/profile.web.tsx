import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Settings } from '../../../components/icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../../context/AuthContext';
import { useLibrarySelector } from '../../../context/LibraryContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { useProfileLists } from '../../../hooks/useProfileLists';
import { useKaymakYetenekleri } from '../../../hooks/useKaymakYetenekleri';
import { useMyTraktProfile } from '../../../hooks/useMyTraktProfile';
import DesktopProfileHeader, { DesktopProfileHeaderSkeleton } from '../../../components/profile/DesktopProfileHeader';
import ProfileMobile from '../../../screens/ProfileMobile';
import ScreenHeader from '../../../components/ScreenHeader';
import WebCarousel from '../../../components/web/WebCarousel';
import EpisodeCard from '../../../components/EpisodeCard';
import MovieCard from '../../../components/movies/MovieCard';
import ListCard from '../../../components/profile/ListCard';
import ListCardSkeleton from '../../../components/profile/ListCardSkeleton';
import ListsEmptyCard from '../../../components/profile/ListsEmptyCard';
import LoginPaywall from '../../../components/LoginPaywall';
import ProfileStats from '../../../components/profile/ProfileStats';
import ProfileTabs, { ProfileTabKey } from '../../../components/profile/ProfileTabs';
import ProfileActivityTab from '../../../components/profile/ProfileActivityTab';
import { NotificationBadge } from '../../../features/notifications/components/NotificationBadge';
import { DESKTOP_CARD_WIDTH, DESKTOP_CARD_HEIGHT, DESKTOP_CARD_GAP } from '../../../components/profile/profileMetrics';
import { gorunenBaslik } from '../../../utils/gorunenBaslik';
import { MOBILE_PALETTE, nativeColor } from '../../../constants/mobilePalette';

const mapMedia = (items: any[], type: 'show' | 'movie', dil: string) =>
  items.map((item: any) => ({
    id: type === 'show' ? item.show?.ids?.trakt : item.movie?.ids?.trakt,
    rawTraktId: type === 'show' ? item.show?.ids?.trakt : item.movie?.ids?.trakt,
    title: gorunenBaslik(type === 'show' ? item.show : item.movie, dil),
    showName: type === 'show' ? gorunenBaslik(item.show, dil) : undefined,
    tmdbId: type === 'show' ? item.show?.ids?.tmdb : item.movie?.ids?.tmdb,
  }));

const sortRecent = (items: any[]) =>
  [...items].sort((a: any, b: any) => new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime());


export default function ProfileScreenWeb() {
  const { isDesktop } = useResponsive();
  const { accessToken, isGuest } = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation('media');
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
  const { ozelListeler } = useKaymakYetenekleri();
  const { profile, followersCount, followingCount, isLoading: isProfileLoading, kaymakNo, tazeleGerekirse } = useMyTraktProfile();
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('summary');

  // Profili Düzenle ekranından dönüldüğünde güncel veriyi çeker — mobil
  // genişlikte bu dosya zaten `<ProfileMobile />`e devrediyor (o da kendi
  // aynı `useFocusEffect`'ine sahip), bu yalnızca masaüstü dalı için gerekli.
  useFocusEffect(
    useCallback(() => {
      // M544: bayatsa (30 sn) — açılışta bağlanma turuyla üst üste ikinci tur atılmaz.
      void tazeleGerekirse();
    }, [tazeleGerekirse])
  );

  const shows = useMemo(() => mapMedia(sortRecent(watchedShows || []).slice(0, 100), 'show', i18n.language), [watchedShows, i18n.language]);
  const movies = useMemo(() => mapMedia(sortRecent(watchedMovies || []).slice(0, 100), 'movie', i18n.language), [watchedMovies, i18n.language]);
  const favShowsList = useMemo(() => mapMedia((favShows || []).slice(0, 100), 'show', i18n.language), [favShows, i18n.language]);
  const favMoviesList = useMemo(() => mapMedia((favMovies || []).slice(0, 100), 'movie', i18n.language), [favMovies, i18n.language]);

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

  // ── Mobil: ProfileMobile'a yönlendir ─────────────────────────────────────
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
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Akış ve Keşfet'le AYNI başlık satırı (2026-09-17). */}
        <ScreenHeader title={t('profileTitle', 'Profil')} style={styles.pageHeader} />

        {/* ── Desktop Header: Avatar + Kimlik + İstatistik + Ayarlar ───────── */}
        <View style={styles.desktopTopBar}>
          {isProfileLoading || !profile ? (
            <DesktopProfileHeaderSkeleton />
          ) : (
            <DesktopProfileHeader
              profile={profile}
              followersCount={followersCount}
              followingCount={followingCount}
              kaymakNo={kaymakNo}
            />
          )}

          {/* Ayarlar ve Bildirim butonları yan yana */}
          <View style={{ flexDirection: 'row', gap: 12, marginLeft: 16 }}>
            <NotificationBadge />
            <TouchableOpacity
              style={[styles.settingsButton, { marginLeft: 0 }]}
              onPress={() => router.push('/(protected)/account')}
              activeOpacity={0.8}
            >
              <Settings size={20} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Sekmeler: sol kenarla hizalı (avatarın başladığı çizgi) ───────── */}
        <View style={styles.tabsWrap}>
          <ProfileTabs activeTab={activeTab} onChange={setActiveTab} />
        </View>

        {/* ── İzleme İstatistikleri (Mikro-Şerit) — max-width sınırlı ─────── */}
        <View style={styles.statsStrip}>
          <ProfileStats />
        </View>

        {activeTab === 'activity' ? (
          <ProfileActivityTab />
        ) : (
          <>
            <View style={styles.carouselsContainer}>
              {/* Listelerim — ⚠️ "her zaman" Kaymak hesabını KAPSAMAZ; orada özel
                  liste altyapısı yok ve boş durum kartı kullanıcıyı çalışmayan bir
                  akışa davet ederdi (bkz. useKaymakYetenekleri). ProfileMobile ile
                  AYNI karar — iki yüzeyden birini atlamak, aynı hesabın telefonda
                  görmediği bölümü web'de görmesi demek olurdu. */}
              {ozelListeler && (
              lists.length > 0 ? (
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
              ))}

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

// ─── Page-level Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  pageBackground: {
    flex: 1,
    backgroundColor: nativeColor('background', '#0B1120'),
  },
  safeArea: {
    flex: 1,
    backgroundColor: nativeColor('background', '#0B1120'),
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 1200,
    marginHorizontal: 'auto' as any,
    paddingHorizontal: 24,
  },
  pageHeader: {
    marginBottom: 12,
  },
  // ── Üst Bar: Desktop header + Ayarlar butonu yan yana ──────────────────────
  desktopTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: MOBILE_PALETTE.border,
  },
  settingsButton: {
    marginLeft: 16,
    flexShrink: 0,
    padding: 9,
    backgroundColor: MOBILE_PALETTE.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MOBILE_PALETTE.border,
    ...({ cursor: 'pointer', transition: 'background-color 0.2s ease' } as any),
  },
  // ── Sekmeler: profil içeriğiyle aynı sol hizasında (avatarın çizgisi) ──────
  tabsWrap: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    marginBottom: 4,
  },
  // ── İzleme İstatistikleri Şeridi: max-width sınırlı ────────────────────────
  // ProfileStats (ProfileStatsMobile) bileşeni kendi `marginHorizontal`'ını
  // SECTION_PADDING_H'e göre içsel olarak yönetiyor. Desktop'ta bu wrapper
  // bileşenin genişliğini kısıtlar — 2000px'e devasa yayılması engellenir.
  statsStrip: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    marginBottom: 4,
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
    color: MOBILE_PALETTE.text,
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
