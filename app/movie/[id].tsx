import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text, Dimensions, Platform, UIManager, LayoutAnimation, Alert } from 'react-native';
import LoadingIndicator from '../../components/LoadingIndicator';

import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Check, CheckCheck } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getMovieSummary, getRelatedMovies, addRating, removeRating, getMediaComments } from '../../services/traktApi';
import { getMovieBackdrop, getMovieTrailer, getMoviePoster, getTmdbCast } from '../../services/tmdbApi';
import { useLibrary } from '../../context/LibraryContext';
import { parseMediaSlug } from '../../utils/slugHelper';
import MediaHero from '../../components/MediaHero';
import MediaCast from '../../components/MediaCast';
import HorizontalMediaList from '../../components/HorizontalMediaList';
import CommentSheet from '../../components/CommentSheet';
import WriteCommentSheet from '../../components/WriteCommentSheet';
import MyInlineComment from '../../components/MyInlineComment';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function MovieDetailScreen() {
  const router = useRouter();
  const { id, tmdbId } = useLocalSearchParams(); // id is traktId
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation('media');
  
  const [movieData, setMovieData] = useState<any>(null);
  const [castData, setCastData] = useState<any[]>([]);
  const [relatedMovies, setRelatedMovies] = useState<any[]>([]);
  const [commentsData, setCommentsData] = useState<any[]>([]);
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [writeCommentVisible, setWriteCommentVisible] = useState(false);
  const [commentRefreshTrigger, setCommentRefreshTrigger] = useState(0);
  
  const [backdrop, setBackdrop] = useState<string | null>(null);
  const [poster, setPoster] = useState<string | null>(null);
  const [trailerId, setTrailerId] = useState<string | null>(null);
  
  const { 
    userRatingsMovies, 
    setLocalRating,
    removeLocalRating,
    markMovieAsWatched, 
    watchedMovies,
    watchlistMovies,
    toggleWatchlistStatus,
    favMovies,
    toggleFavoriteStatus,
    deleteMediaFromHistory 
  } = useLibrary();
  const { isGuest } = useAuth();
  const [actionLoading, setActionLoading] = useState(false);

  const idStr = Array.isArray(id) ? id[0] : id;
  const { traktId: traktIdNum } = parseMediaSlug(idStr as string);
  const tmdbIdNum = tmdbId ? parseInt(tmdbId as string, 10) : null;

  // Kullanıcının puanını bul
  const userRatingObj = userRatingsMovies?.find((r: any) => r.movie?.ids?.trakt === traktIdNum);
  const userRating = userRatingObj ? userRatingObj.rating : null;

  // Kullanıcı filmi izlemiş mi?
  const isWatched = watchedMovies?.some((m: any) => m.movie?.ids?.trakt === traktIdNum);
  const isWatchlisted = watchlistMovies?.some((m: any) => m.movie?.ids?.trakt === traktIdNum);
  const isFavorited = favMovies?.some((m: any) => m.movie?.ids?.trakt === traktIdNum);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    const fetchDetails = async () => {
      try {
        if (isMounted) setIsLoading(true);

        const cacheKey = `@movie_detail_v3_cache_${id}`;
        const cached = await AsyncStorage.getItem(cacheKey);
        
        let summary, cast, related;

        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < 1000 * 60 * 60 * 24) { // 24 saat cache
            summary = parsed.data.summary;
            cast = parsed.data.cast;
            related = parsed.data.related;
          }
        }

        if (!summary) {
          const results = await Promise.allSettled([
            getMovieSummary(traktIdNum),
            getRelatedMovies(traktIdNum),
            getMediaComments(traktIdNum, 'movie')
          ]);
          
          summary = results[0].status === 'fulfilled' ? results[0].value : null;
          related = results[1].status === 'fulfilled' ? results[1].value : [];
          const comments = results[2].status === 'fulfilled' ? results[2].value?.data || [] : [];
          if (isMounted) setCommentsData(comments);

          // TMDB Cast Fetching Logic (Fallback to summary.ids.tmdb)
          const finalTmdbId = tmdbIdNum ? tmdbIdNum : summary?.ids?.tmdb;
          if (finalTmdbId) {
            try {
              cast = await getTmdbCast(finalTmdbId, 'movie');
            } catch (e) {
              cast = [];
            }
          } else {
            cast = [];
          }
          
          const slimCast = cast;
          
          const slimRelated = related.map((r: any) => ({
            title: r.title,
            ids: { trakt: r.ids?.trakt, tmdb: r.ids?.tmdb, slug: r.ids?.slug }
          }));

          try {
            await AsyncStorage.setItem(cacheKey, JSON.stringify({
              timestamp: Date.now(),
              data: { summary, cast: slimCast, related: slimRelated }
            }));
          } catch(cacheErr) {
            console.warn('[Cache Kaydetme Hatası] Kota doldu. Eski cacheler temizleniyor...');
            try {
              const allKeys = await AsyncStorage.getAllKeys();
              const cacheKeys = allKeys.filter(k => 
                k.startsWith('@show_detail_') || 
                k.startsWith('@episode_detail_') || 
                k.startsWith('@movie_detail_')
              );
              
              if (cacheKeys.length > 0) {
                await AsyncStorage.multiRemove(cacheKeys);
                console.log(`${cacheKeys.length} adet eski önbellek başarıyla temizlendi.`);
                
                await AsyncStorage.setItem(cacheKey, JSON.stringify({
                  timestamp: Date.now(),
                  data: { summary, cast: slimCast, related: slimRelated }
                }));
              }
            } catch(e) {
              console.error('Önbellek temizlenirken hata:', e);
            }
          }
        }

        if (isMounted) {
          setMovieData(summary);
          setCastData(cast || []);
          
          const mappedRelated = (related || []).map((item: any) => {
             return {
                id: item.ids.trakt,
                rawTraktId: item.ids.trakt,
                tmdbId: item.ids?.tmdb,
                title: item.title
             };
          });
          setRelatedMovies(mappedRelated);
        }

        if (tmdbIdNum && isMounted) {
          const [bd, tr, pst] = await Promise.all([
            getMovieBackdrop(tmdbIdNum),
            getMovieTrailer(tmdbIdNum),
            getMoviePoster(tmdbIdNum)
          ]);
          setBackdrop(bd);
          setTrailerId(tr);
          setPoster(pst);
        }
        if (summary && !commentsData.length && isMounted) { // In case it was loaded from cache but comments weren't
           try {
             const commRes = await getMediaComments(traktIdNum, 'movie');
             if (isMounted) setCommentsData(commRes.data || []);
           } catch(e) {}
        }
      } catch (error) {
        console.error('Hata:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDetails();
    
    return () => {
      isMounted = false;
    };
  }, [id, tmdbId]);

  const handleRate = async (rating: number) => {
    try {
      setLocalRating(traktIdNum, 'movie', rating * 2); // Internal scale is 1-10
      await addRating(traktIdNum, 'movie', rating);
    } catch (e) {
      removeLocalRating(traktIdNum, 'movie');
      Alert.alert(t('common:error'), 'Puan kaydedilirken bir hata oluştu.');
      console.error(e);
    }
  };

  const handleRemoveRating = async () => {
    try {
      removeLocalRating(traktIdNum, 'movie');
      await removeRating(traktIdNum, 'movie');
    } catch (e) {
      // Optimistic revert requires knowing the old rating, but for remove we might just fetch
      Alert.alert(t('common:error'), 'Puan silinirken bir hata oluştu.');
      console.error(e);
    }
  };

  const handleMarkAsWatched = async () => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }
    if (isWatched || actionLoading) return;
    try {
      setActionLoading(true);
      await markMovieAsWatched(traktIdNum);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const isReleased = movieData?.released ? new Date(movieData.released) <= new Date() : true;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>{t('loadingMovieDetails')}</Text>
      </View>
    );
  }

  if (!movieData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{t('movieNotFound')}</Text>
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
          type="movie"
          data={movieData}
          backdrop={backdrop}
          poster={poster}
          trailerId={trailerId}
          userRating={userRating}
          isWatched={isWatched}
          isWatchlisted={isWatchlisted}
          isFavorited={isFavorited}
          onRate={handleRate}
          onRemoveRating={handleRemoveRating}
          onToggleWatchlist={() => toggleWatchlistStatus(traktIdNum, 'movie', isWatchlisted, movieData)}
          onToggleFavorite={() => toggleFavoriteStatus(traktIdNum, 'movie', isFavorited, movieData)}
          onDeleteFromHistory={() => deleteMediaFromHistory(traktIdNum, 'movie')}
          onRewatch={() => markMovieAsWatched(traktIdNum)}
        />

        <View style={styles.contentArea}>
          {/* ACTION BUTTONS */}
          <View style={styles.actionRow}>
            {isReleased ? (
              <TouchableOpacity 
                style={[styles.actionButton, isWatched && styles.actionButtonActive]}
                onPress={handleMarkAsWatched}
                disabled={isWatched || actionLoading}
                activeOpacity={0.8}
              >
                {actionLoading ? (
                  <LoadingIndicator size="small" color="#fff" />
                ) : isWatched ? (
                  <>
                    <CheckCheck color="#ffffff" size={20} style={{ marginRight: 8 }} />
                    <Text style={styles.actionButtonText}>{t('watched')}</Text>
                  </>
                ) : (
                  <>
                    <Check color="#ffffff" size={20} style={{ marginRight: 8 }} />
                    <Text style={styles.actionButtonText}>{t('iWatched')}</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={[styles.actionButton, { backgroundColor: '#333' }]}>
                <Text style={styles.actionButtonText}>{t('notAiredYet')}</Text>
              </View>
            )}
            
            {/* İleride Seçenekler menüsü buraya gelecek */}
          </View>

          {/* Comments */}
          {commentsData && commentsData.length > 0 && (() => {
            const nonSpoilerComments = commentsData.filter(c => !c.spoiler);
            const teaserComments = nonSpoilerComments.slice(0, 2);

            return (
              <View style={styles.section}>
                {/* Write Comment Button */}
                <MyInlineComment 
                  mediaId={traktIdNum}
                  mediaType="movie"
                  onPressWrite={() => setWriteCommentVisible(true)}
                  refreshTrigger={commentRefreshTrigger}
                  onDeleteSuccess={() => {
                    import('../../services/traktApi').then(({ getMediaComments }) => {
                      getMediaComments(traktIdNum, 'movie').then(res => setCommentsData(res.data || []));
                    });
                  }}
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
                  mediaType="movie"
                  onPressWrite={() => setWriteCommentVisible(true)}
                  refreshTrigger={commentRefreshTrigger}
                  onDeleteSuccess={() => {
                    import('../../services/traktApi').then(({ getMediaComments }) => {
                      getMediaComments(traktIdNum, 'movie').then(res => setCommentsData(res.data || []));
                    });
                  }}
                />
             </View>
          )}

          <MediaCast cast={castData} />

          {relatedMovies && relatedMovies.length > 0 && (
            <HorizontalMediaList 
              title={t('relatedMovies')} 
              data={relatedMovies} 
              type="movie" 
            />
          )}
        </View>

      </ScrollView>

      {/* Yorumlar Modal */}
      <CommentSheet 
        visible={commentSheetVisible} 
        onClose={() => setCommentSheetVisible(false)} 
        mediaId={traktIdNum} 
        mediaType="movie" 
      />

      {/* Yorum Yazma Modal */}
      <WriteCommentSheet
        visible={writeCommentVisible}
        onClose={() => setWriteCommentVisible(false)}
        mediaId={traktIdNum}
        mediaType="movie"
        onSuccess={() => {
          setCommentRefreshTrigger(prev => prev + 1);
          import('../../services/traktApi').then(({ getMediaComments }) => {
            getMediaComments(traktIdNum, 'movie').then(res => setCommentsData(res.data || []));
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B1120',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#a3a3a3',
    marginTop: 16,
    fontSize: 16,
  },
  contentArea: {
    paddingTop: 16,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#172033',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonActive: {
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
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
});
