// ==========================================================================
// SON İZLEMEYİ GERİ AL — 3x → 2x (1.0.1 Dal 4 · ISIM_TEKRAR_ANALIZ_PLANI §3 Dal 4 madde 3)
// ==========================================================================
// «Tüm izlemeleri kaldır» bugünkü `unwatchEpisode` / `deleteMediaFromHistory` (hepsini siler).
// Bu dosya YALNIZ en son izlemeyi siler. Hangi izleme olduğunu SUNUCU bulur (`sonuncu: true`):
// önceki izlemenin damgası yerelde bilinmiyor, istemci damgası art arda iki geri almada bayat kalırdı.
// Worker aynı atomik RPC ile yalnız o satırı ve yalnız o izlemenin akış kartını geri çeker.
// Tek izlemesi kalan içerikte iki eylem aynıdır → tam silme yoluna devredilir (davranış korunur).
//
// ⚠️ Trakt aynası YOK: tek izlemeyi Trakt'tan silmek geçmiş kaydının kimliğini ister, elimizde yok.
// Trakt'ta ek izleme kalır; bizim kayıt (otorite) doğrudur. BACKLOG'a yazıldı.

import * as libraryApi from '../../api/library';
import { useLibraryStore } from '../../../store/useLibraryStore';
import { sonIzlemeyiGeriAl } from './optimistikIlerleme';
import { filmIzlemesiniGeriAl } from './optimistikFilm';
import { unwatchEpisode } from './progressUndo';
import { deleteMediaFromHistory } from './collections';
import { CACHE_KEYS, safeStorageSet, setShowProgressMap, setWatchedMovies } from '../utils';
import { flushWatchedOutbox } from '../outbox/runtime';
import { formatEpisodeCode, retractLocalActivity } from '../../../features/feed/services/feedPublish';
import { recordMutationResult } from '../../../utils/metrics';
import { logError } from '../../../utils/errorLog';
import { filmIzlemeSayisi, ilerlemedenBolumSayisi } from '../../../utils/izlemeSayisi';
import { nesliArtir, mevcutIlerleme, tazelemeyiPlanla, geriAlVeyaTazele } from './progressState';

const ayniAn = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && Date.parse(a) === Date.parse(b);

export const unwatchLastEpisodePlay = async (showId: number, season: number, episode: number) => {
  // Bekleyen ekleme önce sunucuya iner: «en son izleme» sunucuda da en son olmalı.
  await flushWatchedOutbox();
  const ilerleme = mevcutIlerleme(showId);
  if (ilerlemedenBolumSayisi(ilerleme, season, episode) <= 1) return unwatchEpisode(showId, season, episode);

  const nesilBaslangic = nesliArtir(showId);
  setShowProgressMap((prev: any) => {
    const yamali = sonIzlemeyiGeriAl(prev[showId], season, episode);
    return yamali ? { ...prev, [showId]: yamali } : prev;
  });
  try {
    const yanit = await libraryApi.unwatchLastEpisodePlay(showId, season, episode);
    const kod = formatEpisodeCode(season, episode);
    retractLocalActivity((a) =>
      a.activityType === 'watched_episode' && a.showId === showId && a.episodeNumber === kod && ayniAn(a.activityAt, yanit.watchedAt));
    recordMutationResult('unwatchLastEpisodePlay', true);
    // Önceki izlemenin damgası ve süreler sunucudan gelir (nesil korumalı, gecikmeli).
    tazelemeyiPlanla(showId);
    return mevcutIlerleme(showId);
  } catch (error) {
    logError('mutations.sonIzleme.unwatchLastEpisodePlay', error);
    recordMutationResult('unwatchLastEpisodePlay', false);
    geriAlVeyaTazele(showId, nesilBaslangic, ilerleme);
    throw error;
  }
};

export const unwatchLastMoviePlay = async (movieId: number) => {
  await flushWatchedOutbox();
  const onceki = useLibraryStore.getState().watchedMovies;
  if (filmIzlemeSayisi(onceki, movieId) <= 1) return deleteMediaFromHistory(movieId, 'movie');

  const yaz = (liste: any[]) => {
    setWatchedMovies(liste);
    safeStorageSet(CACHE_KEYS.watchedMovies, JSON.stringify(liste));
  };
  yaz(filmIzlemesiniGeriAl(onceki, movieId));
  try {
    const yanit = await libraryApi.unwatchLastMoviePlay(movieId);
    retractLocalActivity((a) =>
      a.activityType === 'watched_movie' && a.showId === movieId && ayniAn(a.activityAt, yanit.watchedAt));
    recordMutationResult('unwatchLastMoviePlay', true);
  } catch (error) {
    logError('mutations.sonIzleme.unwatchLastMoviePlay', error);
    recordMutationResult('unwatchLastMoviePlay', false);
    yaz(onceki);
    throw error;
  }
};
