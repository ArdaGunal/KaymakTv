import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, UIManager, LayoutAnimation } from 'react-native';
import DetailHeroSkeleton from '../../components/skeletons/DetailHeroSkeleton';

import { useLocalSearchParams, useRouter, Stack } from 'expo-router';

import { useShowDetail } from '../../hooks/useShowDetail';
import { useShowDetailHandlers } from '../../hooks/useShowDetailHandlers';
import { getShowBackdrop, getShowTrailer, getShowPoster } from '../../services/tmdbApi';
import { useLibrarySelector, useLibraryActions } from '../../context/LibraryContext';
import { parseMediaSlug } from '../../utils/slugHelper';
import MediaHero from '../../components/MediaHero';
import MediaCast from '../../components/MediaCast';
import HorizontalMediaList from '../../components/HorizontalMediaList';
import Snackbar from '../../components/Snackbar';
import CommentSheet from '../../components/CommentSheet';
import MediaCommentsSection from '../../components/reviews/MediaCommentsSection';
import { useTranslation } from 'react-i18next';
import SeasonAccordion from '../../components/SeasonAccordion';
import EpisodeRatingModal from '../../components/modals/EpisodeRatingModal';
import EpisodeOptionsModal from '../../components/modals/EpisodeOptionsModal';


if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ShowDetailScreen() {
  const router = useRouter();
  const { id, tmdbId } = useLocalSearchParams(); // id is traktId
  const { t } = useTranslation('media');

  const idStr = Array.isArray(id) ? id[0] : id;
  const { traktId: traktIdNum } = parseMediaSlug(idStr as string);

  // GRANÜLER SELECTOR'lar: eskiden useLibrary() ile TÜM store subscribe
  // ediliyordu — kütüphanedeki BAŞKA bir dizinin ilerlemesi/puanı/watchlist
  // durumu (örn. arka plan senkronu) değiştiğinde bile bu ekran ve altındaki
  // useShowDetail memoizasyonu gereksiz yere yeniden render/hesaplanıyordu.
  // Her seçici yalnızca kendi dilimini okur; referansı/değeri, o dilim gerçekten
  // değişmediği sürece sabit kalır (store'daki immutable güncelleme deseni
  // sayesinde — bkz. services/library/mutations/*.ts).
  const showProgress = useLibrarySelector((s) => s.showProgressMap[traktIdNum]);
  const isWatchlisted = useLibrarySelector((s) => s.watchlistShows?.some((item: any) => item.show?.ids?.trakt === traktIdNum));
  // Takip butonu için ŞART: bu uygulamada izleme listesi "henüz başlanmadı"
  // demek — izlemeye başlanan dizi watchlist'ten düşer. `isWatched` olmadan
  // buton, kullanıcının yıllardır izlediği diziler için bile "Takip Et"
  // gösteriyordu (bkz. utils/followStatus.ts).
  const isWatched = useLibrarySelector((s) => s.watchedShows?.some((item: any) => item.show?.ids?.trakt === traktIdNum));
  const isFavorited = useLibrarySelector((s) => s.favShows?.some((item: any) => item.show?.ids?.trakt === traktIdNum));
  const isHidden = useLibrarySelector((s) => s.hiddenShowIds?.includes(traktIdNum));
  const userRatingsEpisodes = useLibrarySelector((s) => s.userRatingsEpisodes);

  // Aksiyon fonksiyonları store'a ABONE OLMAZ (bkz. context/LibraryContext.tsx
  // — useLibraryActions): servis fonksiyonları modül seviyesinde sabittir, bu
  // hook yalnızca accessToken değişince yenilenir. Store'daki hiçbir değişiklik
  // bu satırlar yüzünden ekstra render tetiklemez.
  const { toggleWatchlistStatus, toggleFavoriteStatus, toggleHiddenFromProgress, deleteMediaFromHistory } = useLibraryActions();

  // NOT: hook `refreshData` de döndürüyor ama bu ekran şu an KULLANMIYOR —
  // tek tüketicisi inceleme yayını sonrası tazelemeydi, o da gereksiz olduğu
  // için kaldırıldı (bkz. MASTER_PLAN "SONRADAN BULUNANLAR" Y1). Hook'ta
  // duruyor: pull-to-refresh eklenirse doğrudan bağlanacak.
  const { mediaData, computedSeasons, isLoading, isLoadingComments } = useShowDetail(traktIdNum, tmdbId, showProgress);
  const showData = mediaData.summary;
  const castData = mediaData.cast;
  const relatedShows = mediaData.related;
  const commentsData = mediaData.comments;
  
  
  const [backdrop, setBackdrop] = useState<string | null>(null);
  const [poster, setPoster] = useState<string | null>(null);
  const [trailerId, setTrailerId] = useState<string | null>(null);

  const [expandedSeasons, setExpandedSeasons] = useState<any>({});
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState<{season: number, episode: number, title: string, traktId?: number} | null>(null);
  const [episodeRatingModalVisible, setEpisodeRatingModalVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  // "Tekrar İzle" isteği aslında Trakt'a doğru gidiyordu ama kullanıcıya HİÇBİR
  // görsel geri bildirim yoktu (modal kapanıp bitiyordu) — bu yüzden "çalışmıyor
  // gibi" hissettiriyordu. Diğer aksiyonlarla (izlemeyi geri al) aynı Snackbar
  // deseniyle kısa bir onay mesajı eklendi.
  const [rewatchSnackbarVisible, setRewatchSnackbarVisible] = useState(false);

  // Handler hook'u.
  // NOT: `seasonLoading`, `handleMarkSeason` ve `snackbarData` BİLİNÇLİ OLARAK
  // buradan alınmıyor. Sezon işaretleme mantığı `SeasonAccordion.tsx`'e taşındı
  // (orada misafir kontrolü, yayınlanmamış bölüm ayıklama ve "Tekrar İzle /
  // Geçmişi Sil" menüsü de var — bu ekranda kalan kopya çok daha zayıftı ve
  // hiçbir yere bağlı değildi). `snackbarData`'nın DEĞERİNİ ise yalnızca
  // hook'un kendi `handleUndoUnwatch`'ı okuyor; bu ekranın yalnızca yazması
  // (`setSnackbarData`) yeterli.
  const {
    userRating,
    localLoadingOption,
    setSnackbarData,
    handleRate,
    handleRemoveRating,
    handleRateEpisode: hookHandleRateEpisode,
    handleRemoveEpisodeRating: hookHandleRemoveEpisodeRating,
    handleUnwatchEpisode: hookHandleUnwatchEpisode,
    handleRewatchEpisode: hookHandleRewatchEpisode,
    handleUndoUnwatch,
  } = useShowDetailHandlers({ traktIdNum, id, t });

  const handleUnwatchEpisode = async () => {
    const success = await hookHandleUnwatchEpisode(selectedEpisode);
    if (success) {
      setSnackbarData({ showId: traktIdNum, season: selectedEpisode!.season, episode: selectedEpisode!.episode });
      setSnackbarVisible(true);
      setSelectedEpisode(null);
    }
  };

  const handleRewatchEpisode = async () => {
    const success = await hookHandleRewatchEpisode(selectedEpisode);
    if (success) {
      setSelectedEpisode(null);
      setRewatchSnackbarVisible(true);
    }
  };

  const handleUndoUnwatchClick = async () => {
    const success = await handleUndoUnwatch();
    if (success) {
      setSnackbarVisible(false);
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
        } catch (error) {
          console.error('TMDB veri çekme hatası (show detail):', error);
        }
      }
    };
    fetchTmdb();
    return () => { isMounted = false; };
  }, [tmdbId]);

  const handleRateEpisode = async (rating: number) => {
    if (!selectedEpisode?.traktId) return;
    const success = await hookHandleRateEpisode(selectedEpisode.traktId, rating);
    if (success) {
      setEpisodeRatingModalVisible(false);
      setSelectedEpisode(null);
    }
  };

  const handleRemoveEpisodeRating = async () => {
    if (!selectedEpisode?.traktId) return;
    const success = await hookHandleRemoveEpisodeRating(selectedEpisode.traktId);
    if (success) {
      setEpisodeRatingModalVisible(false);
      setSelectedEpisode(null);
    }
  };

  const toggleSeason = (seasonNum: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSeasons((prev: any) => ({ ...prev, [seasonNum]: !prev[seasonNum] }));
  };

  if (isLoading) {
    return <DetailHeroSkeleton />;
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
          isWatched={isWatched}
          isFavorited={isFavorited}
          isHidden={!!isHidden}
          onRate={handleRate}
          onRemoveRating={handleRemoveRating}
          onToggleWatchlist={() => toggleWatchlistStatus(traktIdNum, 'show', isWatchlisted, showData)}
          onToggleFavorite={() => toggleFavoriteStatus(traktIdNum, 'show', isFavorited, showData)}
          onHideFromProgress={() => toggleHiddenFromProgress(traktIdNum, 'show', !!isHidden)}
          onDeleteFromHistory={() => deleteMediaFromHistory(traktIdNum, 'show')}
        />

        <View style={styles.contentArea}>
          <MediaCast cast={castData} />

          {/* ── KaymakTV İncelemeleri ──────────────────────────────────
              Kendi sosyal evrenimiz: yanıt/beğeni burada yaşar, yazma işlemi
              Trakt'a DA gider (dual-write). Aşağıdaki "Trakt Topluluğu"
              bölümünden BİLİNÇLİ olarak ayrı — birleşik liste reddedildi
              (bkz. docs/REVIEWS_PLAN.md §4.2). */}
          <View style={styles.section}>
            <MediaCommentsSection
              mediaId={traktIdNum}
              mediaType="show"
              mediaTitle={showData?.title ?? ''}
              // URL'de tmdbId yoksa Trakt özetinden gelen değeri kullan —
              // `tmdb_id` inceleme satırında ZORUNLU (bkz. REVIEWS_PLAN §1.2).
              tmdbId={Number(showData?.ids?.tmdb ?? tmdbId) || undefined}
              // İnceleme Trakt'a da yazıldığı için aşağıdaki "Trakt Topluluğu"
              // listesi de bayatlar — eski WriteCommentSheet.onSuccess'in
              // yaptığı tazelemenin aynısı.
              // ── Trakt bloğu (salt okunur kuyruk) ─────────────────
              // Artık AYRI bir bölüm değil: tek kesintisiz listenin
              // altında akıyor (bkz. MediaCommentsSection başlığı).
              traktComments={commentsData}
              isLoadingTraktComments={isLoadingComments}
              onSeeAllTrakt={() => setCommentSheetVisible(true)}
            />
          </View>


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
                  seasonProgress={season.seasonProgress}
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

      <Snackbar
        visible={snackbarVisible}
        message={t('episodeUnwatched')}
        actionText={t('undo')}
        onAction={handleUndoUnwatchClick}
        onDismiss={() => setSnackbarVisible(false)}
        duration={4000}
      />

      <Snackbar
        visible={rewatchSnackbarVisible}
        message={t('rewatchConfirmation')}
        onDismiss={() => setRewatchSnackbarVisible(false)}
        duration={2500}
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
