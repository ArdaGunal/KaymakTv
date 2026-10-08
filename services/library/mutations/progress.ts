// M439: kalıcı işaretleme sınırı. YEŞİL TİK ancak günlük diske yazıldıktan sonra.
// Kuyruk/taşıma outbox/ içinde; eski yarış ve geri alma ayrı modüllerde.
// İzin yalnız kapanışta veri kaybı içindir; fetchers.ts/feedApi.ts değiştirilmedi.
import { bolumleriIsaretle, sezonuIsaretle, iskeletKur } from './optimistikIlerleme';
import { izlenenFilmeEkle } from './optimistikFilm';
import { useLibraryStore } from '../../../store/useLibraryStore';
import { CACHE_KEYS, safeStorageSet, persistShowProgressMap, setShowProgressMap, setWatchlistMovies, setWatchedMovies, setCalendarMovies } from '../utils';
import { queueWatched, resumeWatchedOutbox } from '../outbox/runtime';
import type { WatchedDraft } from '../outbox/types';
import { recordMutationResult } from '../../../utils/metrics';
import { nowStamp } from '../../../features/feed/services/feedPublish';
import { resolveMediaMeta } from '../mediaMeta';
import { nesliArtir, reactivateShowTracking, unhideMovieIfNeeded, mevcutIlerleme, cancelProgressRefresh } from './progressState';
export { unwatchEpisode, unwatchSeason } from './progressUndo';

export type IsaretlemePlani = { sezon: number; bolumler: number[] };

/** Günlükte tam API payload'ı/kimlik/anahtar değil yalnız gerekli katalog alanları. */
function mediaFor(id: number, type: 'show' | 'movie', data?: any) {
  const state = useLibraryStore.getState();
  const list = type === 'movie'
    ? [...state.watchlistMovies, ...state.watchedMovies]
    : [...state.watchlistShows, ...state.watchedShows];
  const media = data || list.find((p: any) => p?.[type]?.ids?.trakt === id)?.[type];
  const meta = resolveMediaMeta(id, type);
  return {
    ids: { trakt: id, tmdb: media?.ids?.tmdb ?? meta.tmdbId },
    title: media?.title || meta.title, year: media?.year, runtime: media?.runtime,
    images: media?.images,
  };
}
function compactSkeleton(seasons?: any[] | null) {
  return seasons?.map((s) => ({
    number: s.number, episodes: s.episodes?.map((e: any) => ({
      number: e.number, title: e.title, first_aired: e.first_aired,
    })),
  }));
}
const saveIntent = async (draft: WatchedDraft, metric: string) => {
  try { return await queueWatched(draft); }
  catch (error) {
    // Disk hatası: store/yeşil tik değişmeden çağıran görünür hata verir.
    recordMutationResult(metric, false);
    throw error;
  }
};
const finishShow = (showId: number, metric: string) => {
  cancelProgressRefresh(showId);
  persistShowProgressMap(useLibraryStore.getState().showProgressMap);
  recordMutationResult(metric, true);
  // Arka plan sürücüsü bu yerel ACK'den sonra ağ işini üstlenir.
  resumeWatchedOutbox();
  return mevcutIlerleme(showId);
};

export const markEpisodeAsWatched = async (showId: number, season: number, episode: number, mediaData?: any, iskeletSezonlar?: any[] | null) => {
  const watchedAt = nowStamp();
  await saveIntent({
    mediaType: 'show', mediaId: showId, watchedAt, parts: [{ season, episodes: [episode] }],
    media: mediaFor(showId, 'show', mediaData), skeleton: compactSkeleton(iskeletSezonlar),
    activity: { season, episode },
  }, 'markEpisodeAsWatched');
  nesliArtir(showId);
  reactivateShowTracking(showId, mediaData);
  setShowProgressMap((prev: any) => {
    const yamali = bolumleriIsaretle(prev[showId] || iskeletKur(iskeletSezonlar), season, [episode], watchedAt);
    return yamali ? { ...prev, [showId]: yamali } : prev;
  });
  return finishShow(showId, 'markEpisodeAsWatched');
};

export const rewatchEpisode = async (showId: number, season: number, episode: number) =>
  markEpisodeAsWatched(showId, season, episode);

export const markSeasonAsWatched = async (showId: number, season: number, mediaData?: any, iskeletSezonlar?: any[] | null) => {
  const watchedAt = nowStamp();
  const base = useLibraryStore.getState().showProgressMap[showId] || iskeletKur(iskeletSezonlar);
  const episodes = base?.seasons?.find((s: any) => s.number === season)?.episodes
    ?.filter((e: any) => !e.first_aired || Date.parse(e.first_aired) <= Date.parse(watchedAt))
    .map((e: any) => e.number);
  await saveIntent({
    mediaType: 'show', mediaId: showId, watchedAt,
    parts: [{ season, episodes: episodes?.length ? episodes : '*' }],
    media: mediaFor(showId, 'show', mediaData), skeleton: compactSkeleton(iskeletSezonlar),
  }, 'markSeasonAsWatched');
  nesliArtir(showId);
  reactivateShowTracking(showId, mediaData);
  setShowProgressMap((prev: any) => {
    const yamali = sezonuIsaretle(prev[showId] || iskeletKur(iskeletSezonlar), season, watchedAt);
    return yamali ? { ...prev, [showId]: yamali } : prev;
  });
  return finishShow(showId, 'markSeasonAsWatched');
};

export const rewatchSeason = async (showId: number, season: number, mediaData?: any) =>
  markSeasonAsWatched(showId, season, mediaData);

export const planiIsaretle = async (
  showId: number, plan: IsaretlemePlani[], mediaData?: any, iskeletSezonlar?: any[] | null,
) => {
  const temiz = (plan || [])
    .filter((p) => p && Number.isInteger(p.sezon) && Array.isArray(p.bolumler) && p.bolumler.length > 0)
    .map((p) => ({ sezon: p.sezon, bolumler: [...new Set(p.bolumler)].sort((a, b) => a - b) }))
    .sort((a, b) => a.sezon - b.sezon);
  if (temiz.length === 0) return mevcutIlerleme(showId);
  const watchedAt = nowStamp();
  const son = temiz[temiz.length - 1];
  await saveIntent({
    mediaType: 'show', mediaId: showId, watchedAt,
    parts: temiz.map((p) => ({ season: p.sezon, episodes: p.bolumler })),
    media: mediaFor(showId, 'show', mediaData), skeleton: compactSkeleton(iskeletSezonlar),
    activity: { season: son.sezon, episode: son.bolumler[son.bolumler.length - 1] },
  }, 'markEpisodesUpToAsWatched');
  nesliArtir(showId);
  reactivateShowTracking(showId, mediaData);
  setShowProgressMap((prev: any) => {
    let yamali = prev[showId] || iskeletKur(iskeletSezonlar);
    for (const p of temiz) {
      const sonuc = bolumleriIsaretle(yamali, p.sezon, p.bolumler, watchedAt);
      if (sonuc) yamali = sonuc;
    }
    return yamali ? { ...prev, [showId]: yamali } : prev;
  });
  return finishShow(showId, 'markEpisodesUpToAsWatched');
};

export const markEpisodesUpToAsWatched = async (
  showId: number, season: number, episodes: number[], mediaData?: any, iskeletSezonlar?: any[] | null,
) => planiIsaretle(showId, [{ sezon: season, bolumler: episodes }], mediaData, iskeletSezonlar);

export const markMovieAsWatched = async (movieId: number, mediaData?: any) => {
  const watchedAt = nowStamp();
  await saveIntent({
    mediaType: 'movie', mediaId: movieId, watchedAt, parts: [{}],
    media: mediaFor(movieId, 'movie', mediaData),
  }, 'markMovieAsWatched');
  unhideMovieIfNeeded(movieId);
  let movieItemToMove: any = null;
  setWatchlistMovies((prev: any[]) => {
    movieItemToMove = prev.find((p: any) => p.movie?.ids?.trakt === movieId);
    const list = prev.filter((p: any) => p.movie?.ids?.trakt !== movieId);
    safeStorageSet(CACHE_KEYS.watchlistMovies, JSON.stringify(list));
    return list;
  });
  setWatchedMovies((prev: any[]) => {
    const list = izlenenFilmeEkle(prev, movieId, movieItemToMove?.movie || mediaData);
    safeStorageSet(CACHE_KEYS.watchedMovies, JSON.stringify(list));
    return list;
  });
  setCalendarMovies((prev: any[]) => {
    const list = (prev || []).filter((p: any) => p.movie?.ids?.trakt !== movieId);
    safeStorageSet(CACHE_KEYS.calendarMovies, JSON.stringify(list));
    return list;
  });
  recordMutationResult('markMovieAsWatched', true);
  resumeWatchedOutbox();
};
