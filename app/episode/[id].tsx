import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import DetailHeroSkeleton from '../../components/skeletons/DetailHeroSkeleton';

import { useLocalSearchParams, useRouter } from 'expo-router';

import LoadFailedState from '../../components/LoadFailedState';
import { useEpisodeDetail } from '../../hooks/useEpisodeDetail';
import { getShowBackdrop } from '../../services/tmdbApi';
import { useMediaReviews } from '../../hooks/useMediaReviews';
import { formatRating } from '../../utils/formatRating';
import RatingModal from '../../components/RatingModal';
import CommentSheet from '../../components/CommentSheet';
import MediaCommentsSection from '../../components/reviews/MediaCommentsSection';
import SectionErrorBoundary from '../../components/SectionErrorBoundary';
import { formatEpisodeCode } from '../../features/feed/services/feedPublish';
import MediaCast from '../../components/MediaCast';
import { useLibrary } from '../../context/LibraryContext';
import { getProgressBarColor } from '../../utils/progressBarColor';
import { useEpisodeCast } from '../../hooks/useEpisodeCast';
import { parseEpisodeSlug, formatSlugToTitle, generateMediaSlug, generateEpisodeSlug } from '../../utils/slugHelper';
import { useTranslation } from 'react-i18next';
import { useAppBack } from '../../hooks/useAppBack';
import { useEpisodeActions } from '../../hooks/useEpisodeActions';
import { useShowDetail } from '../../hooks/useShowDetail';
import { useDetailLayout } from '../../hooks/useDetailLayout';
import DetailWebLayout from '../../components/detail/DetailWebLayout';
import SeasonsRailWeb from '../../components/detail/SeasonsRailWeb';
import EpisodeHeroWeb from '../../components/detail/EpisodeHeroWeb';
import EpisodeHeroMobile from '../../components/detail/EpisodeHeroMobile';
import { styles } from '../../components/detail/episodeDetail.styles';

export default function EpisodeDetailScreen() {
  const router = useRouter();
  const { id, showTmdbId } = useLocalSearchParams();
  
  const idStr = Array.isArray(id) ? id[0] : id;
  const { showTraktId: parsedShowId, showSlug, season, episode, epTraktId } = parseEpisodeSlug(idStr as string);
  const showName = formatSlugToTitle(showSlug);
  const showId = parsedShowId;
  const traktIdNum = parsedShowId;
  // Yazma islemleri artik `useEpisodeActions` icinde (bkz. o dosyanin basligi);
  // burada yalnizca OKUMA dilimleri kaliyor.
  const { userRatingsEpisodes, showProgressMap, hiddenShowIds } = useLibrary();
  const { t } = useTranslation('media');
  // `refreshData` → `LoadFailedState.onRetry` (bkz. app/show/[id].tsx'teki aynı not).
  const { mediaData, isLoading, isLoadingComments, hasError, isCircuitBreakerError, refreshData } = useEpisodeDetail(String(showId), showTmdbId, String(season), String(episode));
  const episodeData = mediaData.detail;
  const commentsData = mediaData.comments;
  const stillUrl = mediaData.stillUrl;

  // Y6 (Madde 244): bkz. app/show/[id].tsx'teki aynı not. `mediaId` dizinin
  // traktId'si (`showId`) — bölüm incelemesi `episodeNumber` ile ayrıştırılır,
  // `useMediaReviews`'in kendi `mediaType`'ı hep 'show' (FeedMediaType'ta
  // 'episode' yok, bkz. features/feed/types.ts).
  const reviewsState = useMediaReviews({
    mediaId: showId as number,
    mediaType: 'show',
    mediaTitle: `${showName} ${formatEpisodeCode(Number(season), Number(episode))}`,
    tmdbId: Number(showTmdbId) || undefined,
    episodeNumber: formatEpisodeCode(Number(season), Number(episode)),
  });

  const { cast: epCast, voteActor } = useEpisodeCast(
    showTmdbId ? parseInt(showTmdbId as string, 10) : null,
    season,
    episode
  );

  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);

  const layout = useDetailLayout();

  // Masaüstü banner'ı için DİZİNİN kapak görseli. Bölüm karesini banner
  // olarak da kullanmak aynı fotoğrafı sayfada iki kez gösteriyordu (canlı
  // testte görüldü). Yalnızca masaüstü web'de çekilir — mobilde bu efekt hiç
  // çalışmaz, ekstra istek de olmaz.
  const [showBackdrop, setShowBackdrop] = useState<string | null>(null);
  useEffect(() => {
    if (!layout.isDesktopWeb || !showTmdbId) return;
    let alive = true;
    getShowBackdrop(parseInt(showTmdbId as string, 10))
      .then((bd) => { if (alive) setShowBackdrop(bd); })
      .catch(() => { /* Banner dekoratif — düşerse düz yüzeye düşülür. */ });
    return () => { alive = false; };
  }, [layout.isDesktopWeb, showTmdbId]);
  // Sag gezinme rayi (sezonlar) YALNIZCA masaustu web'de gerekiyor.
  // `useShowDetail` `traktId` 0 iken aga hic cikmaz (kendi korumasi),
  // dolayisiyla mobilde tek bir ekstra istek bile olusmaz.
  const railData = useShowDetail(layout.isDesktopWeb ? traktIdNum : 0, showTmdbId, showProgressMap[traktIdNum]);
  const [expandedSeasons, setExpandedSeasons] = useState<Record<number, boolean>>({ [Number(season)]: true });

  const actions = useEpisodeActions({
    showTraktId: traktIdNum,
    season,
    episode,
    epTraktId,
    slug: idStr as string,
    showName,
  });

  // bkz. hooks/useAppBack.ts — geçmiş yoksa (deep link / sayfa yenileme)
  // karşılama ekranı yerine Keşfet'e dönülür.
  const handleBack = useAppBack();

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
  const isShowHidden = (hiddenShowIds || []).includes(traktIdNum);
  const isShowFinished = !!hasShowProgress && showProgress.completed >= showProgress.aired;
  const showProgressColor = getProgressBarColor(isShowHidden, isShowFinished);

  const handleRate = async (val: number) => {
    if (await actions.rate(val)) setRatingModalVisible(false);
  };

  const handleRemoveRating = async () => {
    if (await actions.clearRating()) setRatingModalVisible(false);
  };

  const openRating = () => {
    if (actions.guardGuest()) setRatingModalVisible(true);
  };

  if (isLoading) {
    return <DetailHeroSkeleton hasPoster={false} />;
  }

  // 🔴 Y17: bu dal EKSİKTİ. Aşağıdaki fallback zinciri (title/overview/
  // firstAired) hata durumunda sayfayı BAŞARIYLA AÇILMIŞ gibi çiziyor,
  // first_aired boş olduğu için "TBA" rozeti basıp "İzledim" butonunu
  // gizliyordu — kullanıcıya "bu bölüm yayınlanmadı" denmiş oluyordu.
  if (hasError || !episodeData) {
    return (
      <LoadFailedState
        onRetry={refreshData}
        onBack={handleBack}
        text={isCircuitBreakerError ? t('loadFailedCircuitBreakerText', 'Çok fazla deneme yapıldı — birkaç saniye bekleyip tekrar dene.') : undefined}
      />
    );
  }

  const title = episodeData?.title || t('episodeNum', { number: episode });
  const overview = episodeData?.overview || t('noOverviewYet');
  const firstAired = episodeData?.first_aired ? new Date(episodeData.first_aired).toLocaleDateString('tr-TR') : t('noDate');
  const rating = formatRating(episodeData?.rating);
  const votes = episodeData?.votes ? episodeData.votes.toLocaleString('tr-TR') : '0';

  // ── Her iki duzenin PAYLASTIGI parcalar ───────────────────────────────
  const commentsSection = (
    <MediaCommentsSection
      reviewsState={reviewsState}
      traktComments={commentsData}
      isLoadingTraktComments={isLoadingComments}
      onSeeAllTrakt={() => setCommentSheetVisible(true)}
    />
  );

  const castSection = epCast && epCast.length > 0 ? (
    <SectionErrorBoundary label="episode-cast">
      <MediaCast cast={epCast} onActorPress={voteActor} />
    </SectionErrorBoundary>
  ) : null;

  const overlays = (
    <>
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
        reviewsState={reviewsState}
      />
    </>
  );

  // ── MASAUSTU WEB (>=1024px) ───────────────────────────────────────────
  // Solda bolum icerigi, sagda dizinin sezon/bolum rayi. Kullanicinin
  // bulundugu sezon acik gelir, bulundugu bolum vurgulanir.
  if (layout.isDesktopWeb) {
    const airStatus: 'aired' | 'unaired' | 'tba' = !episodeData?.first_aired
      ? 'tba'
      : (new Date(episodeData.first_aired) > new Date() ? 'unaired' : 'aired');

    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 72 }}>
          <DetailWebLayout
            metrics={layout}
            backdrop={showBackdrop}
            left={
              <>
                <EpisodeHeroWeb
                  showName={showName}
                  title={title}
                  season={season}
                  episode={episode}
                  firstAired={firstAired}
                  stillUrl={stillUrl}
                  rating={rating}
                  votes={episodeData?.votes || 0}
                  myRating={myRating}
                  isWatched={actions.isWatchedLocal}
                  isCheckLoading={actions.isCheckLoading}
                  airStatus={airStatus}
                  hasShowProgress={!!hasShowProgress}
                  showProgressPercentage={showProgressPercentage}
                  showProgressColor={showProgressColor}
                  onBack={handleBack}
                  onShare={actions.share}
                  onShowPress={handleShowPress}
                  onOpenRating={openRating}
                  onToggleWatched={actions.toggleWatched}
                />

                <View style={styles.webBlock}>
                  <Text style={styles.sectionTitle}>{t('overview')}</Text>
                  <Text style={styles.webOverview}>{overview}</Text>
                </View>

                {castSection ? <View style={[styles.webBlock, styles.webFlush]}>{castSection}</View> : null}
                <View style={styles.webBlock}>{commentsSection}</View>
              </>
            }
            rail={
              <SeasonsRailWeb
                seasons={railData.computedSeasons || []}
                showTraktId={traktIdNum}
                showSlug={showSlug}
                showTitle={showName}
                showTmdbId={showTmdbId as string}
                expandedSeasons={expandedSeasons}
                onToggleSeason={(n) => setExpandedSeasons((prev) => ({ ...prev, [n]: !prev[n] }))}
                onSelectEpisode={(ep, seasonNumber) => {
                  // Bu ekranda "bolum secenekleri" modali yok — ray bir GEZINME
                  // araci, o yuzden secim dogrudan o bolume goturur (buton olu
                  // kalmasin).
                  const epId = ep?.ids?.trakt;
                  if (!epId) return;
                  const epSlug = generateEpisodeSlug(traktIdNum, showSlug, showName, seasonNumber, ep.number, epId);
                  router.push(`/episode/${epSlug}${showTmdbId ? `?showTmdbId=${showTmdbId}` : ''}`);
                }}
                activeSeasonNumber={season}
                activeEpisodeNumber={episode}
              />
            }
          />
        </ScrollView>
        {overlays}
      </View>
    );
  }

  // ── MOBIL (ve dar web) — YERLESIM DEGISTIRILMEDI ──────────────────────
  return (
    <View style={styles.container}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        <EpisodeHeroMobile
          stillUrl={stillUrl}
          showName={showName}
          title={title}
          season={season}
          episode={episode}
          firstAired={firstAired}
          rating={rating}
          votes={votes}
          episodeData={episodeData}
          myRating={myRating}
          isWatchedLocal={actions.isWatchedLocal}
          isCheckLoading={actions.isCheckLoading}
          hasShowProgress={!!hasShowProgress}
          showProgressPercentage={showProgressPercentage}
          showProgressColor={showProgressColor}
          handleBack={handleBack}
          handleShare={actions.share}
          handleShowPress={handleShowPress}
          openRating={openRating}
          onToggleWatched={actions.toggleWatched}
        />

        <View style={styles.contentArea}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('overview')}</Text>
            <Text style={styles.overviewText}>{overview}</Text>
          </View>

          {/* Y20: bölüm ekranı özgün listede YOKTU ama aynı riski taşıyor —
              Trakt'ın ham kadro verisini okuyor. Dizi/film ekranlarıyla
              aynı sınır. (Boşsa `castSection` zaten null.) */}
          {castSection}

          {/* ── Yorumlar: tek akış, iki blok ────────────────────────────
              Dizi/film sayfalarıyla AYNI bileşen. Tek farkı `episodeNumber`:
              yazılan inceleme BU BÖLÜME bağlanıyor ve `in_feed` türetilmiş
              kolonu (020) sayesinde ANA AKIŞA DÜŞMÜYOR — kullanıcı kararı:
              bir sezonu maratonlayan kişi akışı 20 inceleme kartıyla
              doldurmasın (bkz. docs/design/REVIEWS_PLAN.md §8). */}
          <View style={styles.section}>{commentsSection}</View>
        </View>
      </ScrollView>

      {overlays}
    </View>
  );
}
