import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, UIManager, LayoutAnimation } from 'react-native';
import DetailHeroSkeleton from '../../components/skeletons/DetailHeroSkeleton';

import { useLocalSearchParams, Stack } from 'expo-router';

import LoadFailedState from '../../components/LoadFailedState';
import SectionErrorBoundary from '../../components/SectionErrorBoundary';
import { useShowDetail } from '../../hooks/useShowDetail';
import { useShowDetailHandlers } from '../../hooks/useShowDetailHandlers';
import { useMediaReviews } from '../../hooks/useMediaReviews';
import { getShowBackdrop, getShowTrailer, getShowPoster } from '../../services/tmdbApi';
import { useLibrarySelector, useLibraryActions } from '../../context/LibraryContext';
import { parseMediaSlug } from '../../utils/slugHelper';
import MediaHero from '../../components/MediaHero';
import { useAppBack } from '../../hooks/useAppBack';
import MediaCast from '../../components/MediaCast';
import HorizontalMediaList from '../../components/HorizontalMediaList';
import MediaCommentsSection from '../../components/reviews/MediaCommentsSection';
import { useTranslation } from 'react-i18next';
import SeasonAccordion from '../../components/SeasonAccordion';
import { useDetailLayout } from '../../hooks/useDetailLayout';
import DetailWebLayout from '../../components/detail/DetailWebLayout';
import SeasonsRailWeb from '../../components/detail/SeasonsRailWeb';
import ShowDetailOverlays from '../../components/detail/ShowDetailOverlays';


if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ShowDetailScreen() {
  const handleBack = useAppBack();
  // Masaustu web'de duzen cift sutuna gecer; native'de HER ZAMAN false.
  const layout = useDetailLayout();
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

  // `refreshData` → `LoadFailedState.onRetry` (aşağıda). Y1'de eski tüketicisi
  // (inceleme yayını sonrası tazeleme) kaldırılmıştı ve bir süre boşta kaldı;
  // hata ekranının "Tekrar Dene"si eklenince yeniden bağlandı.
  const { mediaData, computedSeasons, isLoading, isLoadingComments, hasError, isCircuitBreakerError, refreshData } = useShowDetail(traktIdNum, tmdbId, showProgress);
  const showData = mediaData.summary;
  const castData = mediaData.cast;
  const relatedShows = mediaData.related;
  const commentsData = mediaData.comments;

  // Y6 (Madde 244): tek çağrı — `MediaCommentsSection` (inline) VE
  // `CommentSheet` ("Tümünü Gör") AYNI reviewsState'i tüketir, bkz.
  // MediaCommentsSection.tsx başlığı.
  const reviewsState = useMediaReviews({
    mediaId: traktIdNum,
    mediaType: 'show',
    mediaTitle: showData?.title ?? '',
    tmdbId: Number(showData?.ids?.tmdb ?? tmdbId) || undefined,
  });

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

  // 🔴 Y17: burada eskiden "Dizi bulunamadı" yazıyordu — YANLIŞ TEŞHİS.
  // Dizi duruyor; Trakt erişilemediği için yüklenemedi. Ve "Tekrar Dene"
  // yoktu, yani geçici bir ağ hatası kullanıcıyı sayfadan kovuyordu.
  if (hasError || !showData) {
    return (
      <LoadFailedState
        onRetry={refreshData}
        onBack={handleBack}
        text={isCircuitBreakerError ? t('loadFailedCircuitBreakerText', 'Çok fazla deneme yapıldı — birkaç saniye bekleyip tekrar dene.') : undefined}
      />
    );
  }

  // ── Her iki duzenin PAYLASTIGI parcalar (AI_RULES 2.5: kopya yok) ─────
  // Y20: her blok kendi hata sinirinda — tek bir render istisnasi eskiden
  // kok ErrorBoundary'ye cikip TUM SAYFAYI beyaz ekrana dusuruyordu.
  const hero = (
    <SectionErrorBoundary label="show-hero">
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
    </SectionErrorBoundary>
  );

  const castSection = (
    <SectionErrorBoundary label="show-cast">
      <MediaCast cast={castData} />
    </SectionErrorBoundary>
  );

  // Trakt blogu (salt okunur kuyruk) AYRI bir bolum degil: tek kesintisiz
  // listenin altinda akiyor (bkz. MediaCommentsSection basligi).
  const commentsSection = (
    <MediaCommentsSection
      reviewsState={reviewsState}
      traktComments={commentsData}
      isLoadingTraktComments={isLoadingComments}
      onSeeAllTrakt={() => setCommentSheetVisible(true)}
    />
  );

  const relatedSection = relatedShows && relatedShows.length > 0 ? (
    <SectionErrorBoundary label="show-related">
      <HorizontalMediaList title={t('relatedShows')} data={relatedShows} type="show" />
    </SectionErrorBoundary>
  ) : null;

  // Iki propta da ayni arama yapiliyordu — tek yerde turetiliyor.
  const selectedEpisodeRating = userRatingsEpisodes?.find((r: any) => r.episode?.ids?.trakt === selectedEpisode?.traktId);

  const overlays = (
    <ShowDetailOverlays
      showTraktId={traktIdNum}
      reviewsState={reviewsState}
      selectedEpisode={selectedEpisode}
      onCloseEpisodeOptions={() => setSelectedEpisode(null)}
      loadingOption={localLoadingOption}
      onOpenEpisodeRating={() => setEpisodeRatingModalVisible(true)}
      onRewatchEpisode={handleRewatchEpisode}
      onUnwatchEpisode={handleUnwatchEpisode}
      episodeRatingVisible={episodeRatingModalVisible}
      onCloseEpisodeRating={() => setEpisodeRatingModalVisible(false)}
      episodeInitialRating={selectedEpisodeRating?.rating}
      onRateEpisode={handleRateEpisode}
      onRemoveEpisodeRating={selectedEpisodeRating ? handleRemoveEpisodeRating : undefined}
      commentSheetVisible={commentSheetVisible}
      onCloseCommentSheet={() => setCommentSheetVisible(false)}
      unwatchSnackbarVisible={snackbarVisible}
      onUndoUnwatch={handleUndoUnwatchClick}
      onDismissUnwatchSnackbar={() => setSnackbarVisible(false)}
      rewatchSnackbarVisible={rewatchSnackbarVisible}
      onDismissRewatchSnackbar={() => setRewatchSnackbarVisible(false)}
    />
  );

  // ── MASAUSTU WEB (>=1024px) ───────────────────────────────────────────
  // Asimetrik cift sutun: solda icerik, sagda YAPISKAN sezon rayi. Sezonlar
  // mobilde oldugu yerde (icerigin icinde, alt alta) kalmaya devam ediyor.
  if (layout.isDesktopWeb) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          <DetailWebLayout
            metrics={layout}
            backdrop={backdrop}
            left={
              <>
                {hero}
                <View style={[styles.webBlock, styles.webFlush]}>{castSection}</View>
                <View style={styles.webBlock}>{commentsSection}</View>
                {relatedSection ? <View style={[styles.webBlock, styles.webFlush]}>{relatedSection}</View> : null}
              </>
            }
            rail={
              <SeasonsRailWeb
                seasons={computedSeasons || []}
                showTraktId={traktIdNum}
                showSlug={showData?.ids?.slug}
                showTitle={showData?.title}
                showTmdbId={tmdbId as string}
                expandedSeasons={expandedSeasons}
                onToggleSeason={toggleSeason}
                onSelectEpisode={(ep, seasonNumber) => setSelectedEpisode({ season: seasonNumber, episode: ep.number, title: ep.title, traktId: ep?.ids?.trakt })}
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
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        
        {/* Y20: MediaHero Trakt/TMDB HAM verisini en çok okuyan bileşen
            (yayın tarihi, süre, tür listesi, puan) — yani beklenmedik bir
            alan geldiğinde ilk çöken burası. Sınır olmadan bu istisna kök
            ErrorBoundary'ye çıkıp TÜM SAYFAYI beyaz ekrana düşürüyordu;
            artık yalnızca hero kutusu düşüyor, kadro/inceleme/sezonlar
            çalışmaya devam ediyor. `silent` DEĞİL: hero sayfanın birincil
            içeriği, sessizce kaybolması kullanıcıyı yanıltır. */}
        {hero}

        <View style={styles.contentArea}>
          {/* Y20: Trakt/TMDB ham verisini okuyan bloklar kendi hata
              sınırlarında. Eskiden tek bir render istisnası kök
              ErrorBoundary'ye çıkıp TÜM SAYFAYI düşürüyordu — S13'ün
              gerekçesi buydu ama pratikte yalnızca bir yerde uygulanmıştı. */}
          {castSection}

          {/* ── KaymakTV İncelemeleri ──────────────────────────────────
              Kendi sosyal evrenimiz: yanıt/beğeni burada yaşar, yazma işlemi
              Trakt'a DA gider (dual-write). Aşağıdaki "Trakt Topluluğu"
              bölümünden BİLİNÇLİ olarak ayrı — birleşik liste reddedildi
              (bkz. docs/design/REVIEWS_PLAN.md §4.2). */}
          <View style={styles.section}>{commentsSection}</View>


          {computedSeasons && computedSeasons.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('seasons')}</Text>
              {/* Y20: sınır SEZON BAŞINA — tüm listeyi tek sınıra sarmak,
                  bozuk TEK bir sezonun diğerlerini de götürmesi demekti
                  (feed.tsx'teki kart-başına sınırla aynı gerekçe). */}
              {computedSeasons.map((season) => (
                <SectionErrorBoundary key={season.number} label={'season:' + season.number}>
                  <SeasonAccordion
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
                </SectionErrorBoundary>
              ))}
            </View>
          )}

          {/* RELATED SHOWS */}
          {relatedSection}

        </View>
      </ScrollView>

      {overlays}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  contentArea: { padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  // Masaustu sol sutununda bloklar arasi dikey ritim.
  webBlock: { marginTop: 28 },
  // MediaCast/HorizontalMediaList kendi 16px yatay dolgusunu tasiyor —
  // masaustunde ozete gore icerlek kaliyordu, negatif margin hizaliyor.
  webFlush: { marginHorizontal: -16 },
});
