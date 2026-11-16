import { useCallback, useState } from 'react';
import { tumunuKaldirOnayi } from '../utils/izlemeGeriAlma';
import { notify } from '../utils/confirmDialog';
import { useLibrarySelector, useLibraryActions } from '../context/LibraryContext';
import { useAuth } from '../context/AuthContext';

interface UseShowDetailHandlersProps {
  traktIdNum: number;
  t: any;
  /** M477: kütüphanede olmayan dizi puanlanınca da akışa yayın için başlık/tmdb. */
  medya?: { title?: string; tmdbId?: number };
}

export function useShowDetailHandlers({
  traktIdNum,
  t,
  medya,
}: UseShowDetailHandlersProps) {
  // Granüler: yalnızca kullanıcının dizi puanları izlenir — kütüphanedeki
  // ilerleme/watchlist/yorum gibi ilgisiz dilimler artık bu hook'u tetiklemez.
  const userRatingsShows = useLibrarySelector((s) => s.userRatingsShows);
  // Aksiyon fonksiyonları store'a abone olmaz (bkz. useLibraryActions).
  const {
    setLocalRating,
    removeLocalRating,
    unwatchEpisode,
    unwatchLastEpisodePlay,
    rewatchEpisode,
    // Puan yalnız bizde durur, Trakt'a gitmez (bkz. mutations/ratings.ts).
    rateMedia,
    unrateMedia,
    rateEpisodeMedia,
    unrateEpisodeMedia,
  } = useLibraryActions();
  const { isGuest } = useAuth();

  const [localLoadingOption, setLocalLoadingOption] = useState<'remove' | 'rewatch' | 'last' | null>(null);
  const [snackbarData, setSnackbarData] = useState<{showId: number, season: number, episode: number} | null>(null);

  const userRatingObj = userRatingsShows?.find((r: any) => r.show?.ids?.trakt === traktIdNum);
  const userRating = userRatingObj ? userRatingObj.rating : null;

  // NOT: `MediaHero`/`EpisodeOptionsModal` bu aksiyonların tetikleyici
  // butonlarını zaten `isGuest` ile koruyor — buradaki kontroller bilinçli bir
  // ikinci savunma katmanı (bu dosyadaki diğer handler'larla — `handleUnwatchEpisode`,
  // `handleRewatchEpisode` — aynı desen). Misafir bir
  // token olmadan doğrudan buraya ulaşırsa (örn. ileride eklenecek yeni bir
  // tetikleyici korumayı unutursa) Trakt'a token'sız istek gidip genel bir
  // hata mesajı göstermek yerine, burada da net bir uyarı verilir.
  const handleRate = useCallback(async (rating: number) => {
    if (isGuest) {
      notify(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }
    // StarSlider zaten 1-10 dahili ölçekte değer döndürür (Trakt ile aynı) — tekrar ×2 yapılmamalı.
    try {
      setLocalRating(traktIdNum, 'show', rating);
      await rateMedia(traktIdNum, 'show', rating, medya);
    } catch (e) {
      removeLocalRating(traktIdNum, 'show');
      notify(t('common:error'), t('common:ratingSaveError', 'Puan kaydedilirken bir hata oluştu.'));
      console.error(e);
    }
  }, [isGuest, traktIdNum, setLocalRating, removeLocalRating, rateMedia, medya, t]);

  const handleRateEpisode = useCallback(async (episodeTraktId: number, rating: number) => {
    if (isGuest) {
      notify(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return false;
    }
    try {
      setLocalRating(episodeTraktId, 'episode', rating);
      await rateEpisodeMedia(episodeTraktId, rating);
      return true;
    } catch (e) {
      removeLocalRating(episodeTraktId, 'episode');
      notify(t('common:error'), t('common:episodeRatingSaveError', 'Bölüm puanı kaydedilirken hata oluştu.'));
      console.error(e);
      return false;
    }
  }, [isGuest, setLocalRating, removeLocalRating, rateEpisodeMedia, t]);

  const handleRemoveEpisodeRating = useCallback(async (episodeTraktId: number) => {
    if (isGuest) {
      notify(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return false;
    }
    try {
      removeLocalRating(episodeTraktId, 'episode');
      await unrateEpisodeMedia(episodeTraktId);
      return true;
    } catch (e) {
      notify(t('common:error'), t('common:episodeRatingRemoveError', 'Bölüm puanı silinirken hata oluştu.'));
      console.error(e);
      return false;
    }
  }, [isGuest, removeLocalRating, unrateEpisodeMedia, t]);

  const handleRemoveRating = useCallback(async () => {
    if (isGuest) {
      notify(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }
    try {
      removeLocalRating(traktIdNum, 'show');
      await unrateMedia(traktIdNum, 'show');
    } catch (e) {
      notify(t('common:error'), t('common:ratingRemoveError', 'Puan silinirken bir hata oluştu.'));
      console.error(e);
    }
  }, [isGuest, traktIdNum, removeLocalRating, unrateMedia, t]);

  const handleUnwatchEpisode = useCallback(async (selectedEpisode: {season: number, episode: number, playCount?: number} | null) => {
    if (isGuest) {
      notify(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }
    if (!selectedEpisode) return;
    // 1.0.1 Dal 4 · 2+ izlemede «hepsini kaldır» ayrıca onaylanır (1x'te soru yok).
    if (!(await tumunuKaldirOnayi(t, selectedEpisode.playCount ?? 1))) return false;
    setLocalLoadingOption('remove');
    try {
      await unwatchEpisode(traktIdNum, selectedEpisode.season, selectedEpisode.episode);
      setSnackbarData({ showId: traktIdNum, season: selectedEpisode.season, episode: selectedEpisode.episode });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    } finally {
      setLocalLoadingOption(null);
    }
  }, [isGuest, traktIdNum, unwatchEpisode, t]);

  /** 1.0.1 Dal 4 · yalnız son izlemeyi geri al (3x → 2x). */
  const handleUnwatchLastPlay = useCallback(async (selectedEpisode: {season: number, episode: number} | null) => {
    if (isGuest) {
      notify(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return false;
    }
    if (!selectedEpisode) return false;
    setLocalLoadingOption('last');
    try {
      await unwatchLastEpisodePlay(traktIdNum, selectedEpisode.season, selectedEpisode.episode);
      return true;
    } catch (e) {
      console.error(e);
      notify(t('common:error'), t('media:unwatchLastPlayError', 'Son izleme geri alınamadı.'));
      return false;
    } finally {
      setLocalLoadingOption(null);
    }
  }, [isGuest, traktIdNum, unwatchLastEpisodePlay, t]);

  const handleRewatchEpisode = useCallback(async (selectedEpisode: {season: number, episode: number} | null) => {
    if (isGuest) {
      notify(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }
    if (!selectedEpisode) return;
    setLocalLoadingOption('rewatch');
    try {
      await rewatchEpisode(traktIdNum, selectedEpisode.season, selectedEpisode.episode);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    } finally {
      setLocalLoadingOption(null);
    }
  }, [isGuest, traktIdNum, rewatchEpisode, t]);

  const handleUndoUnwatch = useCallback(async () => {
    if (!snackbarData) return;
    try {
      await rewatchEpisode(snackbarData.showId, snackbarData.season, snackbarData.episode);
      setSnackbarData(null);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [snackbarData, rewatchEpisode]);

  return {
    userRating,
    localLoadingOption,
    handleRate,
    handleRemoveRating,
    handleRateEpisode,
    handleRemoveEpisodeRating,
    handleUnwatchEpisode,
    handleUnwatchLastPlay,
    handleRewatchEpisode,
    handleUndoUnwatch,
  };
}
