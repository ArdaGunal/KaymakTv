import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, StatusBar, TouchableOpacity, useWindowDimensions, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppBack } from '../hooks/useAppBack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Rss, WifiOff } from '../components/icons';
import { useTranslation } from 'react-i18next';

import ProfileHeader from '../components/profile/ProfileHeader';
import ProfileHeaderSkeleton from '../components/profile/ProfileHeaderSkeleton';
import FeedCard from '../features/feed/components/FeedCard';
import MarathonFeedCard from '../features/feed/components/MarathonFeedCard';
import FeedSkeleton from '../features/feed/components/FeedSkeleton';
import BlockUserButton from '../features/feed/components/BlockUserButton';
import BlockedProfileLock from '../features/feed/components/BlockedProfileLock';
import PrivateProfileLock from '../features/publicProfile/components/PrivateProfileLock';
import ReportContentModal from '../features/feed/components/ReportContentModal';
import { usePublicProfileIdentity } from '../features/publicProfile/hooks/usePublicProfileIdentity';
import { usePublicProfileActivity } from '../features/publicProfile/hooks/usePublicProfileActivity';
import { usePublicProfileLibrary } from '../features/publicProfile/hooks/usePublicProfileLibrary';
import { useFollowState } from '../hooks/useFollowState';
import { useBlockState } from '../features/feed/hooks/useBlockState';
import { useAuth } from '../context/AuthContext';
import { isMarathonActivity } from '../features/feed/types';
import MediaPoster from '../components/MediaPoster';
import { generateMediaSlug } from '../utils/slugHelper';

// Başkasının aktivitesi asla silinemez — bu ekran bilinçli olarak
// usePublicProfileActivity (salt okuma) kullanıyor, useUserActivity (silme
// yetkili) DEĞİL. Bkz. features/publicProfile/hooks/usePublicProfileActivity.ts.
//
// app/(protected)/user/[slug].tsx (native) VE [slug].web.tsx'in dar ekran
// (mobil genişlikte web tarayıcı) dalı BURAYI kullanıyor — screens/ProfileMobile.tsx
// ile aynı desen (bkz. app/(protected)/(tabs)/profile.web.tsx'in `!isDesktop`
// dalı). `useLocalSearchParams` route dosyası olmayan bir bileşenden
// çağrılsa da sorunsuz çalışır — expo-router context'i ağaçta her yerden erişilir.
export default function PublicProfileMobile() {
  const { slug: rawSlug } = useLocalSearchParams();
  const slug = (Array.isArray(rawSlug) ? rawSlug[0] : rawSlug) ?? null;
  const router = useRouter();
  const handleBack = useAppBack();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['feed', 'media', 'common']);

  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<'activity' | 'shows' | 'movies'>('activity');
  // T4 · `043` — açıklama raporu. Yalnızca BİZİM açıklamamız, başkasının profilinde.
  const [bioRaporAcik, setBioRaporAcik] = useState(false);

  // 🪪 KİMLİK BİZDEN, ZENGİNLEŞTİRME TRAKT'TAN — gerekçe `usePublicProfileIdentity`
  // başlığında (M338). 🔴 `useFollowState`'e `kaymakProfil.userId` DIŞINDA
  // hiçbir şey verilmez: iki parametre de `string | null`, TİP SİSTEMİ yanlış
  // kimliği YAKALAMAZ (M337).
  const {
    kaymakProfil,
    profile,
    followersCount,
    followingCount,
    traktSlug,
    bioBizden,
    gizliKilitli,
    isLoading: isProfileLoading,
    error,
  } = usePublicProfileIdentity(slug);

  const { connectionState, isLoadingConnection, isFollowPending, toggleFollow } = useFollowState(
    kaymakProfil?.profile.userId ?? null,
    kaymakProfil?.profile.username ?? null,
  );
  // 🪪 Aktivite ve engelleme `users.id` ile (M339 · `BACKLOG` §F6) — Google-only
  // kullanıcıda da çalışır. ⚠️ Diziler/Filmler sekmesi hâlâ TRAKT kütüphanesi:
  // yalnızca GERÇEK `traktSlug` ile okunur, Google-only'de boş kalır
  // (başkasının izleme geçmişini bizden okumak gizlilik kuralları ister → T6).
  const hedefUserId = kaymakProfil?.profile.userId ?? null;
  // 🔒 §C29 (M409): gizli + takipçi değilse kütüphane/aktivite için HİÇ istek
  // atılmaz (Trakt'ın açık API'si bizim gizliliği bilmiyor).
  const { data: activityData, isLoading: isActivityLoading, hasError: isActivityError, refresh: refreshActivity } = usePublicProfileActivity(gizliKilitli ? null : hedefUserId);
  const { shows, movies, isLoadingShows, isLoadingMovies } = usePublicProfileLibrary(gizliKilitli ? null : traktSlug);

  // Engelleme (bkz. docs/design/FEED_SOCIAL_PLAN.md §4) — KaymakTV'ye özel.
  // `isBlockedEitherWay` true ise sekmeler yerine kilit ekranı gösterilir.
  const { accessToken, isGuest } = useAuth();
  const { isBlockedEitherWay } = useBlockState(hedefUserId);
  // Kendi profilimde düğme YOK — `kendisi` sunucudan geliyor (eskiden iki slug
  // karşılaştırılıyordu; Google-only'de ikisi de yoktu, düğme hiç çıkmıyordu).
  const canShowBlockButton = !!accessToken && !isGuest && !!kaymakProfil && !kaymakProfil.kendisi;

  const NUM_COLUMNS = 3;
  const SPACING = 8;
  const cardWidth = Math.round((width - SPACING * (NUM_COLUMNS + 1)) / NUM_COLUMNS);
  const cardHeight = Math.round(cardWidth * 1.5);

  const renderItem = ({ item }: { item: any }) => {
    if (activeTab === 'activity') {
      return (
        <View style={styles.itemWrap}>
          {isMarathonActivity(item) ? <MarathonFeedCard activity={item} /> : <FeedCard activity={item} />}
        </View>
      );
    }

    const type = activeTab === 'shows' ? 'show' : 'movie';
    const media = item[type];
    const tmdbId = media?.ids?.tmdb;
    const title = media?.title;

    return (
      <TouchableOpacity 
        style={[styles.gridCard, { width: cardWidth, height: cardHeight }]}
        activeOpacity={0.7}
        onPress={() => {
          if (media?.ids?.trakt) {
            const mediaSlug = generateMediaSlug(media.ids.trakt, media.ids.slug, media.title);
            router.push(`/${type}/${mediaSlug}?tmdbId=${tmdbId || ''}`);
          }
        }}
      >
        <MediaPoster
          tmdbId={tmdbId}
          type={type}
          title={title}
          style={styles.poster}
        />
      </TouchableOpacity>
    );
  };

  // Başlık iki dalda kullanılıyor: normal listenin `ListHeaderComponent`'i ve
  // gizli hesap kilidinin üstü (§C29, M409).
  const profilBasligi = profile ? (
    <ProfileHeader
      profile={profile}
      followersCount={followersCount}
      followingCount={followingCount}
      isOwnProfile={false}
      connectionState={connectionState}
      isFollowPending={isFollowPending}
      isLoadingConnection={isLoadingConnection}
      onPressAction={toggleFollow}
      onReportBio={canShowBlockButton && bioBizden ? () => setBioRaporAcik(true) : undefined}
      onPressFollowers={() => {
        router.push({ pathname: `/user/${profile.username}/network`, params: { type: 'followers' } });
      }}
      onPressFollowing={() => {
        router.push({ pathname: `/user/${profile.username}/network`, params: { type: 'following' } });
      }}
    />
  ) : null;

  return (
    <LinearGradient colors={['#0F172A', '#0B1120']} style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { paddingTop: insets.top || 20 }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.iconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft color="#fff" size={26} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {profile ? `@${profile.username}` : t('media:profile', 'Profil')}
        </Text>
        {canShowBlockButton ? (
          <BlockUserButton targetUserId={hedefUserId as string} />
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {isProfileLoading ? (
        <ProfileHeaderSkeleton />
      ) : error || !profile ? (
        <View style={styles.errorState}>
          <Text style={styles.errorText}>
            {error === 'not_found'
              ? t('feed:publicProfileNotFound', 'Bu kullanıcı bulunamadı.')
              : t('feed:publicProfileLoadError', 'Profil yüklenemedi. Lütfen tekrar deneyin.')}
          </Text>
        </View>
      ) : isBlockedEitherWay ? (
        <BlockedProfileLock />
      ) : gizliKilitli ? (
        // 🔒 §C29 (M409): kilit YALNIZ sekmelerin yerine — başlık (fotoğraf,
        // @ad, takipçi sayıları, istek düğmesi) görünür kalır. Kullanıcı:
        // *"kullanıcı adı, takipçi sayısı ve profil fotosu gösterilsin."*
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          {profilBasligi}
          <PrivateProfileLock />
        </ScrollView>
      ) : (
        <FlatList
          key={activeTab === 'activity' ? 'list-1' : `grid-${NUM_COLUMNS}`}
          data={activeTab === 'activity' ? activityData : activeTab === 'shows' ? shows : movies}
          keyExtractor={(item, index) => activeTab === 'activity' ? item.id : (item.show?.ids?.trakt || item.movie?.ids?.trakt || index.toString())}
          renderItem={renderItem}
          numColumns={activeTab === 'activity' ? 1 : NUM_COLUMNS}
          contentContainerStyle={[
            activeTab === 'activity' ? styles.listContent : styles.gridContent, 
            { paddingBottom: insets.bottom + 40 }
          ]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={activeTab === 'activity' ? 10 : 15}
          ListHeaderComponent={
            <View>
              {profilBasligi}
              <View style={styles.tabsContainer}>
                <TouchableOpacity style={[styles.tab, activeTab === 'activity' && styles.activeTab]} onPress={() => setActiveTab('activity')}>
                  <Text style={[styles.tabText, activeTab === 'activity' && styles.activeTabText]}>Aktiviteler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'shows' && styles.activeTab]} onPress={() => setActiveTab('shows')}>
                  <Text style={[styles.tabText, activeTab === 'shows' && styles.activeTabText]}>Diziler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'movies' && styles.activeTab]} onPress={() => setActiveTab('movies')}>
                  <Text style={[styles.tabText, activeTab === 'movies' && styles.activeTabText]}>Filmler</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          ListEmptyComponent={
            (activeTab === 'activity' && isActivityLoading) ||
            (activeTab === 'shows' && isLoadingShows) ||
            (activeTab === 'movies' && isLoadingMovies) ? (
              <View style={styles.skeletonWrap}>
                {activeTab === 'activity' ? <FeedSkeleton /> : <ActivityIndicator size="large" color="#3b82f6" style={{marginTop: 40}} />}
              </View>
            ) : activeTab === 'activity' && isActivityError ? (
              // "Veri yok" ile "yüklenemedi" AYRI durumlar (bkz. ProfileActivityTab.tsx'teki
              // AYNI ayrım, docs/AI_RULES.md § Sessiz başarısızlık YASAKTIR) — eskiden
              // gerçek bir ağ/veritabanı hatasında da bu kullanıcı hiçbir şey izlememiş
              // gibi "Henüz aktivite yok" gösteriliyordu.
              <View style={styles.emptyState}>
                <WifiOff size={36} color="#334155" />
                <Text style={styles.emptyTitle}>{t('feed:publicProfileActivityErrorTitle', 'Aktiviteler Yüklenemedi')}</Text>
                <Text style={styles.emptyText}>
                  {t('feed:publicProfileActivityErrorText', 'Bağlantını kontrol edip tekrar dene.')}
                </Text>
                <TouchableOpacity style={styles.retryButton} onPress={refreshActivity} activeOpacity={0.8}>
                  <Text style={styles.retryButtonText}>{t('common:retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Rss size={36} color="#334155" />
                <Text style={styles.emptyTitle}>
                  {activeTab === 'activity' ? t('feed:publicProfileEmptyTitle', 'Henüz aktivite yok') : t('feed:publicProfileEmptyTitle', 'Henüz içerik yok')}
                </Text>
                <Text style={styles.emptyText}>
                  {activeTab === 'activity'
                    ? t('feed:publicProfileEmptyText', 'Bu kullanıcı henüz bir şey izlemedi veya puanlamadı.')
                    : t('feed:publicProfileEmptyText', 'Bu listede henüz içerik bulunmuyor.')}
                </Text>
              </View>
            )
          }
        />
      )}
      {hedefUserId && (
        <ReportContentModal
          visible={bioRaporAcik}
          targetType="user_bio"
          targetId={hedefUserId}
          onClose={() => setBioRaporAcik(false)}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  iconBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: 12,
  },
  headerSpacer: {
    width: 40,
  },
  listContent: {
    paddingTop: 16,
  },
  itemWrap: {
    paddingHorizontal: 20,
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
  skeletonWrap: {
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Akış/Profil ekranlarındaki hata durumu retry butonuyla AYNI görsel dil.
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: '#22304A',
  },
  retryButtonText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#22304A',
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#f8fafc',
  },
  gridContent: {
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  gridCard: {
    margin: 4,
    backgroundColor: '#172033',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#22304A',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
});
