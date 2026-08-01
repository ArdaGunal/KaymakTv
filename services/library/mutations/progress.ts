import {
  addEpisodeToHistory,
  addSeasonToHistory,
  addEpisodesBulkToHistory,
  removeEpisodeFromHistoryTrakt,
  removeSeasonFromHistoryTrakt,
  addMovieToHistory,
  addToWatchlistTrakt,
  getShowProgress,
} from '../../traktApi';
import { fetchFreshData } from '../fetchers';
import {
  CACHE_KEYS,
  safeStorageSet,
  setWatchedMovies,
  setWatchedShows,
  setWatchlistMovies,
  setShowProgressMap,
  persistShowProgressMap,
} from '../utils';
import { useLibraryStore } from '../../../store/useLibraryStore';
import { toggleHiddenFromProgress } from './collections';
import { logError } from '../../../utils/errorLog';
import { recordMutationResult } from '../../../utils/metrics';
import {
  publishActivities,
  retractLocalActivity,
  formatEpisodeCode,
  nowStamp,
} from '../../../features/feed/services/feedPublish';
import { resolveMediaMeta } from '../mediaMeta';

// ─────────────────────────────────────────────────────────────────────────
// AKIŞA ANINDA YAYIN
//
// ESKİ DAVRANIŞ: bir bölümü/filmi işaretlemek yalnızca Trakt'a yazıyordu;
// aktivitenin Akış'a düşmesi için uygulamanın kapanıp yeniden açılması ve
// oradaki `/feed/sync`in çalışması gerekiyordu. Artık Trakt yazımı başarılı
// olur olmaz aktivite Akış'a da yayınlanıyor.
//
// İKİ KURAL:
//  1. ATEŞLE-VE-UNUT — yayın, kullanıcının "izledim" akışını ASLA bloklamaz
//     ve başarısız olsa bile izleme işlemini başarısız SAYDIRMAZ (yayın
//     kendi içinde iyimser kartı geri alıp loglar).
//  2. AYNI ZAMAN DAMGASI — Trakt'a `watched_at`/`rated_at` olarak gönderilen
//     damganın AYNISI yayınlanır. Bir sonraki tam senkron Trakt'tan aynı
//     damgayı okuyup aynı dedup anahtarını üretir; satır ne kopyalanır ne
//     de "Trakt'ta yok" sanılıp silinir.
// ─────────────────────────────────────────────────────────────────────────

/** Yayın için gereken meta (başlık + poster id) — bkz. services/library/mediaMeta.ts */
const showMetaFor = (showId: number) => resolveMediaMeta(showId, 'show');

// Kullanıcı "Bırak" ile Trakt'ta gizlediği bir diziyi/filmi sonradan yeniden
// izlemeye başlarsa gizleme otomatik kaldırılır — aksi halde dizi/film Trakt'ın
// gizlenen listesinde takılı kalır ve ana vitrin listelerine asla geri dönmez.
//
// Gizleme kaldırma mantığı BİLİNÇLİ OLARAK burada tekrar YAZILMAZ:
// `toggleHiddenFromProgress` zaten iyimser güncelleme + diske yazma + hata
// halinde rollback + metrik kaydı + senkron yarış koruması (hiddenSyncGuard)
// içeriyor. Buradaki ilk sürüm bu adımların yalnızca bir kısmını kopyalamıştı
// ve rollback'i yoktu — istek başarısız olduğunda yerel durum "gizli değil",
// Trakt "gizli" kalıyor, ilk senkronda dizi kullanıcının gözü önünde geri
// gizleniyordu. Tek kaynağa devredilerek bu sapma kapatıldı.
//
// Çağrı ateşle-ve-unut: kullanıcının "izledim" akışını bloklamamalı, bu yüzden
// `await` edilmez; hata halinde `toggleHiddenFromProgress` kendi rollback'ini
// zaten yapar.
const unhideShowIfNeeded = (showId: number) => {
  if (!useLibraryStore.getState().hiddenShowIds.includes(showId)) return;
  toggleHiddenFromProgress(showId, 'show', true).catch((e) =>
    console.error('Otomatik gizleme kaldırma (show) hatası:', e)
  );
};

const unhideMovieIfNeeded = (movieId: number) => {
  if (!useLibraryStore.getState().hiddenMovieIds.includes(movieId)) return;
  toggleHiddenFromProgress(movieId, 'movie', true).catch((e) =>
    console.error('Otomatik gizleme kaldırma (movie) hatası:', e)
  );
};

// Kullanıcı bir dizinin yeni bir bölümünü/sezonunu izlediğinde (tek bölüm,
// toplu bölüm veya sezon işaretleme — geri alma DEĞİL), o dizi artık "aktif
// izleniyor" sayılmalı: Diziler > İzleme sekmesindeki normal bir dizi gibi
// davranmalı.
//   1. "Bırak" ile Trakt'ta gizlenmişse gizleme kaldırılır (Bırak, tarihten/
//      ilerlemeden tamamen bağımsız, en yüksek öncelikli bir kova olduğu için
//      progress güncellemesi tek başına bunu geçersiz kılamaz — açıkça temizlemek gerekir).
//   2. `watchedShows`'taki `last_watched_at` "şimdi"ye çekilir — aksi halde
//      "Ara Verilenler" (45 günden eski) kovasındaki bir dizi, eski tarih
//      hâlâ orada dururken bölüm işaretlese bile pasif görünmeye devam ederdi.
//      (Henüz `watchedShows`'ta hiç yoksa — örn. yalnızca watchlist'ten gelen
//      bir dizi — dokunmuyoruz: trackingLogic zaten "son izleme bilinmiyor"
//      durumunu güvenli varsayılan olarak aktif sayıyor.)
const reactivateShowTracking = (showId: number) => {
  unhideShowIfNeeded(showId);

  setWatchedShows((prev: any[]) => {
    const idx = (prev || []).findIndex((item: any) => item?.show?.ids?.trakt === showId);
    if (idx === -1) return prev;
    const updated = [...prev];
    updated[idx] = { ...updated[idx], last_watched_at: new Date().toISOString() };
    safeStorageSet(CACHE_KEYS.watchedShows, JSON.stringify(updated));
    return updated;
  });
};

export const markEpisodeAsWatched = async (showId: number, season: number, episode: number) => {
  let previousState: any = null;

  console.log(`[OPTIMISTIC UI] Bölüm UI'da işaretleniyor: Show ${showId}, S${season}E${episode}`);
  reactivateShowTracking(showId);

  setShowProgressMap((prev: any) => {
    previousState = prev[showId];

    const currentProgress = prev[showId];
    if (!currentProgress || !currentProgress.next_episode) return prev;

    const optimisticProgress = {
      ...currentProgress,
      next_episode: {
        ...currentProgress.next_episode,
        number: currentProgress.next_episode.number + 1,
        title: 'Kaydediliyor...',
      },
    };

    return { ...prev, [showId]: optimisticProgress };
  });

  // Damga Trakt'a ve Akış'a AYNI gönderilir (bkz. dosya başındaki not).
  const watchedAt = nowStamp();

  try {
    console.log(`[API REQUEST] Trakt'a gönderiliyor...`);
    await addEpisodeToHistory(showId, season, episode, watchedAt);
    console.log(`[API SUCCESS] Trakt ile senkronize edildi. Gerçek veri çekiliyor...`);

    const meta = showMetaFor(showId);
    publishActivities([
      {
        activityType: 'watched_episode',
        showId,
        mediaType: 'show',
        showTitle: meta.title,
        tmdbId: meta.tmdbId,
        episodeNumber: formatEpisodeCode(season, episode),
        activityAt: watchedAt,
      },
    ]);

    let newProgress = await getShowProgress(showId);

    const staleSeason = newProgress?.seasons?.find((s:any) => s.number === season);
    const staleEp = staleSeason?.episodes?.find((e:any) => e.number === episode);

    if (staleEp && !staleEp.completed) {
      console.warn(`[STALE DATA] Trakt progress henüz güncellenmedi (S${season}E${episode} completed=false). Lokal yama uygulanıyor...`);
      staleEp.completed = true;
      if (newProgress.next_episode) {
        newProgress.next_episode = {
          ...newProgress.next_episode,
          number: episode + 1,
          title: 'Sıradaki Bölüm Aranıyor...'
        };
      }
    }

    setShowProgressMap((prev: any) => {
      const updated = { ...prev, [showId]: newProgress };
      persistShowProgressMap(updated);
      return updated;
    });

    recordMutationResult('markEpisodeAsWatched', true);
    return newProgress;
  } catch (error) {
    console.error(`[API ERROR] İşlem başarısız, eski haline (Rollback) dönülüyor!`, error);
    logError('mutations.progress.markEpisodeAsWatched', error);
    recordMutationResult('markEpisodeAsWatched', false);
    if (previousState !== null) {
      setShowProgressMap((prev: any) => ({ ...prev, [showId]: previousState }));
    }
    throw error;
  }
};

export const unwatchEpisode = async (showId: number, season: number, episode: number) => {
  let previousState: any = null;

  console.log(`[OPTIMISTIC UI] Bölüm UI'da Kaldırılıyor: Show ${showId}, S${season}E${episode}`);

  setShowProgressMap((prev: any) => {
    previousState = prev[showId];

    const currentProgress = prev[showId];
    if (!currentProgress || !currentProgress.next_episode) return prev;

    const optimisticProgress = {
      ...currentProgress,
      next_episode: {
        ...currentProgress.next_episode,
        number: Math.max(1, episode),
        title: 'Geri Alınıyor...',
      },
    };

    return { ...prev, [showId]: optimisticProgress };
  });

  try {
    console.log(`[API REQUEST] Trakt'tan Bölüm Siliniyor...`);
    await removeEpisodeFromHistoryTrakt(showId, season, episode);
    console.log(`[API SUCCESS] Trakt üzerinden silindi. Gerçek veri çekiliyor...`);

    // Geri alınan bölüm akıştan da düşmeli — aksi halde kullanıcı "izlemedim"
    // dediği bir bölümü akışında görmeye devam ederdi. Yalnızca YEREL akış
    // temizlenir; Supabase'deki satırı bir sonraki tam senkron kendi geri
    // alma (retraction) mantığıyla siler (bkz. Worker handleFeedSync) —
    // aynı işi ikinci bir uç noktayla tekrarlamıyoruz.
    const removedCode = formatEpisodeCode(season, episode);
    retractLocalActivity(
      (a) =>
        a.activityType === 'watched_episode' &&
        a.showId === showId &&
        a.episodeNumber === removedCode
    );

    let newProgress = await getShowProgress(showId);

    const staleSeason = newProgress?.seasons?.find((s:any) => s.number === season);
    const staleEp = staleSeason?.episodes?.find((e:any) => e.number === episode);

    if (staleEp && staleEp.completed) {
      console.warn(`[STALE DATA] Trakt progress henüz güncellenmedi (S${season}E${episode} completed=true). Lokal yama uygulanıyor...`);
      staleEp.completed = false;

      newProgress.next_episode = {
        season: season,
        number: episode,
        title: staleEp.title,
        ids: staleEp.ids
      };
    }

    let currentCompletedCount = newProgress.completed;
    if (staleEp && staleEp.completed !== undefined) {
       currentCompletedCount = Math.max(0, currentCompletedCount - 1);
    }

    if (currentCompletedCount === 0) {
        console.log(`[WATCHLIST RECOVERY] Dizi hiç izlenmemiş duruma düştü, Watchlist'e geri ekleniyor...`);
        await addToWatchlistTrakt(showId, 'show');
        fetchFreshData(null, true);
    }

    setShowProgressMap((prev: any) => {
      const updated = { ...prev, [showId]: newProgress };
      persistShowProgressMap(updated);
      return updated;
    });

    recordMutationResult('unwatchEpisode', true);
    return newProgress;
  } catch (error) {
    console.error(`[API ERROR] İşlem başarısız, eski haline (Rollback) dönülüyor!`, error);
    logError('mutations.progress.unwatchEpisode', error);
    recordMutationResult('unwatchEpisode', false);
    if (previousState !== null) {
      setShowProgressMap((prev: any) => {
        const updated = { ...prev, [showId]: previousState };
        persistShowProgressMap(updated);
        return updated;
      });
    }
    throw error;
  }
};

export const unwatchSeason = async (showId: number, season: number) => {
  let previousState: any = null;

  console.log(`[OPTIMISTIC UI] Sezon UI'da Kaldırılıyor: Show ${showId}, S${season}`);

  setShowProgressMap((prev: any) => {
    previousState = prev[showId];

    const currentProgress = prev[showId];
    if (!currentProgress) return prev;

    const optimisticProgress = {
      ...currentProgress,
      next_episode: {
        season: season,
        number: 1,
        title: 'Sezon Geri Alınıyor...',
      },
    };

    return { ...prev, [showId]: optimisticProgress };
  });

  try {
    console.log(`[API REQUEST] Trakt'tan Sezon Siliniyor...`);
    await removeSeasonFromHistoryTrakt(showId, season);
    console.log(`[API SUCCESS] Trakt üzerinden silindi. Gerçek veri çekiliyor...`);

    // Bkz. unwatchEpisode'daki aynı not — geri alınan sezonun TÜM bölümleri
    // yerel akıştan düşer ("S{season}E" önekiyle eşleşenler).
    const seasonPrefix = `S${String(season).padStart(2, '0')}E`;
    retractLocalActivity(
      (a) =>
        a.activityType === 'watched_episode' &&
        a.showId === showId &&
        !!a.episodeNumber?.startsWith(seasonPrefix)
    );

    let newProgress = await getShowProgress(showId);

    if (newProgress.completed === 0) {
        console.log(`[WATCHLIST RECOVERY] Dizi hiç izlenmemiş duruma düştü, Watchlist'e geri ekleniyor...`);
        await addToWatchlistTrakt(showId, 'show');
        fetchFreshData(null, true);
    }

    setShowProgressMap((prev: any) => {
      const updated = { ...prev, [showId]: newProgress };
      persistShowProgressMap(updated);
      return updated;
    });

    recordMutationResult('unwatchSeason', true);
    return newProgress;
  } catch (error) {
    console.error(`[API ERROR] İşlem başarısız, eski haline (Rollback) dönülüyor!`, error);
    logError('mutations.progress.unwatchSeason', error);
    recordMutationResult('unwatchSeason', false);
    if (previousState !== null) {
      setShowProgressMap((prev: any) => {
        const updated = { ...prev, [showId]: previousState };
        persistShowProgressMap(updated);
        return updated;
      });
    }
    throw error;
  }
};

export const rewatchEpisode = async (showId: number, season: number, episode: number) => {
  return markEpisodeAsWatched(showId, season, episode);
};

export const markSeasonAsWatched = async (showId: number, season: number) => {
  let previousState: any = null;
  console.log(`[OPTIMISTIC UI] Sezon UI'da işaretleniyor: Show ${showId}, S${season}`);
  reactivateShowTracking(showId);

  setShowProgressMap((prev: any) => {
    previousState = prev[showId];

    const currentProgress = prev[showId];
    if (!currentProgress || !currentProgress.next_episode) return prev;

    const optimisticProgress = {
      ...currentProgress,
      next_episode: {
        ...currentProgress.next_episode,
        title: 'Kaydediliyor...',
      },
    };

    return { ...prev, [showId]: optimisticProgress };
  });

  const watchedAt = nowStamp();

  try {
    console.log(`[API REQUEST] Trakt'a gönderiliyor (Sezon)...`);
    await addSeasonToHistory(showId, season, watchedAt);
    console.log(`[API SUCCESS] Trakt ile senkronize edildi. Gerçek veri çekiliyor...`);

    const newProgress = await getShowProgress(showId);

    // Sezonun HANGİ bölümlerinin işaretlendiğini ancak taze ilerlemeden
    // öğrenebiliyoruz (Trakt "tüm sezon" isteğini kendisi bölümlere açıyor).
    // Bu yüzden yayın, progress çekildikten SONRA yapılıyor.
    const meta = showMetaFor(showId);
    const seasonEpisodes: any[] = newProgress?.seasons?.find((s: any) => s.number === season)?.episodes || [];
    publishActivities(
      seasonEpisodes
        .filter((ep: any) => ep?.completed && typeof ep?.number === 'number')
        .map((ep: any) => ({
          activityType: 'watched_episode' as const,
          showId,
          mediaType: 'show' as const,
          showTitle: meta.title,
          tmdbId: meta.tmdbId,
          episodeNumber: formatEpisodeCode(season, ep.number),
          activityAt: watchedAt,
        }))
    );

    setShowProgressMap((prev: any) => {
      const updated = { ...prev, [showId]: newProgress };
      persistShowProgressMap(updated);
      return updated;
    });

    recordMutationResult('markSeasonAsWatched', true);
    return newProgress;
  } catch (error) {
    console.error(`[API ERROR] Sezon işaretleme başarısız, eski haline dönülüyor!`, error);
    logError('mutations.progress.markSeasonAsWatched', error);
    recordMutationResult('markSeasonAsWatched', false);
    if (previousState !== null) {
      setShowProgressMap((prev: any) => ({ ...prev, [showId]: previousState }));
    }
    throw error;
  }
};

// Trakt'ın /sync/history uç noktası her POST'ta yeni bir "izlenme" (play) ekler
// — aynı sezonu ikinci kez göndermek, önce geçmişi silmeden doğrudan "tekrar
// izlendi" anlamına gelir. Bu yüzden markSeasonAsWatched'ın aynısı, sadece
// niyeti (ve ayrı optimistic UI mesajını) netleştirmek için ayrı isimle.
export const rewatchSeason = async (showId: number, season: number) => {
  return markSeasonAsWatched(showId, season);
};

export const markEpisodesUpToAsWatched = async (showId: number, season: number, episodes: number[]) => {
  let previousState: any = null;
  console.log(`[OPTIMISTIC UI] Bölümler toplu UI'da işaretleniyor: Show ${showId}, S${season}`);
  reactivateShowTracking(showId);

  setShowProgressMap((prev: any) => {
    previousState = prev[showId];

    const currentProgress = prev[showId];
    if (!currentProgress || !currentProgress.next_episode) return prev;

    const optimisticProgress = {
      ...currentProgress,
      next_episode: {
        ...currentProgress.next_episode,
        title: 'Kaydediliyor...',
      },
    };

    return { ...prev, [showId]: optimisticProgress };
  });

  const watchedAt = nowStamp();

  try {
    console.log(`[API REQUEST] Trakt'a gönderiliyor (Toplu Bölüm)...`);
    await addEpisodesBulkToHistory(showId, season, episodes, watchedAt);
    console.log(`[API SUCCESS] Trakt ile senkronize edildi. Gerçek veri çekiliyor...`);

    const meta = showMetaFor(showId);
    publishActivities(
      episodes.map((num) => ({
        activityType: 'watched_episode' as const,
        showId,
        mediaType: 'show' as const,
        showTitle: meta.title,
        tmdbId: meta.tmdbId,
        episodeNumber: formatEpisodeCode(season, num),
        activityAt: watchedAt,
      }))
    );

    const newProgress = await getShowProgress(showId);

    setShowProgressMap((prev: any) => {
      const updated = { ...prev, [showId]: newProgress };
      persistShowProgressMap(updated);
      return updated;
    });

    recordMutationResult('markEpisodesUpToAsWatched', true);
    return newProgress;
  } catch (error) {
    console.error(`[API ERROR] Toplu bölüm işaretleme başarısız, eski haline dönülüyor!`, error);
    logError('mutations.progress.markEpisodesUpToAsWatched', error);
    recordMutationResult('markEpisodesUpToAsWatched', false);
    if (previousState !== null) {
      setShowProgressMap((prev: any) => ({ ...prev, [showId]: previousState }));
    }
    throw error;
  }
};

export const markMovieAsWatched = async (movieId: number) => {
  let previousWatchlist: any = null;
  let previousWatched: any = null;
  let movieItemToMove: any = null;

  console.log(`[OPTIMISTIC UI] Film UI'da anında işaretleniyor: Movie ${movieId}`);

  // Kullanıcı "Bırak" ile gizlediği bir filmi sonradan izlediyse artık
  // Gizlenenler/Bırakılanlar'da görünmemeli. Gizlenmiş olmak en yüksek
  // öncelikli kova olduğu için (bkz. movieTrackingLogic), geçmişe eklenmesi
  // tek başına bunu geçersiz kılmaz — gizlemeyi açıkça kaldırmak gerekir.
  // Dizilerdeki `reactivateShowTracking` kuralının film karşılığı.
  unhideMovieIfNeeded(movieId);

  setWatchlistMovies((prev: any) => {
    previousWatchlist = prev;
    const item = prev.find((p: any) => p.movie.ids.trakt === movieId);
    if (item) {
      movieItemToMove = item;
      const newWatchlist = prev.filter((p: any) => p.movie.ids.trakt !== movieId);
      safeStorageSet(CACHE_KEYS.watchlistMovies, JSON.stringify(newWatchlist));
      return newWatchlist;
    }
    return prev;
  });

  setWatchedMovies((prev: any) => {
    previousWatched = prev;
    const exists = prev.find((p: any) => p.movie.ids.trakt === movieId);
    if (!exists && movieItemToMove) {
      const newWatched = [
        {
          plays: 1,
          last_watched_at: new Date().toISOString(),
          movie: movieItemToMove.movie
        },
        ...prev
      ];
      safeStorageSet(CACHE_KEYS.watchedMovies, JSON.stringify(newWatched));
      return newWatched;
    }
    return prev;
  });

  const watchedAt = nowStamp();

  try {
    console.log(`[API REQUEST] Trakt'a gönderiliyor (Film)...`);
    await addMovieToHistory(movieId, watchedAt);
    console.log(`[API SUCCESS] Film Trakt ile senkronize edildi.`);

    // Film izlemeleri artık Akış'ta görünüyor (yeni `watched_movie` tipi) —
    // eskiden akış YALNIZCA bölüm izlemelerini ve puanlamaları taşıyordu,
    // bir filmi izlediğini işaretlemek hiçbir yerde görünmüyordu.
    const movie = movieItemToMove?.movie
      || (useLibraryStore.getState().watchedMovies || []).find((m: any) => m?.movie?.ids?.trakt === movieId)?.movie;
    if (movie?.title) {
      publishActivities([
        {
          activityType: 'watched_movie',
          showId: movieId,
          mediaType: 'movie',
          showTitle: movie.title,
          tmdbId: movie?.ids?.tmdb,
          activityAt: watchedAt,
        },
      ]);
    }

    recordMutationResult('markMovieAsWatched', true);
  } catch (error) {
    console.error(`[API ERROR] Film işaretleme başarısız, eski haline dönülüyor!`, error);
    logError('mutations.progress.markMovieAsWatched', error);
    recordMutationResult('markMovieAsWatched', false);
    if (previousWatchlist !== null) {
      setWatchlistMovies(previousWatchlist);
      safeStorageSet(CACHE_KEYS.watchlistMovies, JSON.stringify(previousWatchlist));
    }
    if (previousWatched !== null) {
      setWatchedMovies(previousWatched);
      safeStorageSet(CACHE_KEYS.watchedMovies, JSON.stringify(previousWatched));
    }
    throw error;
  }
};
