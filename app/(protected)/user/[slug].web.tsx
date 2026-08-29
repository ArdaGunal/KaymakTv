import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppBack } from '../../../hooks/useAppBack';
import { ChevronLeft, Rss, Check, Clock, UserPlus, Lock, WifiOff } from '../../../components/icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useResponsive } from '../../../hooks/useResponsive';
import { useFollowState } from '../../../hooks/useFollowState';
import { usePublicProfile } from '../../../features/publicProfile/hooks/usePublicProfile';
import { usePublicProfileActivity } from '../../../features/publicProfile/hooks/usePublicProfileActivity';
import { usePublicProfileLibrary } from '../../../features/publicProfile/hooks/usePublicProfileLibrary';
import PublicProfileMobile from '../../../screens/PublicProfileMobile';
import FeedCard from '../../../features/feed/components/FeedCard';
import MarathonFeedCard from '../../../features/feed/components/MarathonFeedCard';
import FeedSkeleton from '../../../features/feed/components/FeedSkeleton';
import SkeletonLoader from '../../../components/SkeletonLoader';
import BlockUserButton from '../../../features/feed/components/BlockUserButton';
import BlockedProfileLock from '../../../features/feed/components/BlockedProfileLock';
import { useBlockState } from '../../../features/feed/hooks/useBlockState';
import { useMyTraktSlug } from '../../../features/feed/hooks/useMyTraktSlug';
import { useAuth } from '../../../context/AuthContext';
import { FeedItem, isMarathonActivity } from '../../../features/feed/types';
import MediaPoster from '../../../components/MediaPoster';
import { generateMediaSlug } from '../../../utils/slugHelper';

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

  const { profile, followersCount, followingCount, isLoading: isProfileLoading, error } = usePublicProfile(slug);
  // bkz. screens/PublicProfileMobile.tsx'teki AYNI düzeltme notu — rota
  // parametresi username olabilir, followStore kanonik slug bekliyor.
  const followSlug = profile?.ids?.slug || slug;
  const { connectionState, isLoadingConnection, isFollowPending, toggleFollow } = useFollowState(followSlug);
  const { data: activityData, isLoading: isActivityLoading, hasError: isActivityError, refresh: refreshActivity } = usePublicProfileActivity(slug);
  const { shows, movies, isLoadingShows, isLoadingMovies } = usePublicProfileLibrary(slug);

  // Engelleme (bkz. docs/design/FEED_SOCIAL_PLAN.md §4) — dar ekran dalıyla (
  // screens/PublicProfileMobile.tsx) AYNI mantık, ayrı bir header/layout
  // olduğu için burada da ayrıca bağlanıyor.
  const { accessToken, isGuest } = useAuth();
  const myTraktSlug = useMyTraktSlug();
  const { isBlockedEitherWay } = useBlockState(followSlug);
  const canShowBlockButton =
    !!accessToken && !isGuest && !!profile && !!myTraktSlug && profile.ids?.slug !== myTraktSlug;

  const [activeTab, setActiveTab] = useState<'activity' | 'shows' | 'movies'>('activity');
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
  const avatarUrl = profile?.images?.avatar?.full;
  const initial = profile?.username?.charAt(0).toUpperCase() ?? '?';

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
          {canShowBlockButton && <BlockUserButton traktSlug={followSlug as string} />}
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
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" cachePolicy="disk" />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
              )}

              <View style={styles.identityCol}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {profile.name || profile.username}
                  </Text>
                  {profile.private && <Lock size={14} color="#94a3b8" />}
                </View>
                <Text style={styles.handle} numberOfLines={1}>
                  @{profile.username}
                </Text>

                {!!profile.about && (
                  <Text style={styles.bio} numberOfLines={3}>
                    {profile.about}
                  </Text>
                )}

                <View style={styles.statsRow}>
                  <TouchableOpacity 
                    style={styles.statItem} 
                    activeOpacity={0.7}
                    onPress={() => router.push({ pathname: `/user/${profile.ids?.slug || profile.username}/network`, params: { type: 'followers' } })}
                  >
                    <Text style={styles.statValue}>{followersCount}</Text>
                    <Text style={styles.statLabel}>{t('media:profileFollowers', 'Takipçi')}</Text>
                  </TouchableOpacity>
                  <View style={styles.statDivider} />
                  <TouchableOpacity 
                    style={styles.statItem} 
                    activeOpacity={0.7}
                    onPress={() => router.push({ pathname: `/user/${profile.ids?.slug || profile.username}/network`, params: { type: 'following' } })}
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
    </View>
  );
}

const styles = StyleSheet.create({
  pageBackground: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 720,
    marginHorizontal: 'auto' as any,
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingRight: 10,
    ...({ cursor: 'pointer' } as any),
  },
  backButtonText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    backgroundColor: '#172033',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#22304A',
    padding: 24,
    marginBottom: 24,
  },
  skeletonIdentity: {
    gap: 8,
    flex: 1,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.4)',
  },
  avatarText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 30,
  },
  identityCol: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
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
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 50,
  },
  statValue: {
    color: '#f1f5f9',
    fontSize: 16,
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
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    minWidth: 130,
    justifyContent: 'center',
    flexShrink: 0,
    ...({ cursor: 'pointer' } as any),
  },
  followingBtn: {
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.35)',
  },
  pendingBtn: {
    backgroundColor: 'rgba(250, 204, 21, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.3)',
  },
  followBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  followingBtnText: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '700',
  },
  pendingBtnText: {
    color: '#facc15',
    fontSize: 13,
    fontWeight: '700',
  },
  feedColumn: {
    width: '100%',
  },
  errorState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  errorText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
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
    marginBottom: 20,
    width: '100%',
  },
  tab: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#f8fafc',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    marginHorizontal: -6, // SPACING / 2 compensation
  },
  gridCard: {
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
