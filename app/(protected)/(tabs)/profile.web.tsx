import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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
import SkeletonLoader from '../../../components/SkeletonLoader';
import ProfileTabs, { ProfileTabKey } from '../../../components/profile/ProfileTabs';
import ProfileActivityTab from '../../../components/profile/ProfileActivityTab';
import { NotificationBadge } from '../../../features/notifications/components/NotificationBadge';
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

// ─── Desktop-only Header ─────────────────────────────────────────────────────
// ProfileHeader.tsx (mobil) ve ProfileHeaderSkeleton.tsx'e DOKUNULMUYOR.
// Desktop için ayrı bir header inline olarak burada çizilir.
function DesktopProfileHeader({
  profile,
  followersCount,
  followingCount,
}: {
  profile: any;
  followersCount: number;
  followingCount: number;
}) {
  const { t } = useTranslation('media');
  const router = useRouter();

  const avatarUrl = profile.images?.avatar?.full;
  const initial = profile.username.charAt(0).toUpperCase();

  return (
    <View style={desktopHeaderStyles.container}>
      {/* Avatar */}
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={desktopHeaderStyles.avatar} />
      ) : (
        <View style={desktopHeaderStyles.avatarFallback}>
          <Text style={desktopHeaderStyles.avatarText}>{initial}</Text>
        </View>
      )}

      {/* Orta Kolon: İsim + Handle */}
      <View style={desktopHeaderStyles.identityCol}>
        <Text style={desktopHeaderStyles.name} numberOfLines={1}>
          {profile.name || profile.username}
        </Text>
        <Text style={desktopHeaderStyles.handle} numberOfLines={1}>
          @{profile.username}
        </Text>
        {!!profile.about && (
          <Text style={desktopHeaderStyles.bio} numberOfLines={2}>
            {profile.about}
          </Text>
        )}
      </View>

      {/* Sağ Kolon: İstatistikler + Profili Düzenle Butonu */}
      <View style={desktopHeaderStyles.rightSection}>
        <View style={desktopHeaderStyles.statsRow}>
          <TouchableOpacity 
            style={desktopHeaderStyles.statItem} 
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: `/user/${profile.ids?.slug || profile.username}/network`, params: { type: 'followers' } })}
          >
            <Text style={desktopHeaderStyles.statValue}>{followersCount}</Text>
            <Text style={desktopHeaderStyles.statLabel}>{t('profileFollowers', 'Takipçi')}</Text>
          </TouchableOpacity>

          <View style={desktopHeaderStyles.statDivider} />

          <TouchableOpacity 
            style={desktopHeaderStyles.statItem} 
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: `/user/${profile.ids?.slug || profile.username}/network`, params: { type: 'following' } })}
          >
            <Text style={desktopHeaderStyles.statValue}>{followingCount}</Text>
            <Text style={desktopHeaderStyles.statLabel}>{t('profileFollowing', 'Takip Edilen')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={desktopHeaderStyles.editBtn}
          onPress={() => router.push('/(protected)/profile/edit')}
          activeOpacity={0.85}
        >
          <Text style={desktopHeaderStyles.editBtnText}>
            {t('editProfile', 'Profili Düzenle')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DesktopProfileHeaderSkeleton() {
  return (
    <View style={desktopHeaderStyles.container}>
      <SkeletonLoader width={80} height={80} borderRadius={40} />
      <View style={[desktopHeaderStyles.identityCol, { gap: 8 }]}>
        <SkeletonLoader width={160} height={18} borderRadius={5} />
        <SkeletonLoader width={100} height={13} borderRadius={4} />
      </View>
      <View style={desktopHeaderStyles.rightSection}>
        <View style={desktopHeaderStyles.statsRow}>
          <SkeletonLoader width={60} height={36} borderRadius={8} />
          <SkeletonLoader width={60} height={36} borderRadius={8} />
        </View>
        <SkeletonLoader width={140} height={36} borderRadius={10} />
      </View>
    </View>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

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
  const { profile, followersCount, followingCount, isLoading: isProfileLoading, refetch: refetchProfile } = useMyTraktProfile();
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('summary');

  // Profili Düzenle ekranından dönüldüğünde güncel veriyi çeker — mobil
  // genişlikte bu dosya zaten `<ProfileMobile />`e devrediyor (o da kendi
  // aynı `useFocusEffect`'ine sahip), bu yalnızca masaüstü dalı için gerekli.
  useFocusEffect(
    useCallback(() => {
      refetchProfile();
    }, [refetchProfile])
  );

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
        contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Desktop Header: Avatar + Kimlik + İstatistik + Ayarlar ───────── */}
        <View style={styles.desktopTopBar}>
          {isProfileLoading || !profile ? (
            <DesktopProfileHeaderSkeleton />
          ) : (
            <DesktopProfileHeader
              profile={profile}
              followersCount={followersCount}
              followingCount={followingCount}
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
          <ProfileActivityTab traktSlug={profile?.ids?.slug ?? null} />
        ) : (
          <>
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

// ─── Desktop Profile Header Styles (yalnızca bu dosyada kullanılır) ───────────
const desktopHeaderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    flex: 1,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.4)',
    flexShrink: 0,
  },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 30,
  },
  identityCol: {
    flexShrink: 1,
  },
  name: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  handle: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
  },
  bio: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  rightSection: {
    marginLeft: 'auto' as any,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    flexShrink: 0,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  statValue: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  editBtn: {
    height: 38,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    ...({ cursor: 'pointer', transition: 'background-color 0.2s ease' } as any),
  },
  editBtnText: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '700',
  },
});

// ─── Page-level Styles ────────────────────────────────────────────────────────
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
    flex: 1,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 1200,
    marginHorizontal: 'auto' as any,
    paddingHorizontal: 24,
  },
  // ── Üst Bar: Desktop header + Ayarlar butonu yan yana ──────────────────────
  desktopTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  settingsButton: {
    marginLeft: 16,
    flexShrink: 0,
    padding: 9,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
