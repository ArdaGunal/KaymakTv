import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, TouchableWithoutFeedback, Platform } from 'react-native';
import LoadingIndicator from '../../components/LoadingIndicator';

import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Star, X, Info, Heart, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';

import { addRating, removeRating } from '../../services/traktApi';
import { useEpisodeDetail } from '../../hooks/useEpisodeDetail';
import { getEpisodeStill } from '../../services/tmdbApi';
import EpisodeCheckButton from '../../components/EpisodeCheckButton';
import StarSlider from '../../components/StarSlider';
import CommentSheet from '../../components/CommentSheet';
import WriteCommentSheet from '../../components/WriteCommentSheet';
import MyInlineComment from '../../components/MyInlineComment';
import { useLibrary } from '../../context/LibraryContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

export default function EpisodeDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, showId, showTmdbId, showSlug, season, episode, showName } = useLocalSearchParams();
  const { userRatingsEpisodes, refreshLibrary, showProgressMap, unwatchEpisode } = useLibrary();
  const { t } = useTranslation('media');
  const { mediaData, isLoading, refreshData } = useEpisodeDetail(showId, showTmdbId, season, episode);
  const episodeData = mediaData.detail;
  const commentsData = mediaData.comments;
  const castData = mediaData.cast;
  const stillUrl = mediaData.stillUrl;

  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [writeCommentVisible, setWriteCommentVisible] = useState(false);
  const [isCheckLoading, setIsCheckLoading] = useState(false);

  const [isWebViewVisible, setIsWebViewVisible] = useState(false);
  const [isWebViewLoading, setIsWebViewLoading] = useState(true);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<number, boolean>>({});

  const toggleSpoiler = (commentId: number) => {
    setRevealedSpoilers(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const epTraktId = parseInt(id as string, 10);
  const myRating = userRatingsEpisodes?.find((r: any) => r.episode?.ids?.trakt === epTraktId)?.rating;

  const handleRate = async (val: number) => {
    try {
      await addRating(epTraktId, 'episode', val);
      setRatingModalVisible(false);
      refreshLibrary();
    } catch(e) { console.error(e) }
  };

  const handleRemoveRating = async () => {
    try {
      await removeRating(epTraktId, 'episode');
      setRatingModalVisible(false);
      refreshLibrary();
    } catch(e) { console.error(e) }
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
  const rating = episodeData?.rating ? episodeData.rating.toFixed(1) : '-';
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

          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft color="#fff" size={24} />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.showName} numberOfLines={1}>{showName}</Text>
            <Text style={styles.episodeIdentifier}>{t('seasonEpisodeIdentifier', { season: season, episode: episode })}</Text>
            <Text style={styles.episodeTitle}>{title}</Text>
            
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{firstAired}</Text>
              <View style={styles.ratingBadge}>
                <Star color="#facc15" size={14} fill="#facc15" />
                <Text style={styles.ratingText}>{rating}</Text>
                <Text style={styles.votesText}>({votes})</Text>
              </View>
              <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity 
                  onPress={() => setRatingModalVisible(true)}
                  style={{ marginRight: 12, alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 22, backgroundColor: myRating ? '#3b82f6' : 'rgba(255,255,255,0.1)' }}
                >
                  <Star color={myRating ? "#fff" : "#a3a3a3"} size={20} fill={myRating ? "#fff" : "transparent"} />
                </TouchableOpacity>
                {(() => {
                  const sNum = parseInt(season as string, 10);
                  const eNum = parseInt(episode as string, 10);
                  const traktIdNum = parseInt(showId as string, 10);
                  const isWatchedLocal = showProgressMap[traktIdNum]?.seasons?.find((s:any) => s.number === sNum)?.episodes?.find((e:any) => e.number === eNum)?.completed;

                  const handleUnwatch = async () => {
                    setIsCheckLoading(true);
                    try {
                      await unwatchEpisode(traktIdNum, sNum, eNum);
                    } catch(e) {
                      console.error(e);
                    } finally {
                      setIsCheckLoading(false);
                    }
                  };

                  if (isWatchedLocal) {
                    return (
                      <TouchableOpacity 
                        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2 }}
                        onPress={() => {
                          Alert.alert(t('unwatch'), t('unwatchConfirm'), [
                            { text: t('cancel'), style: 'cancel' },
                            { text: t('remove'), onPress: handleUnwatch }
                          ]);
                        }}
                        disabled={isCheckLoading}
                      >
                        {isCheckLoading ? (
                          <LoadingIndicator size="small" color="#fff" />
                        ) : (
                          <Check size={20} color="#fff" strokeWidth={3} />
                        )}
                      </TouchableOpacity>
                    );
                  }

                  // Bölüm yayın tarihi yoksa veya gelecekteyse butonu GÖSTERME (Sadece TBA/Tarih yazsın)
                  const isFutureOrTBA = !episodeData?.first_aired || new Date(episodeData.first_aired) > new Date();
                  if (isFutureOrTBA) {
                    return (
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                        <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 12 }}>
                          {!episodeData?.first_aired ? 'TBA' : t('notAiredYet', { defaultValue: 'Yayınlanmadı' })}
                        </Text>
                      </View>
                    );
                  }

                  return (
                    <EpisodeCheckButton 
                      traktId={traktIdNum}
                      season={sNum}
                      episode={eNum}
                      showName={showName as string}
                    />
                  );
                })()}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.contentArea}>
          {/* Overview */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('overview')}</Text>
            <Text style={styles.overviewText}>{overview}</Text>
          </View>

          {/* Cast */}
          {castData && castData.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>{t('mainCast')}</Text>
                <TouchableOpacity onPress={() => {
                  if (Platform.OS === 'web') {
                    window.open(`https://trakt.tv/shows/${showSlug}/people`, '_blank');
                  } else {
                    setIsWebViewVisible(true);
                  }
                }}>
                  <Text style={styles.seeAllText}>{t('seeAll')}</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                {castData.map((castItem: any, idx: number) => {
                  const person = castItem.person;
                  // GÜVENLİK KONTROLLERİ:
                  const personName = person?.name || t('unnamed');
                  const personId = person?.ids?.trakt || `fallback-${idx}`;

                  return (
                    <View key={personId} style={styles.castItem}>
                      <View style={styles.castPhotoPlaceholder}>
                        <Text style={{color: '#a3a3a3'}}>{personName.charAt(0)}</Text>
                      </View>
                      <Text style={styles.castName} numberOfLines={1}>{personName}</Text>
                      <Text style={styles.castCharacter} numberOfLines={1}>{castItem.characters?.[0] || t('unknown')}</Text>
                    </View>
                  )
                })}
              </ScrollView>
            </View>
          )}

          {/* Comments */}
          {commentsData && commentsData.length > 0 && (() => {
            const nonSpoilerComments = commentsData.filter(c => !c.spoiler);
            const teaserComments = nonSpoilerComments.slice(0, 2);

            return (
              <View style={styles.section}>
                {/* Write Comment Button */}
                <MyInlineComment 
                  mediaId={parseInt(showId as string, 10)}
                  mediaType="episode"
                  episodeTraktId={episodeData?.ids?.trakt}
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
        </View>
      </ScrollView>

      {/* RATING MODAL */}
      <Modal visible={ratingModalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setRatingModalVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 }}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={{ backgroundColor: '#0B1120', borderRadius: 20, padding: 24, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>{t('rateEpisode')}</Text>
                <StarSlider 
                  initialRating={myRating} 
                  onRate={handleRate} 
                  onRemove={myRating ? handleRemoveRating : undefined}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* WEBVIEW MODAL */}
      {Platform.OS !== 'web' && (
        <Modal
          visible={isWebViewVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setIsWebViewVisible(false)}
        >
          <View style={[styles.modalContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setIsWebViewVisible(false)} style={styles.modalCloseButton}>
                <X color="#fff" size={24} />
                <Text style={styles.modalCloseText}>{t('close')}</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.webViewContainer}>
              {isWebViewLoading && (
                <View style={styles.webViewLoader}>
                  <LoadingIndicator size="large" color="#3b82f6" />
                </View>
              )}
              <WebView 
                source={{ uri: `https://trakt.tv/shows/${showSlug}/people` }} 
                style={styles.webView}
                onLoadStart={() => setIsWebViewLoading(true)}
                onLoadEnd={() => setIsWebViewLoading(false)}
              />
            </View>
          </View>
        </Modal>
      )}

      <CommentSheet 
        visible={commentSheetVisible} 
        onClose={() => setCommentSheetVisible(false)} 
        mediaId={parseInt(showId as string, 10)}
        mediaType="episode"
        season={parseInt(season as string, 10)}
        episode={parseInt(episode as string, 10)}
      />

      {/* Yorum Yazma Modal */}
      <WriteCommentSheet
        visible={writeCommentVisible}
        onClose={() => setWriteCommentVisible(false)}
        mediaId={parseInt(showId as string, 10)}
        mediaType="episode"
        episodeTraktId={episodeData?.ids?.trakt}
        onSuccess={() => {
          refreshData();
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
  headerContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, zIndex: 5 },
  showName: { fontSize: 14, color: '#3b82f6', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  episodeIdentifier: { fontSize: 13, color: '#a3a3a3', marginBottom: 6 },
  episodeTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  metaText: { color: '#d4d4d4', fontSize: 13, fontWeight: '600' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0B1120', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  ratingText: { color: '#facc15', fontSize: 13, fontWeight: 'bold' },
  votesText: { color: '#737373', fontSize: 11 },
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
