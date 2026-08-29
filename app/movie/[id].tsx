import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text, Platform, UIManager, Alert, ActivityIndicator } from 'react-native';
import DetailHeroSkeleton from '../../components/skeletons/DetailHeroSkeleton';

import { useLocalSearchParams, Stack } from 'expo-router';
import { Check, CheckCheck } from '../../components/icons';


import LoadFailedState from '../../components/LoadFailedState';
import { useMovieDetail } from '../../hooks/useMovieDetail';
import { useMediaReviews } from '../../hooks/useMediaReviews';

import { useLibrarySelector, useLibraryActions } from '../../context/LibraryContext';
import { parseMediaSlug } from '../../utils/slugHelper';
import MediaHero from '../../components/MediaHero';
import { useAppBack } from '../../hooks/useAppBack';
import { useDetailLayout } from '../../hooks/useDetailLayout';
import DetailWebLayout from '../../components/detail/DetailWebLayout';
import MediaCast from '../../components/MediaCast';
import HorizontalMediaList from '../../components/HorizontalMediaList';
import CommentSheet from '../../components/CommentSheet';
import MediaCommentsSection from '../../components/reviews/MediaCommentsSection';
import SectionErrorBoundary from '../../components/SectionErrorBoundary';
import Snackbar from '../../components/Snackbar';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function MovieDetailScreen() {
  const handleBack = useAppBack();
  // Film ekrani da MediaHero'yu paylasiyor; masaustunde ayni kabugu
  // kullanmazsa hero ortalanmamis/kenara yapisik kalirdi.
  const layout = useDetailLayout();
  const { id, tmdbId } = useLocalSearchParams(); // id is traktId
    const { t } = useTranslation('media');
  
  
  const [actionLoading, setActionLoading] = useState(false);
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  // "..." menüsündeki "Tekrar İzle": film zaten izlenmiş olduğundan ana
  // "İzledim" butonunun görünümü değişmiyor — görsel geri bildirim olmadan
  // işlem "çalışmıyor gibi" hissettiriyordu, bu yüzden kısa bir onay eklendi.
  const [rewatchSnackbarVisible, setRewatchSnackbarVisible] = useState(false);
  
  // Katı seçici: yalnızca film dilimleri okunur; dizi ilerlemesi gibi ilgisiz
  // store değişimlerinde bu ekran artık yeniden render olmaz.
  const { userRatingsMovies, watchedMovies, watchlistMovies, favMovies, hiddenMovieIds } = useLibrarySelector(s => ({
    userRatingsMovies: s.userRatingsMovies,
    watchedMovies: s.watchedMovies,
    watchlistMovies: s.watchlistMovies,
    favMovies: s.favMovies,
    hiddenMovieIds: s.hiddenMovieIds,
  }));
  const {
    setLocalRating,
    removeLocalRating,
    markMovieAsWatched,
    toggleWatchlistStatus,
    toggleFavoriteStatus,
    toggleHiddenFromProgress,
    deleteMediaFromHistory,
    // Film puanı mutasyon katmanından geçiyor: Trakt'a yazar VE aynı damgayla
    // Akış'a yayınlar (bkz. services/library/mutations/ratings.ts).
    rateMedia,
    unrateMedia,
  } = useLibraryActions();
  const { isGuest } = useAuth();

  const idStr = Array.isArray(id) ? id[0] : id;
  const { traktId: traktIdNum } = parseMediaSlug(idStr as string);

  // `refreshData` → `LoadFailedState.onRetry` (bkz. app/show/[id].tsx'teki aynı not).
  const { mediaData, images, isLoading, isLoadingComments, hasError, isCircuitBreakerError, refreshData } = useMovieDetail(traktIdNum, tmdbId as string);
  const movieData = mediaData.summary;
  const castData = mediaData.cast;
  const relatedMovies = mediaData.related;
  const commentsData = mediaData.comments;

  // Y6 (Madde 244): bkz. app/show/[id].tsx'teki aynı not.
  const reviewsState = useMediaReviews({
    mediaId: traktIdNum,
    mediaType: 'movie',
    mediaTitle: movieData?.title ?? '',
    tmdbId: Number(movieData?.ids?.tmdb ?? tmdbId) || undefined,
  });

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
  // "Bırak" eylemi: Trakt'ta filmler için `calendar` bölümünden gizlenmiş mi
  // (bkz. hideItemTrakt/unhideItemTrakt, dizilerdeki `progress_watched`in film
  // karşılığı). Diziler sayfasındaki isHidden ile birebir aynı mekanizma.
  const isHidden = hiddenMovieIds.includes(traktIdNum);

  // NOT: `MediaHero`'daki tetikleyici buton zaten `isGuest` ile koruyor —
  // buradaki kontrol ikinci bir savunma katmanı (`handleToggleWatched` ile
  // aynı desen, bkz. aşağısı).
  const handleRate = async (rating: number) => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }
    // StarSlider zaten 1-10 dahili ölçekte değer döndürür (Trakt ile aynı) — tekrar ×2 yapılmamalı.
    try {
      setLocalRating(traktIdNum, 'movie', rating);
      await rateMedia(traktIdNum, 'movie', rating);
    } catch (e) {
      removeLocalRating(traktIdNum, 'movie');
      Alert.alert(t('common:error'), 'Puan kaydedilirken bir hata oluştu.');
      console.error(e);
    }
  };

  const handleRemoveRating = async () => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }
    try {
      removeLocalRating(traktIdNum, 'movie');
      await unrateMedia(traktIdNum, 'movie');
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

  const handleRewatch = async () => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }
    try {
      await markMovieAsWatched(traktIdNum);
      setRewatchSnackbarVisible(true);
    } catch (e) {
      console.error(e);
    }
  };

  const isReleased = movieData?.released ? new Date(movieData.released) <= new Date() : true;

  if (isLoading) {
    return <DetailHeroSkeleton />;
  }

  // 🔴 Y17: eskiden "Film bulunamadı" — YANLIŞ TEŞHİS. Film duruyor,
  // yalnızca yüklenemedi; üstelik "Tekrar Dene" sunulmuyordu.
  if (hasError || !movieData) {
    return (
      <LoadFailedState
        onRetry={refreshData}
        onBack={handleBack}
        text={isCircuitBreakerError ? t('loadFailedCircuitBreakerText', 'Çok fazla deneme yapıldı — birkaç saniye bekleyip tekrar dene.') : undefined}
      />
    );
  }

  // ── Her iki duzenin PAYLASTIGI parcalar (AI_RULES 2.5: kopya yok) ─────
  // Y20: bkz. app/show/[id].tsx'teki ayni sinir ve gerekcesi.
  const hero = (
    <SectionErrorBoundary label="movie-hero">
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
        onRewatch={handleRewatch}
        isHidden={isHidden}
        onHideFromProgress={() => toggleHiddenFromProgress(traktIdNum, 'movie', isHidden)}
      />
    </SectionErrorBoundary>
  );

  const watchAction = (
      <View style={styles.actionRow}>
        {isReleased ? (
          <TouchableOpacity
            style={[styles.actionButton, isWatched && styles.actionButtonActive]}
            onPress={handleToggleWatched}
            disabled={actionLoading}
            activeOpacity={0.8}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#fff" />
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
  );

  const commentsSection = (
    <MediaCommentsSection
      reviewsState={reviewsState}
      traktComments={commentsData}
      isLoadingTraktComments={isLoadingComments}
      onSeeAllTrakt={() => setCommentSheetVisible(true)}
    />
  );

  const castSection = (
    <SectionErrorBoundary label="movie-cast">
      <MediaCast cast={castData} />
    </SectionErrorBoundary>
  );

  const relatedSection = relatedMovies && relatedMovies.length > 0 ? (
    <SectionErrorBoundary label="movie-related">
      <HorizontalMediaList title={t('relatedMovies')} data={relatedMovies} type="movie" />
    </SectionErrorBoundary>
  ) : null;

  const overlays = (
    <>
      <CommentSheet
        visible={commentSheetVisible}
        onClose={() => setCommentSheetVisible(false)}
        mediaId={traktIdNum}
        mediaType="movie"
        reviewsState={reviewsState}
      />
      <Snackbar
        visible={rewatchSnackbarVisible}
        message={t('rewatchConfirmation')}
        onDismiss={() => setRewatchSnackbarVisible(false)}
        duration={2500}
      />
    </>
  );

  // ── MASAUSTU WEB (>=1024px) ───────────────────────────────────────────
  // Filmde sezon rayi YOK: tek sutun, ortalanmis 1200px kapsayici.
  if (layout.isDesktopWeb) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView contentContainerStyle={{ paddingBottom: 72 }} showsVerticalScrollIndicator={false}>
          <DetailWebLayout
            metrics={layout}
            backdrop={backdrop}
            left={
              <>
                {hero}
                <View style={[styles.webBlock, styles.webAction]}>{watchAction}</View>
                <View style={styles.webBlock}>{commentsSection}</View>
                <View style={[styles.webBlock, styles.webFlush]}>{castSection}</View>
                {relatedSection ? <View style={[styles.webBlock, styles.webFlush]}>{relatedSection}</View> : null}
              </>
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
        
        {/* Y20: bkz. app/show/[id].tsx'teki aynı sınır ve gerekçesi.
            Bu ekranda EKSİKTİ — show/ tarafı F15'te korunmuştu ama film
            ekranı hiç sarılmamıştı (AI_RULES §2.5'in "kopyalar sessizce
            ıraksar" uyarısının canlı örneği). */}
        {hero}

        <View style={styles.contentArea}>
          {/* ACTION BUTTONS */}
          {watchAction}

          {/* ── KaymakTV İncelemeleri ──────────────────────────────────
              bkz. app/show/[id].tsx'teki aynı blok ve docs/design/REVIEWS_PLAN.md §4.2. */}
          <View style={styles.section}>{commentsSection}</View>


          {castSection}

          {relatedSection}
        </View>

      </ScrollView>

      {overlays}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
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
  // Masaustu sol sutununda bloklar arasi dikey ritim.
  webBlock: { marginTop: 40 },
  // MediaCast/HorizontalMediaList kendi 16px yatay dolgusunu tasiyor.
  webFlush: { marginHorizontal: -16 },
  // "Izledim" butonu mobilde tam genislikte; masaustunde ekran boyu bir
  // cubuga donusuyordu — icerige gore genisleyen makul bir olcuye alindi.
  webAction: { maxWidth: 260, marginHorizontal: -16 },
});
