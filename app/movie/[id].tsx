import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text, Dimensions, Platform, UIManager, LayoutAnimation, Alert } from 'react-native';
import LoadingIndicator from '../../components/LoadingIndicator';

import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Check, CheckCheck } from 'lucide-react-native';

import { addRating, removeRating } from '../../services/traktApi';
import { useMovieDetail } from '../../hooks/useMovieDetail';

import { useLibrarySelector, useLibraryActions } from '../../context/LibraryContext';
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
    const { t } = useTranslation('media');
  
  
  const [actionLoading, setActionLoading] = useState(false);
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [writeCommentVisible, setWriteCommentVisible] = useState(false);
  // Yorum yazma/silme sonrası MyInlineComment'in kendini tazelemesi için sayaç
  const [commentVersion, setCommentVersion] = useState(0);
  
  // Katı seçici: yalnızca film dilimleri okunur; dizi ilerlemesi gibi ilgisiz
  // store değişimlerinde bu ekran artık yeniden render olmaz.
  const { userRatingsMovies, watchedMovies, watchlistMovies, favMovies } = useLibrarySelector(s => ({
    userRatingsMovies: s.userRatingsMovies,
    watchedMovies: s.watchedMovies,
    watchlistMovies: s.watchlistMovies,
    favMovies: s.favMovies,
  }));
  const {
    setLocalRating,
    removeLocalRating,
    markMovieAsWatched,
    toggleWatchlistStatus,
    toggleFavoriteStatus,
    deleteMediaFromHistory,
  } = useLibraryActions();
  const { isGuest } = useAuth();
  
  const idStr = Array.isArray(id) ? id[0] : id;
  const { traktId: traktIdNum } = parseMediaSlug(idStr as string);

  const { mediaData, images, isLoading, refreshData, refreshComments } = useMovieDetail(traktIdNum, tmdbId as string);
  const movieData = mediaData.summary;
  const castData = mediaData.cast;
  const relatedMovies = mediaData.related;
  const commentsData = mediaData.comments;
  
  const backdrop = images.backdrop;
  const poster = images.poster;
  const trailerId = images.trailerId;

  // Kullanıcının puanını bul
  const userRatingObj = userRatingsMovies?.find((r: any) => r.movie?.ids?.trakt === traktIdNum);
  const userRating = userRatingObj ? userRatingObj.rating : null;

  // Kullanıcı filmi izlemiş mi?
  const isWatched = watchedMovies?.some((m: any) => m.movie?.ids?.trakt === traktIdNum);
  const isWatchlisted = watchlistMovies?.some((m: any) => m.movie?.ids?.trakt === traktIdNum);
  const isFavorited = favMovies?.some((m: any) => m.movie?.ids?.trakt === traktIdNum);

  const handleRate = async (rating: number) => {
    // StarSlider zaten 1-10 dahili ölçekte değer döndürür (Trakt ile aynı) — tekrar ×2 yapılmamalı.
    try {
      setLocalRating(traktIdNum, 'movie', rating);
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

  // Dizilerdeki bölüm izlemeyi geri alma ile aynı davranış: tek dokunuş,
  // onay istemeden, sayfadan çıkmadan. Eskiden bu buton izlendikten sonra
  // tamamen kilitleniyordu — geri almanın tek yolu "..." menüsündeki, onay
  // isteyen ve sayfadan dışarı atan "Kaydı Sil" seçeneğiydi.
  const handleToggleWatched = async () => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }
    if (actionLoading) return;
    try {
      setActionLoading(true);
      if (isWatched) {
        await deleteMediaFromHistory(traktIdNum, 'movie');
      } else {
        await markMovieAsWatched(traktIdNum);
      }
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
                onPress={handleToggleWatched}
                disabled={actionLoading}
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
                  refreshTrigger={commentVersion}
                  onDeleteSuccess={() => { setCommentVersion(v => v + 1); refreshComments(); }}
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
                  refreshTrigger={commentVersion}
                  onDeleteSuccess={() => { setCommentVersion(v => v + 1); refreshComments(); }}
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
          setCommentVersion(v => v + 1);
          refreshData();
          refreshComments();
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
