import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, TouchableWithoutFeedback, Platform, Share } from 'react-native';
import LoadingIndicator from '../../components/LoadingIndicator';

import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Star, X, Info, Heart, Check, Share2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';

import { addRating, removeRating } from '../../services/traktApi';
import { useEpisodeDetail } from '../../hooks/useEpisodeDetail';
import { getEpisodeStill } from '../../services/tmdbApi';
import { formatRating } from '../../utils/formatRating';
import EpisodeCheckButton from '../../components/EpisodeCheckButton';
import StarSlider from '../../components/StarSlider';
import RatingModal from '../../components/RatingModal';
import CommentSheet from '../../components/CommentSheet';
import WriteCommentSheet from '../../components/WriteCommentSheet';
import MyInlineComment from '../../components/MyInlineComment';
import MediaCast from '../../components/MediaCast';
import ProgressBar from '../../components/ProgressBar';
import { useLibrary } from '../../context/LibraryContext';
import { useTrackingStore } from '../../store/tracking/useTrackingStore';
import { getProgressBarColor } from '../../utils/progressBarColor';
import { useEpisodeCast } from '../../hooks/useEpisodeCast';
import { parseEpisodeSlug, formatSlugToTitle, generateMediaSlug } from '../../utils/slugHelper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

export default function EpisodeDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, showTmdbId } = useLocalSearchParams();
  
  const idStr = Array.isArray(id) ? id[0] : id;
  const { showTraktId: parsedShowId, showSlug, season, episode, epTraktId } = parseEpisodeSlug(idStr as string);
  const showName = formatSlugToTitle(showSlug);
  const showId = parsedShowId;
  const traktIdNum = parsedShowId;
  const { 
    userRatingsEpisodes, 
    setLocalRating,
    removeLocalRating,
    showProgressMap, 
    unwatchEpisode,
    markEpisodeAsWatched,
    markEpisodesUpToAsWatched
  } = useLibrary();
  const { isGuest } = useAuth();
  const { t } = useTranslation('media');
  const { mediaData, isLoading, refreshData } = useEpisodeDetail(String(showId), showTmdbId, String(season), String(episode));
  const episodeData = mediaData.detail;
  const commentsData = mediaData.comments;
  const stillUrl = mediaData.stillUrl;

  const { cast: epCast, voteActor } = useEpisodeCast(
    showTmdbId ? parseInt(showTmdbId as string, 10) : null,
    season,
    episode
  );

  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [writeCommentVisible, setWriteCommentVisible] = useState(false);
  // Yorum yazma/silme sonrası MyInlineComment'in kendini tazelemesi için sayaç
  const [commentVersion, setCommentVersion] = useState(0);
  const [isCheckLoading, setIsCheckLoading] = useState(false);

  const [isWebViewVisible, setIsWebViewVisible] = useState(false);
  const [isWebViewLoading, setIsWebViewLoading] = useState(true);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<number, boolean>>({});

  const toggleSpoiler = (commentId: number) => {
    setRevealedSpoilers(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleShowPress = () => {
    if (!showId) return;
    const slug = generateMediaSlug(showId, showSlug, showName as string);
    const tmdbParam = showTmdbId ? `?tmdbId=${showTmdbId}` : '';
    router.push(`/show/${slug}${tmdbParam}`);
  };

  const myRating = userRatingsEpisodes?.find((r: any) => r.episode?.ids?.trakt === epTraktId)?.rating;

  const showProgress = showProgressMap[traktIdNum];
  const hasShowProgress = showProgress && showProgress.aired > 0 && showProgress.completed > 0;
  const showProgressPercentage = hasShowProgress ? (showProgress.completed / showProgress.aired) * 100 : 0;
  const droppedShowIds = useTrackingStore((s) => s.droppedShowIds);
  const hydrateTracking = useTrackingStore((s) => s.hydrate);
  const isShowDropped = droppedShowIds.includes(traktIdNum);
  const isShowFinished = !!hasShowProgress && showProgress.completed >= showProgress.aired;
  const showProgressColor = getProgressBarColor(isShowDropped, isShowFinished);

  // Bu sayfaya İzleme sekmesine hiç uğramadan (örn. bir bildirimden/paylaşılan
  // linkten) doğrudan gelinmiş olabilir — `droppedShowIds` o durumda boş kalır ve
  // daha önce bırakılmış bir dizi burada yanlışlıkla "aktif" (mavi) görünür.
  useEffect(() => {
    hydrateTracking();
  }, [hydrateTracking]);

  const handleRate = async (val: number) => {
    // StarSlider zaten 1-10 dahili ölçekte değer döndürür (Trakt ile aynı) — tekrar ×2 yapılmamalı.
    try {
      setLocalRating(epTraktId, 'episode', val);
      await addRating(epTraktId, 'episode', val);
      setRatingModalVisible(false);
    } catch(e) { 
      removeLocalRating(epTraktId, 'episode');
      Alert.alert(t('common:error'), 'Bölüm puanı kaydedilirken hata oluştu.');
      console.error(e);
    }
  };

  const handleRemoveRating = async () => {
    try {
      removeLocalRating(epTraktId, 'episode');
      await removeRating(epTraktId, 'episode');
      setRatingModalVisible(false);
    } catch(e) { 
      Alert.alert(t('common:error'), 'Bölüm puanı silinirken hata oluştu.');
      console.error(e);
    }
  };

  const handleWatchPress = async () => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }

    const sNum = season;
    const eNum = episode;
    const isWatchedLocal = showProgressMap[traktIdNum]?.seasons?.find((s:any) => s.number === sNum)?.episodes?.find((e:any) => e.number === eNum)?.completed;

    setIsCheckLoading(true);
    try {
      if (isWatchedLocal) {
        await unwatchEpisode(traktIdNum, sNum, eNum);
        return;
      }

      const progress = showProgressMap[traktIdNum];
      let skippedEpisodes: number[] = [];
      if (progress && progress.seasons) {
        const currentSeasonProgress = progress.seasons.find((s: any) => s.number === sNum);
        if (currentSeasonProgress && currentSeasonProgress.episodes) {
          for (let i = 1; i < eNum; i++) {
            const ep = currentSeasonProgress.episodes.find((e: any) => e.number === i);
            if (!ep || !ep.completed) {
              skippedEpisodes.push(i);
            }
          }
        } else {
          for (let i = 1; i < eNum; i++) {
            skippedEpisodes.push(i);
          }
        }
      } else {
        for (let i = 1; i < eNum; i++) {
          skippedEpisodes.push(i);
        }
      }

      const performCheckIn = async (isBulk: boolean, eps: number[]) => {
        try {
          if (isBulk) {
            await markEpisodesUpToAsWatched(traktIdNum, sNum, eps);
          } else {
            await markEpisodeAsWatched(traktIdNum, sNum, eNum);
          }
        } catch(e) {
          console.error(e);
          Alert.alert(t('common:error'), 'Bölüm işaretlenirken bir hata oluştu.');
        }
      };

      if (skippedEpisodes.length > 0) {
        Alert.alert(
          t('skippedEpisodesTitle', { defaultValue: 'Atlanan Bölümler Var' }),
          t('skippedEpisodesMsg', { defaultValue: 'Önceki izlemediğiniz bölümleri de izlendi olarak işaretlemek ister misiniz?' }),
          [
            {
              text: t('common:markOnlyThis', { defaultValue: 'Yalnızca Bu Bölüm' }),
              onPress: () => performCheckIn(false, []),
              style: 'cancel'
            },
            {
              text: t('common:markPreviousToo', { defaultValue: 'Öncekileri de İşaretle' }),
              onPress: () => performCheckIn(true, [...skippedEpisodes, eNum])
            }
          ]
        );
      } else {
        await performCheckIn(false, []);
      }
    } catch(e) {
      console.error(e);
    } finally {
      setIsCheckLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      const safeTitle = encodeURIComponent(showName as string || '');
      const url = `https://kaymaktv.com/episode/${idStr}`;
      
      await Share.share({
        message: `${showName} S${season} E${episode} ${t('shareEpisodeMsg', 'bölümüne göz at!')}\n${url}`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const title = episodeData?.title || t('episodeNum', { number: episode });
  const overview = episodeData?.overview || t('noOverviewYet');
  const firstAired = episodeData?.first_aired ? new Date(episodeData.first_aired).toLocaleDateString('tr-TR') : t('noDate');
  const rating = formatRating(episodeData?.rating);
  const votes = episodeData?.votes ? episodeData.votes.toLocaleString('tr-TR') : '0';

  return (
    <View style={styles.container}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.headerContainer}>
          {stillUrl ? (
            <Image source={{ uri: stillUrl }} style={styles.stillImage} contentFit="cover" transition={300} />
          ) : (
            <View style={styles.stillPlaceholder} />
          )}
          
          <LinearGradient
            colors={['rgba(0,0,0,0.8)', 'transparent', '#0a0a0a']}
            style={styles.gradientOverlay}
          />

          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ChevronLeft color="#fff" size={24} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Share2 color="#fff" size={24} />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            {/* Dizi adı: küçük, sade bir üst başlık (breadcrumb) — göze batmadan tıklanabilir */}
            <TouchableOpacity
              onPress={handleShowPress}
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 0, right: 8 }}
              style={styles.showNameRow}
            >
              <Text style={styles.showName} numberOfLines={1}>{showName}</Text>
              <ChevronRight size={11} color="rgba(148,163,184,0.7)" strokeWidth={2.5} />
            </TouchableOpacity>

            <Text style={styles.episodeTitle}>{title}</Text>
            <Text style={styles.episodeIdentifier}>
              {t('seasonEpisodeIdentifier', { season: season, episode: episode })} • {firstAired}
            </Text>

            <View style={styles.ratingsRow}>
              {/* Global Trakt Rating */}
              <View style={styles.ratingBadge}>
                <Star size={14} color="#facc15" fill="#facc15" />
                <Text style={styles.ratingText}>
                  {rating}
                </Text>
              </View>

              {/* User Rating Badge (Puanla) */}
              <TouchableOpacity 
                style={[styles.userRatingBadge, (myRating !== undefined && myRating !== null) ? styles.userRatingActive : null]} 
                onPress={() => {
                  if (isGuest) {
                    Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
                    return;
                  }
                  setRatingModalVisible(true)
                }}
                activeOpacity={0.7}
              >
                <Star size={14} color={(myRating !== undefined && myRating !== null) ? "#3b82f6" : "#a3a3a3"} fill={(myRating !== undefined && myRating !== null) ? "#3b82f6" : "transparent"} />
                <Text style={[styles.userRatingText, (myRating !== undefined && myRating !== null) ? styles.userRatingTextActive : null]}>
                  {(myRating !== undefined && myRating !== null) ? `${formatRating(myRating)}/5` : t('rate', { defaultValue: 'Puanla' })}
                </Text>
              </TouchableOpacity>

              {/* Check (Watched/Unwatched) Badge */}
              {(() => {
                const sNum = season;
                const eNum = episode;
                const isWatchedLocal = showProgressMap[traktIdNum]?.seasons?.find((s:any) => s.number === sNum)?.episodes?.find((e:any) => e.number === eNum)?.completed;
                const isFutureOrTBA = !episodeData?.first_aired || new Date(episodeData.first_aired) > new Date();
                
                if (isFutureOrTBA) {
                  return (
                    <View style={[styles.userRatingBadge, { backgroundColor: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.1)' }]}>
                      <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 13 }}>
                        {!episodeData?.first_aired ? 'TBA' : t('notAiredYet', { defaultValue: 'Yayınlanmadı' })}
                      </Text>
                    </View>
                  );
                }
                const isAired = episodeData?.first_aired ? new Date(episodeData.first_aired) <= new Date() : true;
                if (!isAired) return null;

                return (
                  <TouchableOpacity 
                    style={[styles.userRatingBadge, isWatchedLocal && { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }]} 
                    onPress={handleWatchPress}
                    disabled={isCheckLoading}
                  >
                    {isCheckLoading ? (
                      <LoadingIndicator size="small" color={isWatchedLocal ? "#10b981" : "#a3a3a3"} />
                    ) : (
                      <>
                        <Check size={14} color={isWatchedLocal ? "#10b981" : "#a3a3a3"} strokeWidth={3} />
                        <Text style={[styles.userRatingText, isWatchedLocal ? { color: '#10b981' } : null]}>
                          {isWatchedLocal ? t('watched') : t('markAsWatched')}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })()}
            </View>

            {hasShowProgress && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBarWrapper}>
                  <ProgressBar percentage={showProgressPercentage} fillColor={showProgressColor} />
                </View>
                <Text style={styles.progressText}>%{Math.round(showProgressPercentage)}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.contentArea}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('overview')}</Text>
            <Text style={styles.overviewText}>{overview}</Text>
          </View>

          {epCast && epCast.length > 0 && (
            <MediaCast cast={epCast} onActorPress={voteActor} />
          )}

          {commentsData && commentsData.length > 0 && (() => {
            const nonSpoilerComments = commentsData.filter((c: any) => !c.spoiler);
            const teaserComments = nonSpoilerComments.slice(0, 2);

            return (
              <View style={styles.section}>
                <MyInlineComment
                  mediaId={showId as number}
                  mediaType="episode"
                  episodeTraktId={episodeData?.ids?.trakt}
                  onPressWrite={() => setWriteCommentVisible(true)}
                  refreshTrigger={commentVersion}
                  onDeleteSuccess={() => { setCommentVersion(v => v + 1); refreshData(); }}
                />

                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
                  <Text style={styles.sectionTitle}>{t('comments')}</Text>
                  {commentsData.length > 0 && (
                    <TouchableOpacity onPress={() => setCommentSheetVisible(true)}>
                      <Text style={{color: '#3b82f6', fontSize: 12, fontWeight: 'bold'}}>{t('seeAllCount', { count: commentsData.length })}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {teaserComments.length > 0 ? (
                  teaserComments.map((c: any) => (
                    <View key={c.id} style={styles.commentBox}>
                      <View style={styles.commentHeader}>
                        <Text style={styles.commentUser}>{c.user?.username || 'Kullanıcı'}</Text>
                        <Text style={styles.commentLikes}>♥ {c.likes || 0}</Text>
                      </View>
                      <Text style={styles.commentText} numberOfLines={3}>{c.comment}</Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.commentBox}>
                    <Text style={[styles.commentText, {fontStyle: 'italic', color: '#737373'}]}>{t('allSpoilers')}</Text>
                  </View>
                )}

                {commentsData.length > teaserComments.length && (
                  <TouchableOpacity style={{ marginTop: 8, paddingVertical: 12, backgroundColor: '#172033', borderRadius: 8, alignItems: 'center' }} onPress={() => setCommentSheetVisible(true)}>
                    <Text style={{ color: '#e5e5e5', fontWeight: 'bold' }}>{t('seeMore')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}
        </View>
      </ScrollView>

      <RatingModal
        visible={ratingModalVisible}
        onClose={() => setRatingModalVisible(false)}
        title={t('rateEpisode')}
        myRating={myRating}
        onRate={handleRate}
        onRemoveRating={handleRemoveRating}
      />

      <CommentSheet 
        visible={commentSheetVisible} 
        onClose={() => setCommentSheetVisible(false)} 
        mediaId={showId as number}
        mediaType="episode"
        season={season}
        episode={episode}
      />

      <WriteCommentSheet
        visible={writeCommentVisible}
        onClose={() => setWriteCommentVisible(false)}
        mediaId={showId as number}
        mediaType="episode"
        episodeTraktId={episodeData?.ids?.trakt}
        onSuccess={() => {
          setCommentVersion(v => v + 1);
          refreshData();
        }}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  loadingContainer: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  headerContainer: { width: '100%', height: 350, position: 'relative' },
  stillImage: { width: '100%', height: '100%' },
  stillPlaceholder: { width: '100%', height: '100%', backgroundColor: '#0B1120' },
  gradientOverlay: { ...StyleSheet.absoluteFillObject },
  backButton: { position: 'absolute', top: 50, left: 16, zIndex: 10, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  shareButton: { position: 'absolute', top: 50, right: 16, zIndex: 10, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  headerContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, zIndex: 5 },
  // Sade breadcrumb: arka plan/kenarlık yok, sadece küçük soluk metin + ok — göze batmaz, isteyen fark edip kullanır.
  showNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    marginBottom: 5,
  },
  showName: { fontSize: 11, color: 'rgba(148,163,184,0.85)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 },
  episodeTitle: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 6 },
  episodeIdentifier: { fontSize: 13, color: '#94a3b8', fontWeight: '500', marginBottom: 12 },
  ratingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(250, 204, 21, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.2)',
  },
  ratingText: {
    color: '#facc15',
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 4,
  },
  userRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  userRatingActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  userRatingText: {
    color: '#a3a3a3',
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 6,
  },
  userRatingTextActive: {
    color: '#3b82f6',
  },
  progressContainer: { marginTop: 8, width: '100%', maxWidth: 240, flexDirection: 'row', alignItems: 'center' },
  progressBarWrapper: { flex: 1 },
  progressText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600', marginLeft: 8 },
  contentArea: { padding: 16 },
  section: { marginBottom: 32 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  seeAllText: { color: '#3b82f6', fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
  overviewText: { color: '#d4d4d4', fontSize: 15, lineHeight: 24 },
  castItem: { width: 80, alignItems: 'center' },
  castPhotoPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#172033', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  castName: { color: '#fff', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  castCharacter: { color: '#a3a3a3', fontSize: 10, textAlign: 'center' },
  commentBox: { backgroundColor: '#0B1120', padding: 16, borderRadius: 12, marginBottom: 12 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  commentUserRow: { flexDirection: 'row', alignItems: 'center' },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: '#172033' },
  commentAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: '#facc15', justifyContent: 'center', alignItems: 'center' },
  commentAvatarText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  commentUser: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  commentDate: { color: '#737373', fontSize: 11, marginTop: 2 },
  commentText: { color: '#d4d4d4', fontSize: 14, lineHeight: 22 },
  commentFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6 },
  commentLikes: { color: '#a3a3a3', fontSize: 12, fontWeight: 'bold' },
  spoilerWarning: { backgroundColor: 'rgba(250, 204, 21, 0.1)', padding: 16, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(250, 204, 21, 0.3)' },
  spoilerText: { color: '#facc15', fontWeight: 'bold', fontSize: 14, marginBottom: 4 },
  spoilerSubtext: { color: '#a3a3a3', fontSize: 12 },
  modalContainer: { flex: 1, backgroundColor: '#0a0a0a' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#0a0a0a', borderBottomWidth: 1, borderBottomColor: '#172033' },
  modalCloseButton: { flexDirection: 'row', alignItems: 'center' },
  modalCloseText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  webViewContainer: { flex: 1, position: 'relative' },
  webViewLoader: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a', zIndex: 10 },
  webView: { flex: 1, backgroundColor: '#0a0a0a' },
});
