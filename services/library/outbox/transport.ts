import axios from 'axios';
import type { OutboxSession, WatchedJob, WatchedPart } from './types';
import { formatEpisodeCode } from '../../../features/feed/services/feedPublish';
import type { KutuphaneYaniti } from '../../api/library';

const worker = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';
const headers = (s: OutboxSession) => ({
  Authorization: `Bearer ${s.token}`, 'trakt-api-version': '2',
  'trakt-api-key': process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID || '',
});
const traktGet = (path: string, s: OutboxSession, params?: any) =>
  axios.get(`https://api.trakt.tv${path}`, { headers: headers(s), params, timeout: 15000 });
const workerPost = async (path: string, body: any, s: OutboxSession) => {
  if (!worker) throw new Error('İşaretleme sunucusu tanımlı değil.');
  // Gövdeye owner/userId verilmez; sunucu çağıranı yakalanmış token'dan çözer.
  const res = await axios.post(`${worker}${path}`, { ...body, traktAccessToken: s.token }, { timeout: 15000 });
  if (res.data?.success === false) throw new Error('İşaretleme sunucusu işlemi tamamlamadı.');
  return res.data;
};

export async function expandWatchedSeason(job: WatchedJob, part: WatchedPart): Promise<number[]> {
  // Google-only token Trakt'a ASLA gönderilmez; bu uç PUBLIC katalog okuması.
  const res = await axios.get(`https://api.trakt.tv/shows/${job.mediaId}/seasons/${part.season}`, {
    headers: { 'trakt-api-version': '2', 'trakt-api-key': process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID || '' },
    params: { extended: 'full' }, timeout: 15000,
  });
  if (!Array.isArray(res.data)) throw new Error('Sezon kataloğu okunamadı.');
  return res.data.filter((e: any) => Number.isInteger(e.number) && e.number > 0
    && e.first_aired && Date.parse(e.first_aired) <= Date.parse(job.watchedAt)).map((e: any) => e.number);
}

export async function writeKaymakWatched(job: WatchedJob, part: WatchedPart, s: OutboxSession) {
  const trakt = job.mediaType === 'movie' ? { movieId: job.mediaId }
    : { showId: job.mediaId, season: part.season, episodes: part.episodes };
  const data = await workerPost('/library/watched', { op: 'ekle', trakt, watchedAt: job.watchedAt }, s);
  const expected = job.mediaType === 'movie' ? 1 : (part.episodes as number[]).length;
  // Kısmi katalog yanıtı tamamlanmış SAYILMAZ; aynı damga ile tekrar güvenli.
  if (data.eksik || data.yazilan !== expected) throw new Error('İşaretlemenin bazı bölümleri henüz kaydedilemedi.');
}

/** Trakt item+watched_at tekilleştirmez. Belirsiz POST'u körlemesine tekrarlama. */
export async function missingTraktWatches(job: WatchedJob, part: WatchedPart, s: OutboxSession): Promise<number[]> {
  const existing = new Set<number>();
  const at = Date.parse(job.watchedAt);
  const type = job.mediaType === 'movie' ? 'movies' : 'shows';
  let pages = 1;
  for (let page = 1; page <= pages; page++) {
    const res = await traktGet(`/users/me/history/${type}/${job.mediaId}`, s, {
      start_at: new Date(at - 1000).toISOString(), end_at: new Date(at + 1000).toISOString(), page, limit: 100,
    });
    if (!Array.isArray(res.data)) throw new Error('Trakt geçmişi doğrulanamadı.');
    const pageCount = Number(res.headers['x-pagination-page-count']);
    if ((!Number.isInteger(pageCount) && res.data.length >= 100) || pageCount > 20) {
      throw new Error('Trakt geçmişi tam okunamadı; çift kayıt riski nedeniyle yazma bekletildi.');
    }
    pages = Number.isInteger(pageCount) && pageCount > 0 ? pageCount : 1;
    for (const row of res.data) {
      if (Date.parse(row.watched_at) !== at) continue;
      if (job.mediaType === 'movie' && row.movie?.ids?.trakt === job.mediaId) existing.add(0);
      if (job.mediaType === 'show' && row.show?.ids?.trakt === job.mediaId && row.episode?.season === part.season) {
        existing.add(row.episode.number);
      }
    }
  }
  const targets = job.mediaType === 'movie' ? [0] : part.episodes as number[];
  return targets.filter((e) => !existing.has(e));
}

export async function writeTraktWatched(job: WatchedJob, part: WatchedPart, s: OutboxSession) {
  if (!s.trakt || !job.trakt) throw new Error('Google-only oturum Trakt yazamaz.');
  const missing = part.traktStarted ? await missingTraktWatches(job, part, s)
    : job.mediaType === 'movie' ? [0] : part.episodes as number[];
  if (!missing.length) return;
  const body = job.mediaType === 'movie'
    ? { movies: [{ ids: { trakt: job.mediaId }, watched_at: job.watchedAt }] }
    : { shows: [{ ids: { trakt: job.mediaId }, seasons: [{ number: part.season,
      episodes: missing.map((number) => ({ number, watched_at: job.watchedAt })) }] }] };
  const res = await axios.post('https://api.trakt.tv/sync/history', body, { headers: headers(s), timeout: 15000 });
  const added = job.mediaType === 'movie' ? res.data?.added?.movies : res.data?.added?.episodes;
  if (added !== missing.length) throw new Error('Trakt yazmasının tamamı doğrulanamadı.');
}

export async function publishWatched(job: WatchedJob, s: OutboxSession) {
  if (!job.media?.title || (job.mediaType === 'show' && !job.activity)) return;
  const activity = {
    activityType: job.mediaType === 'movie' ? 'watched_movie' : 'watched_episode',
    showId: job.mediaId, mediaType: job.mediaType, showTitle: job.media.title,
    tmdbId: job.media.ids?.tmdb, activityAt: job.watchedAt,
    ...(job.activity ? { episodeNumber: formatEpisodeCode(job.activity.season, job.activity.episode) } : {}),
  };
  await workerPost('/feed/publish', { activities: [activity] }, s);
}

export const readWatchedSnapshot = (s: OutboxSession): Promise<KutuphaneYaniti> =>
  workerPost('/library/sync', {}, s);
