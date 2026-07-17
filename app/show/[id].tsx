import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Platform, UIManager, LayoutAnimation, Modal, TouchableWithoutFeedback, Alert } from 'react-native';
import LoadingIndicator from '../../components/LoadingIndicator';
import { BlurView } from 'expo-blur';

import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ChevronLeft, Play, ChevronDown, ChevronUp, Check, CheckCheck, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { addRating, removeRating } from '../../services/traktApi';
import { useShowDetail } from '../../hooks/useShowDetail';
import { getShowBackdrop, getShowTrailer, getShowPoster } from '../../services/tmdbApi';
import { useLibrary } from '../../context/LibraryContext';
import { parseMediaSlug } from '../../utils/slugHelper';
import EpisodeCheckButton from '../../components/EpisodeCheckButton';
import MediaHero from '../../components/MediaHero';
import MediaCast from '../../components/MediaCast';
import HorizontalMediaList from '../../components/HorizontalMediaList';
import Snackbar from '../../components/Snackbar';
import StarSlider from '../../components/StarSlider';
import CommentSheet from '../../components/CommentSheet';
import WriteCommentSheet from '../../components/WriteCommentSheet';
import MyInlineComment from '../../components/MyInlineComment';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { generateEpisodeSlug } from '../../utils/slugHelper';
import SeasonAccordion from '../../components/SeasonAccordion';
import EpisodeRatingModal from '../../components/modals/EpisodeRatingModal';
import EpisodeOptionsModal from '../../components/modals/EpisodeOptionsModal';


const { width } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ShowDetailScreen() {
  const router = useRouter();
  const { id, tmdbId } = useLocalSearchParams(); // id is traktId
  const { t } = useTranslation('media');
const { 
    showProgressMap, 
    markSeasonAsWatched, 
    unwatchSeason,
    userRatingsShows, 
    userRatingsEpisodes,
    watchlistShows,
    toggleWatchlistStatus,
    favShows,
    toggleFavoriteStatus,
    hideMediaFromProgress,
    deleteMediaFromHistory,
    setLocalRating,
    removeLocalRating,
    refreshLibrary,
    unwatchEpisode,
    rewatchEpisode
  } = useLibrary();
  const { isGuest } = useAuth();
  
  const idStr = Array.isArray(id) ? id[0] : id;
  const { traktId: traktIdNum, slugText: showSlug } = parseMediaSlug(idStr as string);

  const { mediaData, computedSeasons, isLoading, refreshData, refreshComments } = useShowDetail(traktIdNum, tmdbId, showProgressMap);
  const showData = mediaData.summary;
  const castData = mediaData.cast;
  const relatedShows = mediaData.related;
  const commentsData = mediaData.comments;
  
  
  const [backdrop, setBackdrop] = useState<string | null>(null);
  const [poster, setPoster] = useState<string | null>(null);
  const [trailerId, setTrailerId] = useState<string | null>(null);
  
  const [expandedSeasons, setExpandedSeasons] = useState<any>({});
  
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [writeCommentVisible, setWriteCommentVisible] = useState(false);
  
  
  const [seasonLoading, setSeasonLoading] = useState<Record<number, boolean>>({});

  // Bölüm Seçenekleri (Modal) State'leri
  const [selectedEpisode, setSelectedEpisode] = useState<{season: number, episode: number, title: string, traktId?: number} | null>(null);
  const [episodeRatingModalVisible, setEpisodeRatingModalVisible] = useState(false);
  const [localLoadingOption, setLocalLoadingOption] = useState<'remove' | 'rewatch' | null>(null);

  // Snackbar State'leri
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarData, setSnackbarData] = useState<{showId: number, season: number, episode: number} | null>(null);

  
  // Kullanıcının puanını bul
  const userRatingObj = userRatingsShows?.find((r: any) => r.show?.ids?.trakt === traktIdNum);
  const userRating = userRatingObj ? userRatingObj.rating : null;

  const isWatchlisted = watchlistShows?.some((item: any) => item.show?.ids?.trakt === traktIdNum);
  const isFavorited = favShows?.some((item: any) => item.show?.ids?.trakt === traktIdNum);

  const handleRate = async (rating: number) => {
    try {
      setLocalRating(traktIdNum, 'show', rating * 2);
      await addRating(traktIdNum, 'show', rating);
    } catch (e) {
      removeLocalRating(traktIdNum, 'show');
      Alert.alert(t('common:error'), 'Puan kaydedilirken bir hata oluştu.');
      console.error(e);
    }
  };

  const handleRemoveRating = async () => {
    try {
      removeLocalRating(traktIdNum, 'show');
      await removeRating(traktIdNum, 'show');
    } catch (e) {
      Alert.alert(t('common:error'), 'Puan silinirken bir hata oluştu.');
      console.error(e);
    }
  };

  const handleMarkSeason = async (seasonNum: number, isWatched: boolean) => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }
    try {
      setSeasonLoading(prev => ({ ...prev, [seasonNum]: true }));
      if (isWatched) {
        await unwatchSeason(parseInt(id as string, 10), seasonNum);
      } else {
        await markSeasonAsWatched(parseInt(id as string, 10), seasonNum);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSeasonLoading(prev => ({ ...prev, [seasonNum]: false }));
    }
  };

  const handleUnwatchEpisode = async () => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }
    if (!selectedEpisode) return;
    setLocalLoadingOption('remove');
    try {
      await unwatchEpisode(traktIdNum, selectedEpisode.season, selectedEpisode.episode);
      setSnackbarData({ showId: traktIdNum, season: selectedEpisode.season, episode: selectedEpisode.episode });
      setSnackbarVisible(true);
      setSelectedEpisode(null);
    } catch (e) {
      console.error(e);
    } finally {
      setLocalLoadingOption(null);
    }
  };

  const handleRewatchEpisode = async () => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }
    if (!selectedEpisode) return;
    setLocalLoadingOption('rewatch');
    try {
      await rewatchEpisode(traktIdNum, selectedEpisode.season, selectedEpisode.episode);
      setSelectedEpisode(null);
    } catch (e) {
      console.error(e);
    } finally {
      setLocalLoadingOption(null);
    }
  };

  const handleUndoUnwatch = async () => {
    if (!snackbarData) return;
    try {
      await rewatchEpisode(snackbarData.showId, snackbarData.season, snackbarData.episode);
      setSnackbarVisible(false);
      setSnackbarData(null);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchTmdb = async () => {
      if (tmdbId) {
        const tmdbIdNum = parseInt(tmdbId as string, 10);
        try {
          const [bd, tr, pst] = await Promise.all([
            getShowBackdrop(tmdbIdNum),
            getShowTrailer(tmdbIdNum),
            getShowPoster(tmdbIdNum)
          ]);
          if (isMounted) {
            setBackdrop(bd);
            setTrailerId(tr);
            setPoster(pst);
          }
        } catch(e){}
      }
    };
    fetchTmdb();
    return () => { isMounted = false; };
  }, [tmdbId]);

  const renderUnairedBadgeText = (ep: any) => {
    if (!ep.first_aired) return 'TBA';
    const diff = new Date(ep.first_aired).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days <= 0 ? t('today') : t('daysLeft', { days: days });
  };
  
  const handleRateEpisode = async (rating: number) => {
    if (!selectedEpisode?.traktId) return;
    try {
      setLocalRating(selectedEpisode.traktId, 'episode', rating * 2);
      await addRating(selectedEpisode.traktId, 'episode', rating);
      setEpisodeRatingModalVisible(false);
      setSelectedEpisode(null);
    } catch (e) {
      removeLocalRating(selectedEpisode.traktId, 'episode');
      Alert.alert(t('common:error'), 'Bölüm puanı kaydedilirken hata oluştu.');
      console.error(e);
    }
  };

  const handleRemoveEpisodeRating = async () => {
    if (!selectedEpisode?.traktId) return;
    try {
      removeLocalRating(selectedEpisode.traktId, 'episode');
      await removeRating(selectedEpisode.traktId, 'episode');
      setEpisodeRatingModalVisible(false);
      setSelectedEpisode(null);
    } catch (e) {
      Alert.alert(t('common:error'), 'Bölüm puanı silinirken hata oluştu.');
      console.error(e);
    }
  };

  const toggleSeason = (seasonNum: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSeasons((prev: any) => ({ ...prev, [seasonNum]: !prev[seasonNum] }));
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>{t('loadingDetails')}</Text>
      </View>
    );
  }

  if (!showData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{t('showNotFound')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: '#3b82f6' }}>{t('goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        
        <MediaHero 
          type="show"
          data={showData}
          backdrop={backdrop}
          poster={poster}
          trailerId={trailerId}
          userRating={userRating}
          isWatchlisted={isWatchlisted}
          isFavorited={isFavorited}
          onRate={handleRate}
          onRemoveRating={handleRemoveRating}
          onToggleWatchlist={() => toggleWatchlistStatus(traktIdNum, 'show', isWatchlisted, showData)}
          onToggleFavorite={() => toggleFavoriteStatus(traktIdNum, 'show', isFavorited, showData)}
          onHideFromProgress={() => hideMediaFromProgress(traktIdNum, 'show')}
          onDeleteFromHistory={() => deleteMediaFromHistory(traktIdNum, 'show')}
        />

        <View style={styles.contentArea}>
          <MediaCast cast={castData} />

          {/* Comments */}
          {commentsData && commentsData.length > 0 && (() => {
            const nonSpoilerComments = commentsData.filter(c => !c.spoiler);
            const teaserComments = nonSpoilerComments.slice(0, 2);

            return (
              <View style={styles.section}>
                {/* Write Comment Button */}
                <MyInlineComment 
                  mediaId={traktIdNum}
                  mediaType="show"
                  onPressWrite={() => setWriteCommentVisible(true)}
                  refreshTrigger={0}
                  onDeleteSuccess={() => refreshData()}
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

          {(!commentsData || commentsData.length === 0) && (
             <View style={[styles.section, { paddingBottom: 20 }]}>
                <MyInlineComment 
                  mediaId={traktIdNum}
                  mediaType="show"
                  onPressWrite={() => setWriteCommentVisible(true)}
                  refreshTrigger={0}
                  onDeleteSuccess={() => refreshData()}
                />
             </View>
          )}

          {computedSeasons && computedSeasons.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('seasons')}</Text>
              {computedSeasons.map((season) => (
                <SeasonAccordion
                  key={season.number}
                  season={season}
                  showTraktId={traktIdNum}
                  showSlug={showData?.ids?.slug}
                  showTitle={showData?.title}
                  showTmdbId={tmdbId as string}
                  onSelectEpisode={(ep, seasonNumber) => setSelectedEpisode({season: seasonNumber, episode: ep.number, title: ep.title, traktId: ep?.ids?.trakt})}
                  isExpanded={expandedSeasons[season.number]}
                  onToggle={() => toggleSeason(season.number)}
                  seasonProgress={showProgressMap[id as string]?.seasons?.find((s:any) => s.number === season.number)}
                />
              ))}
            </View>
          )}

          {/* RELATED SHOWS */}
          {relatedShows && relatedShows.length > 0 && (
            <HorizontalMediaList 
              title={t('relatedShows')} 
              data={relatedShows} 
              type="show"
            />
          )}

        </View>
      </ScrollView>

      {/* Bölüm Seçenekleri (Bottom Sheet Modal) */}
      <EpisodeOptionsModal
        visible={!!selectedEpisode}
        onClose={() => setSelectedEpisode(null)}
        episode={selectedEpisode}
        loadingOption={localLoadingOption}
        onRatePress={() => setEpisodeRatingModalVisible(true)}
        onRewatch={handleRewatchEpisode}
        onUnwatch={handleUnwatchEpisode}
      />

      {/* Episode Rating Modal */}
      <EpisodeRatingModal
        visible={episodeRatingModalVisible}
        onClose={() => setEpisodeRatingModalVisible(false)}
        initialRating={userRatingsEpisodes?.find((r: any) => r.episode?.ids?.trakt === selectedEpisode?.traktId)?.rating}
        onRate={handleRateEpisode}
        onRemove={userRatingsEpisodes?.find((r: any) => r.episode?.ids?.trakt === selectedEpisode?.traktId) ? handleRemoveEpisodeRating : undefined}
      />

      {/* Yorumlar Modal */}
      <CommentSheet 
        visible={commentSheetVisible} 
        onClose={() => setCommentSheetVisible(false)} 
        mediaId={traktIdNum} 
        mediaType="show" 
      />

      {/* Yorum Yazma Modal */}
      <WriteCommentSheet
        visible={writeCommentVisible}
        onClose={() => setWriteCommentVisible(false)}
        mediaId={traktIdNum}
        mediaType="show"
        onSuccess={() => {
          refreshComments();
          refreshData();
        }}
      />

      <Snackbar 
        visible={snackbarVisible}
        message={t('episodeUnwatched')}
        actionText={t('undo')}
        onAction={handleUndoUnwatch}
        onDismiss={() => setSnackbarVisible(false)}
        duration={4000}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  loadingContainer: { flex: 1, backgroundColor: '#0B1120', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#a3a3a3', marginTop: 16 },
  contentArea: { padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  seasonContainer: { marginBottom: 12, backgroundColor: '#0B1120', borderRadius: 8, overflow: 'hidden' },
  seasonHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#1e293b' },
  seasonTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  episodesList: { padding: 8 },
  episodeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#172033' },
  episodeInfo: { flex: 1, paddingRight: 12 },
  episodeNumber: { color: '#a3a3a3', fontSize: 12, fontWeight: 'bold', marginBottom: 2 },
  episodeName: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  episodeDate: { color: '#737373', fontSize: 11 },
  watchedIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center' },
  commentBox: {
    backgroundColor: '#172033',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2A364F',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentUser: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: 14,
  },
  commentLikes: {
    color: '#a3a3a3',
    fontSize: 12,
  },
  commentText: {
    color: '#d4d4d4',
    fontSize: 14,
    lineHeight: 20,
  },
  unairedBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  unairedText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: 'bold',
  }
});
