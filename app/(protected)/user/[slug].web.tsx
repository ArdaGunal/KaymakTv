import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, useWindowDimensions } from 'react-native';
import Avatar from '../../../components/Avatar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppBack } from '../../../hooks/useAppBack';
import { ChevronLeft, Rss, Check, Clock, UserPlus, Lock, WifiOff } from '../../../components/icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useResponsive } from '../../../hooks/useResponsive';
import { useFollowState } from '../../../hooks/useFollowState';
import { usePublicProfileIdentity } from '../../../features/publicProfile/hooks/usePublicProfileIdentity';
import { usePublicProfileActivity } from '../../../features/publicProfile/hooks/usePublicProfileActivity';
import { usePublicProfileLibrary } from '../../../features/publicProfile/hooks/usePublicProfileLibrary';
import PublicProfileMobile from '../../../screens/PublicProfileMobile';
import FeedCard from '../../../features/feed/components/FeedCard';
import MarathonFeedCard from '../../../features/feed/components/MarathonFeedCard';
import FeedSkeleton from '../../../features/feed/components/FeedSkeleton';
import SkeletonLoader from '../../../components/SkeletonLoader';
import BlockUserButton from '../../../features/feed/components/BlockUserButton';
import BlockedProfileLock from '../../../features/feed/components/BlockedProfileLock';
import PrivateProfileLock from '../../../features/publicProfile/components/PrivateProfileLock';
import ReportContentModal from '../../../features/feed/components/ReportContentModal';
import { useBlockState } from '../../../features/feed/hooks/useBlockState';
import { useAuth } from '../../../context/AuthContext';
import { FeedItem, isMarathonActivity } from '../../../features/feed/types';
import MediaPoster from '../../../components/MediaPoster';
import { generateMediaSlug } from '../../../utils/slugHelper';
import { styles } from '../../../features/publicProfile/publicProfile.web.styles';

// Dar ekran (mobil genişlikte web tarayıcı): ProfileMobile ile aynı desen
// (bkz. profile.web.tsx'in `!isDesktop` dalı) — screens/PublicProfileMobile.tsx
// tekrar yazılmadı, doğrudan render edildi.
export default function PublicProfileScreenWeb() {
  const { isDesktop } = useResponsive();
  const { slug: rawSlug } = useLocalSearchParams();
  const slug = (Array.isArray(rawSlug) ? rawSlug[0] : rawSlug) ?? null;
  const router = useRouter();
  const handleBack = useAppBack();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['feed', 'media', 'common']);

  // 🪪 KİMLİK BİZDEN, ZENGİNLEŞTİRME TRAKT'TAN — gerekçe `usePublicProfileIdentity`
  // başlığında (M338). 🔴 `useFollowState`'e `kaymakProfil.userId` DIŞINDA
  // hiçbir şey verilmez: iki parametre de `string | null`, TİP SİSTEMİ yanlış
  // kimliği YAKALAMAZ (M337).
  // Dar ekran dalı (`PublicProfileMobile`) AYNI hook'u kullanıyor.
  const {
    kaymakProfil,
    profile,
    followersCount,
    followingCount,
    isPrivate,
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
  // 🔒 §C29 (M409): gizli + takipçi değilse kütüphane/aktivite için HİÇ istek atılmaz.
  const { data: activityData, isLoading: isActivityLoading, hasError: isActivityError, refresh: refreshActivity } = usePublicProfileActivity(gizliKilitli ? null : hedefUserId);
  const { shows, movies, isLoadingShows, isLoadingMovies } = usePublicProfileLibrary(gizliKilitli ? null : traktSlug);

  // Engelleme (bkz. docs/design/FEED_SOCIAL_PLAN.md §4) — KaymakTV'ye özel.
  // `isBlockedEitherWay` true ise sekmeler yerine kilit ekranı gösterilir.
  const { accessToken, isGuest } = useAuth();
  const { isBlockedEitherWay } = useBlockState(hedefUserId);
  // Kendi profilimde düğme YOK — `kendisi` sunucudan geliyor (eskiden iki slug
  // karşılaştırılıyordu; Google-only'de ikisi de yoktu, düğme hiç çıkmıyordu).
  const canShowBlockButton = !!accessToken && !isGuest && !!kaymakProfil && !kaymakProfil.kendisi;

  const [activeTab, setActiveTab] = useState<'activity' | 'shows' | 'movies'>('activity');
  // T4 · `043` — açıklama raporu. Yalnızca BİZİM açıklamamız, başkasının profilinde.
  const [bioRaporAcik, setBioRaporAcik] = useState(false);
  const { width } = useWindowDimensions();

  // Desktop için sabit grid boyutları
  const gridContainerWidth = Math.min(width - 48, 720); // paddingHorizontal 24*2 = 48
  const NUM_COLUMNS = 5;
  const SPACING = 12;
  const cardWidth = Math.round((gridContainerWidth - SPACING * (NUM_COLUMNS + 1)) / NUM_COLUMNS);
  const cardHeight = Math.round(cardWidth * 1.5);

  if (!isDesktop) {
    return <PublicProfileMobile />;
  }

  const isFollowBusy = isFollowPending || isLoadingConnection;

  return (
    <View style={styles.pageBackground}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.8}>
            <ChevronLeft size={18} color="#cbd5e1" />
            <Text style={styles.backButtonText}>{t('media:goBack', 'Geri Dön')}</Text>
          </TouchableOpacity>
          {canShowBlockButton && <BlockUserButton targetUserId={hedefUserId as string} />}
        </View>

        {isProfileLoading ? (
          <View style={styles.headerCard}>
            <SkeletonLoader width={88} height={88} borderRadius={44} />
            <View style={styles.skeletonIdentity}>
              <SkeletonLoader width={180} height={20} borderRadius={5} />
              <SkeletonLoader width={110} height={14} borderRadius={4} />
            </View>
          </View>
        ) : error || !profile ? (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>
              {error === 'not_found'
                ? t('feed:publicProfileNotFound', 'Bu kullanıcı bulunamadı.')
                : t('feed:publicProfileLoadError', 'Profil yüklenemedi. Lütfen tekrar deneyin.')}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.headerCard}>
              <Avatar url={profile.images?.avatar?.full} ad={profile.username} size={88} halka />

              <View style={styles.identityCol}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {profile.name || profile.username}
                  </Text>
                  {isPrivate && <Lock size={14} color="#94a3b8" />}
                </View>
                <Text style={styles.handle} numberOfLines={1}>
                  @{profile.username}
                </Text>

                {!!profile.about && (
                  <Text style={styles.bio} numberOfLines={3}>
                    {profile.about}
                  </Text>
                )}
                {!!profile.about && canShowBlockButton && bioBizden && (
                  <TouchableOpacity onPress={() => setBioRaporAcik(true)} style={styles.reportBio} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Text style={styles.reportBioText}>{t('feed:reportBio', 'Açıklamayı bildir')}</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.statsRow}>
                  <TouchableOpacity 
                    style={styles.statItem} 
                    activeOpacity={0.7}
                    onPress={() => router.push({ pathname: `/user/${profile.username}/network`, params: { type: 'followers' } })}
                  >
                    <Text style={styles.statValue}>{followersCount}</Text>
                    <Text style={styles.statLabel}>{t('media:profileFollowers', 'Takipçi')}</Text>
                  </TouchableOpacity>
                  <View style={styles.statDivider} />
                  <TouchableOpacity 
                    style={styles.statItem} 
                    activeOpacity={0.7}
                    onPress={() => router.push({ pathname: `/user/${profile.username}/network`, params: { type: 'following' } })}
                  >
                    <Text style={styles.statValue}>{followingCount}</Text>
                    <Text style={styles.statLabel}>{t('media:profileFollowing', 'Takip Edilen')}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.followBtn,
                  connectionState === 'following' && styles.followingBtn,
                  connectionState === 'pending' && styles.pendingBtn,
                ]}
                onPress={toggleFollow}
                disabled={isFollowBusy}
                activeOpacity={0.85}
              >
                {isFollowBusy ? (
                  <ActivityIndicator size="small" color={connectionState === 'none' ? '#fff' : '#94a3b8'} />
                ) : connectionState === 'following' ? (
                  <>
                    <Check size={14} color="#4ade80" />
                    <Text style={styles.followingBtnText}>{t('feed:following', 'Takip Ediliyor')}</Text>
                  </>
                ) : connectionState === 'pending' ? (
                  <>
                    <Clock size={14} color="#facc15" />
                    <Text style={styles.pendingBtnText}>{t('feed:pending', 'Onay Bekleniyor')}</Text>
                  </>
                ) : (
                  <>
                    <UserPlus size={14} color="#fff" />
                    <Text style={styles.followBtnText}>{t('feed:follow', 'Takip Et')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {isBlockedEitherWay ? (
              <BlockedProfileLock />
            ) : gizliKilitli ? (
              <PrivateProfileLock />
            ) : (
              <>
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

            {activeTab === 'activity' ? (
              <View style={styles.feedColumn}>
                {isActivityLoading ? (
                  <FeedSkeleton />
                ) : isActivityError && activityData.length === 0 ? (
                  // "Veri yok" ile "yüklenemedi" AYRI durumlar (bkz. ProfileActivityTab.tsx/
                  // PublicProfileMobile.tsx'teki AYNI ayrım, docs/AI_RULES.md § Sessiz
                  // başarısızlık YASAKTIR).
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
                ) : activityData.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Rss size={36} color="#334155" />
                    <Text style={styles.emptyTitle}>{t('feed:publicProfileEmptyTitle', 'Henüz aktivite yok')}</Text>
                    <Text style={styles.emptyText}>
                      {t('feed:publicProfileEmptyText', 'Bu kullanıcı henüz bir şey izlemedi veya puanlamadı.')}
                    </Text>
                  </View>
                ) : (
                  activityData.map((item: FeedItem) =>
                    isMarathonActivity(item) ? (
                      <MarathonFeedCard key={item.id} activity={item} />
                    ) : (
                      <FeedCard key={item.id} activity={item} />
                    )
                  )
                )}
              </View>
            ) : (
              <View style={styles.gridContainer}>
                {((activeTab === 'shows' && isLoadingShows) || (activeTab === 'movies' && isLoadingMovies)) ? (
                  <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 40, alignSelf: 'center', width: '100%' }} />
                ) : (activeTab === 'shows' && shows.length === 0) || (activeTab === 'movies' && movies.length === 0) ? (
                  <View style={styles.emptyState}>
                    <Rss size={36} color="#334155" />
                    <Text style={styles.emptyTitle}>{t('feed:publicProfileEmptyTitle', 'Henüz içerik yok')}</Text>
                    <Text style={styles.emptyText}>
                      {t('feed:publicProfileEmptyText', 'Bu listede henüz içerik bulunmuyor.')}
                    </Text>
                  </View>
                ) : (
                  (activeTab === 'shows' ? shows : movies).map((item, index) => {
                    const type = activeTab === 'shows' ? 'show' : 'movie';
                    const media = item[type];
                    const tmdbId = media?.ids?.tmdb;
                    const title = media?.title;

                    return (
                      <TouchableOpacity 
                        key={media?.ids?.trakt || index}
                        style={[styles.gridCard, { width: cardWidth, height: cardHeight, margin: SPACING / 2 }]}
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
                  })
                )}
              </View>
            )}
              </>
            )}
          </>
        )}
      </ScrollView>
      {hedefUserId && (
        <ReportContentModal
          visible={bioRaporAcik}
          targetType="user_bio"
          targetId={hedefUserId}
          onClose={() => setBioRaporAcik(false)}
        />
      )}
    </View>
  );
}
