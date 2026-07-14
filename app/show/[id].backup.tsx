import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Platform, UIManager, LayoutAnimation, Modal, TouchableWithoutFeedback } from 'react-native';
import LoadingIndicator from '../../components/LoadingIndicator';

import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ChevronLeft, Play, ChevronDown, ChevronUp, Check, CheckCheck, Star } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

import { getShowSummary, getShowSeasons, getShowCast, getRelatedShows, addRating, removeRating, getMediaComments } from '../../services/traktApi';
import { getShowBackdrop, getShowTrailer, getShowPoster } from '../../services/tmdbApi';
import { useLibrary } from '../../context/LibraryContext';
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

const { width } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ShowDetailScreen() {
  const router = useRouter();
  const { id, tmdbId } = useLocalSearchParams(); // id is traktId
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation('media');
  
  const [showData, setShowData] = useState<any>(null);
  const [seasonsData, setSeasonsData] = useState<any[]>([]);
  const [castData, setCastData] = useState<any[]>([]);
  const [relatedShows, setRelatedShows] = useState<any[]>([]);
  const [commentsData, setCommentsData] = useState<any[]>([]);
  
  const [backdrop, setBackdrop] = useState<string | null>(null);
  const [poster, setPoster] = useState<string | null>(null);
  const [trailerId, setTrailerId] = useState<string | null>(null);
  
  const [expandedSeasons, setExpandedSeasons] = useState<any>({});
  
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [writeCommentVisible, setWriteCommentVisible] = useState(false);
  const [commentRefreshTrigger, setCommentRefreshTrigger] = useState(0);
  
  const { 
    showProgressMap, 
    markSeasonAsWatched, 
    unwatchSeason,
    userRatingsShows, 
    userRatingsEpisodes,
    watchlistShows,
    toggleWatchlistStatus,
    hideMediaFromProgress,
    deleteMediaFromHistory,
    refreshLibrary,
    unwatchEpisode,
    rewatchEpisode
  } = useLibrary();
  const [seasonLoading, setSeasonLoading] = useState<Record<number, boolean>>({});

  // Bölüm Seçenekleri (Modal) State'leri
  const [selectedEpisode, setSelectedEpisode] = useState<{season: number, episode: number, title: string, traktId?: number} | null>(null);
  const [episodeRatingModalVisible, setEpisodeRatingModalVisible] = useState(false);
  const [localLoadingOption, setLocalLoadingOption] = useState<'remove' | 'rewatch' | null>(null);

  // Snackbar State'leri
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarData, setSnackbarData] = useState<{showId: number, season: number, episode: number} | null>(null);

  const traktIdNum = parseInt(id as string, 10);
  
  // Kullanıcının puanını bul
  const userRatingObj = userRatingsShows?.find((r: any) => r.show?.ids?.trakt === traktIdNum);
  const userRating = userRatingObj ? userRatingObj.rating : null;

  const isWatchlisted = watchlistShows?.some((item: any) => item.show?.ids?.trakt === traktIdNum);

  const handleRate = async (rating: number) => {
    try {
      await addRating(traktIdNum, 'show', rating);
      await refreshLibrary();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveRating = async () => {
    try {
      await removeRating(traktIdNum, 'show');
      await refreshLibrary();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkSeason = async (seasonNum: number, isWatched: boolean) => {
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
    if (id) {
      loadData();
    }
  }, [id, tmdbId]);

  // Expand logic: Auto-expand the season that the user is currently watching
  useEffect(() => {
    if (showProgressMap[id as string] && seasonsData.length > 0) {
      const progress = showProgressMap[id as string];
      let currentSeason = 1;
      if (progress.next_episode) {
        currentSeason = progress.next_episode.season;
      } else if (progress.last_episode) {
        currentSeason = progress.last_episode.season;
      }
      setExpandedSeasons((prev: any) => ({ ...prev, [currentSeason]: true }));
    } else if (seasonsData.length > 0) {
      // expand season 1 by default if no progress
      setExpandedSeasons((prev: any) => ({ ...prev, [1]: true }));
    }
  }, [showProgressMap, seasonsData, id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const tmdbIdNum = tmdbId ? parseInt(tmdbId as string, 10) : null;
      
      const cacheKey = `@show_detail_v2_${traktIdNum}`;
      let cachedContent = null;
      try {
         const raw = await AsyncStorage.getItem(cacheKey);
         if (raw) {
           const parsed = JSON.parse(raw);
           if (Date.now() - parsed.timestamp < 6 * 60 * 60 * 1000) {
             cachedContent = parsed.data;
           }
         }
      } catch(e) {}

      let summary = null, seasons = null, cast = null, related = null;
      
      if (cachedContent) {
         summary = cachedContent.summary;
         seasons = cachedContent.seasons;
         cast = cachedContent.cast;
         related = cachedContent.related;
      }

      if (!summary) {
          const results = await Promise.allSettled([
            getShowSummary(traktIdNum),
            getShowSeasons(traktIdNum),
            getShowCast(traktIdNum),
            getRelatedShows(traktIdNum),
            getMediaComments(traktIdNum, 'show')
          ]);
          
          summary = results[0].status === 'fulfilled' ? results[0].value : null;
          seasons = results[1].status === 'fulfilled' ? results[1].value : [];
          cast = results[2].status === 'fulfilled' ? results[2].value?.cast || [] : [];
          related = results[3].status === 'fulfilled' ? results[3].value : [];
          const comments = results[4].status === 'fulfilled' ? results[4].value?.data || [] : [];
          setCommentsData(comments);
         
         // 1. ADIM: VERİ ZAYIFLATMA (Boyutu %90 küçültür)
         const slimSeasons = seasons.map((s: any) => ({
           number: s.number,
           aired_episodes: s.aired_episodes || 0,
           episodes: (s.episodes || []).map((ep: any) => ({
             number: ep.number,
             title: ep.title,
             first_aired: ep.first_aired,
             ids: { trakt: ep?.ids?.trakt }
           }))
         }));
         
         const slimCast = cast.map((c: any) => ({
           characters: c.characters,
           person: {
             name: c.person?.name,
             ids: { trakt: c.person?.ids?.trakt }
           }
         }));
         
         const slimRelated = related.map((r: any) => ({
           title: r.title,
           ids: { trakt: r.ids?.trakt, tmdb: r.ids?.tmdb, slug: r.ids?.slug }
         }));

         // 2. ADIM: KAYDETME VE OTOMATİK TEMİZLİK (Garbage Collection)
         try {
           await AsyncStorage.setItem(cacheKey, JSON.stringify({
             timestamp: Date.now(),
             data: { summary, seasons: slimSeasons, cast: slimCast, related: slimRelated }
           }));
         } catch(cacheErr) {
           console.warn('[Cache Kaydetme Hatası] Kota doldu. Eski cacheler temizleniyor...');
           try {
             const allKeys = await AsyncStorage.getAllKeys();
             const cacheKeys = allKeys.filter(k => 
               k.startsWith('@show_detail_') || 
               k.startsWith('@show_detail_v2_') || 
               k.startsWith('@episode_detail_') || 
               k.startsWith('@movie_detail_')
             );
             
             if (cacheKeys.length > 0) {
               await AsyncStorage.multiRemove(cacheKeys);
               console.log(`${cacheKeys.length} adet eski önbellek başarıyla temizlendi ve yer açıldı.`);
               
               // Yer açıldıktan sonra tekrar dene
               await AsyncStorage.setItem(cacheKey, JSON.stringify({
                 timestamp: Date.now(),
                 data: { summary, seasons: slimSeasons, cast: slimCast, related: slimRelated }
               }));
             }
           } catch(e) {
             console.error('Önbellek temizlenirken hata:', e);
           }
         }
      }

      setShowData(summary);
      
      const validSeasons = (seasons || []).filter((s: any) => s.number > 0).sort((a: any, b: any) => a.number - b.number);
      setSeasonsData(validSeasons);
      
      setCastData(cast || []);
      
      const mappedRelated = await Promise.all((related || []).map(async (item: any) => {
         const rTmdb = item.ids?.tmdb;
         let rImg = null;
         if (rTmdb) {
            rImg = await getShowPoster(rTmdb);
         }
         return {
            id: item.ids.trakt,
            rawTraktId: item.ids.trakt,
            tmdbId: rTmdb,
            title: item.title,
            image: rImg
         };
      }));
      setRelatedShows(mappedRelated);

      if (tmdbIdNum) {
        const [bd, tr, pst] = await Promise.all([
          getShowBackdrop(tmdbIdNum),
          getShowTrailer(tmdbIdNum),
          getShowPoster(tmdbIdNum)
        ]);
        setBackdrop(bd);
        setTrailerId(tr);
        setPoster(pst);
        if (summary && !commentsData.length) { // Cache'den okunduysa yorumlar eksik olabilir
          try {
            const commRes = await getMediaComments(traktIdNum, 'show');
            setCommentsData(commRes.data || []);
          } catch(e) {}
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRateEpisode = async (rating: number) => {
    if (!selectedEpisode?.traktId) return;
    try {
      await addRating(selectedEpisode.traktId, 'episode', rating);
      setEpisodeRatingModalVisible(false);
      setSelectedEpisode(null);
      refreshLibrary();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveEpisodeRating = async () => {
    if (!selectedEpisode?.traktId) return;
    try {
      await removeRating(selectedEpisode.traktId, 'episode');
      setEpisodeRatingModalVisible(false);
      setSelectedEpisode(null);
      refreshLibrary();
    } catch (e) {
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
          onRate={handleRate}
          onRemoveRating={handleRemoveRating}
          onToggleWatchlist={() => toggleWatchlistStatus(traktIdNum, 'show', isWatchlisted, showData)}
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
                  refreshTrigger={commentRefreshTrigger}
                  onDeleteSuccess={() => loadData()}
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
                  refreshTrigger={commentRefreshTrigger}
                  onDeleteSuccess={() => loadData()}
                />
             </View>
          )}

          {seasonsData && seasonsData.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('seasons')}</Text>
              {seasonsData.map((season) => {
                const isExpanded = expandedSeasons[season.number];
                return (
                  <View key={season.number} style={styles.seasonContainer}>
                    <TouchableOpacity 
                      style={styles.seasonHeader} 
                      onPress={() => toggleSeason(season.number)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.seasonTitle}>{t('seasonNum', { number: season.number })}</Text>
                      <View style={{flexDirection: 'row', alignItems: 'center'}}>
                         {(() => {
                           const seasonProgress = showProgressMap[id as string]?.seasons?.find((s:any) => s.number === season.number);
                           const isSeasonWatched = seasonProgress && seasonProgress.completed > 0;
                           
                           return (
                             <TouchableOpacity 
                                onPress={() => handleMarkSeason(season.number, isSeasonWatched)} 
                                style={{marginRight: 16, padding: 4, backgroundColor: isSeasonWatched ? '#10b981' : 'rgba(255, 255, 255, 0.1)', borderRadius: 6}}
                                disabled={seasonLoading[season.number]}
                             >
                                {seasonLoading[season.number] ? (
                                  <LoadingIndicator size="small" color="#ffffff" />
                                ) : (
                                  <CheckCheck color="#ffffff" size={20} />
                                )}
                             </TouchableOpacity>
                           );
                         })()}
                         {isExpanded ? <ChevronUp color="#a3a3a3" /> : <ChevronDown color="#a3a3a3" />}
                      </View>
                    </TouchableOpacity>

                    {isExpanded && season.episodes && (
                      <View style={styles.episodesList}>
                        {season.episodes.map((ep: any) => {
                           const isWatchedLocal = showProgressMap[id as string]?.seasons?.find((s:any) => s.number === season.number)?.episodes?.find((e:any) => e.number === ep.number)?.completed;
                           const isAired = ep.first_aired 
                             ? new Date(ep.first_aired) <= new Date() 
                             : ep.number <= (season.aired_episodes || 0);
                           
                           return (
                             <View key={ep.number} style={styles.episodeRow}>
                               <TouchableOpacity 
                                 style={styles.episodeInfo}
                                 activeOpacity={0.7}
                                 onPress={() => {
                                   const epId = ep?.ids?.trakt;
                                   if (!epId) return; // ID yoksa çökmeyi engelle
                                   const safeTitle = encodeURIComponent(showData?.title || '');
                                   router.push(`/episode/${epId}?showId=${showData?.ids?.trakt || ''}&showTmdbId=${tmdbId}&showSlug=${showData?.ids?.slug || ''}&season=${season.number}&episode=${ep.number}&showName=${safeTitle}`);
                                 }}
                               >
                                 <Text style={styles.episodeNumber}>{t('episodeNum', { number: ep.number })}</Text>
                                 <Text style={styles.episodeName} numberOfLines={1}>{ep.title}</Text>
                                 {ep.first_aired && <Text style={styles.episodeDate}>{new Date(ep.first_aired).toLocaleDateString('tr-TR')}</Text>}
                               </TouchableOpacity>
                               <View>
                                 {isWatchedLocal ? (
                                    <TouchableOpacity 
                                      style={styles.watchedIcon}
                                      activeOpacity={0.7}
                                      onPress={() => setSelectedEpisode({season: season.number, episode: ep.number, title: ep.title, traktId: ep?.ids?.trakt})}
                                    >
                                      <Check size={20} color="#fff" strokeWidth={3} />
                                    </TouchableOpacity>
                                 ) : !isAired ? (
                                    <View style={styles.unairedBadge}>
                                      <Text style={styles.unairedText}>
                                        {!ep.first_aired ? 'TBA' : (() => {
                                          const diff = new Date(ep.first_aired).getTime() - new Date().getTime();
                                          const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                                          return days <= 0 ? t('today') : t('daysLeft', { days: days });
                                        })()}
                                      </Text>
                                    </View>
                                 ) : (
                                    <EpisodeCheckButton 
                                      traktId={showData.ids.trakt}
                                      season={season.number}
                                      episode={ep.number}
                                      showName={showData.title}
                                    />
                                 )}
                               </View>
                             </View>
                           )
                        })}
                      </View>
                    )}
                  </View>
                )
              })}
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
      <Modal
        visible={!!selectedEpisode}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedEpisode(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedEpisode(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>S{selectedEpisode?.season} E{selectedEpisode?.episode}: {selectedEpisode?.title}</Text>
                  <Text style={styles.modalSubtitle}>{t('episodeOptions')}</Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.modalButton} 
                  onPress={() => setEpisodeRatingModalVisible(true)}
                >
                  <Star size={20} color="#f59e0b" fill="#f59e0b" />
                  <Text style={[styles.modalButtonText, {color: '#f59e0b'}]}>{t('rateOrEdit')}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.modalButton} 
                  onPress={handleRewatchEpisode}
                  disabled={!!localLoadingOption}
                >
                  {localLoadingOption === 'rewatch' ? (
                    <LoadingIndicator size="small" color="#3b82f6" />
                  ) : (
                    <>
                      <CheckCheck size={20} color="#10b981" />
                      <Text style={[styles.modalButtonText, {color: '#10b981'}]}>{t('rewatch')}</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalButton, {borderBottomWidth: 0}]} 
                  onPress={handleUnwatchEpisode}
                  disabled={!!localLoadingOption}
                >
                  {localLoadingOption === 'remove' ? (
                    <LoadingIndicator size="small" color="#ef4444" />
                  ) : (
                    <>
                      <Text style={[styles.modalButtonText, {color: '#ef4444', marginLeft: 0}]}>{t('unwatch')}</Text>
                      <Text style={{color: '#737373', fontSize: 11, marginTop: 4}}>{t('allRecordsDeleted')}</Text>
                    </>
                  )}
                </TouchableOpacity>

              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Episode Rating Modal */}
      <Modal visible={episodeRatingModalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setEpisodeRatingModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{t('rateEpisode')}</Text>
                <StarSlider 
                  initialRating={userRatingsEpisodes?.find((r: any) => r.episode?.ids?.trakt === selectedEpisode?.traktId)?.rating} 
                  onRate={handleRateEpisode} 
                  onRemove={userRatingsEpisodes?.find((r: any) => r.episode?.ids?.trakt === selectedEpisode?.traktId) ? handleRemoveEpisodeRating : undefined}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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
          setCommentRefreshTrigger(prev => prev + 1);
          loadData();
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0B1120', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHeader: { marginBottom: 20 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  modalSubtitle: { color: '#a3a3a3', fontSize: 13 },
  modalButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#172033', flexWrap: 'wrap' },
  modalButtonText: { fontSize: 16, fontWeight: '600', marginLeft: 12 },
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
