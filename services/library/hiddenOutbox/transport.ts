import axios from 'axios';
import type { HiddenJob, HiddenSession, HiddenSnapshot } from './types';

const worker = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';
// Mevcut hidden API ile aynı CORS köprüsü; global SecureStore token'ı okunmaz.
const proxy = process.env.EXPO_PUBLIC_API_URL ? `${process.env.EXPO_PUBLIC_API_URL}/api/trakt-proxy` : '/api/trakt-proxy';
const config = (s: HiddenSession, endpoint: string) => ({
  params: { endpoint }, headers: { Authorization: `Bearer ${s.token}` }, timeout: 15000,
});
async function workerPost(path: string, body: object, s: HiddenSession) {
  if (!worker) throw new Error('Gizleme sunucusu tanımlı değil.');
  const res = await axios.post(`${worker}${path}`, { ...body, traktAccessToken: s.token }, { timeout: 15000 });
  if (res.data?.success !== true || res.data?.eksik) throw new Error('Gizleme sunucusu işlemi tamamlamadı.');
  return res.data;
}
export async function sendHidden(job: HiddenJob, s: HiddenSession) {
  if (job.trakt !== s.trakt) throw new Error('Gizleme sağlayıcısı değişti; önceki günlük korunuyor.');
  if (!job.trakt) {
    await workerPost('/library/hidden', { op: job.hidden ? 'ekle' : 'sil',
      trakt: job.mediaType === 'show' ? { showId: job.mediaId } : { movieId: job.mediaId } }, s);
    return;
  }
  if (!s.trakt) throw new Error('Google-only oturum Trakt gizlemesi yazamaz.');
  const section = job.mediaType === 'show' ? 'progress_watched' : 'calendar';
  await axios.post(proxy, { [job.mediaType === 'show' ? 'shows' : 'movies']: [{ ids: { trakt: job.mediaId } }] },
    config(s, `/users/hidden/${section}${job.hidden ? '' : '/remove'}`));
}
async function readTraktHidden(type: 'show' | 'movie', s: HiddenSession): Promise<number[]> {
  const ids: number[] = [];
  let pages = 1;
  for (let page = 1; page <= pages; page++) {
    const section = type === 'show' ? 'progress_watched' : 'calendar';
    const base = config(s, `/users/hidden/${section}`);
    const res = await axios.get(proxy, { ...base, params: { ...base.params, type, page, limit: 100, _: Date.now() } });
    if (!Array.isArray(res.data)) throw new Error('Gizlenenler listesi okunamadı.');
    const count = Number(res.headers['x-pagination-page-count']);
    if ((!Number.isInteger(count) && res.data.length >= 100) || count > 100) {
      throw new Error('Gizlenenler listesi tam okunamadı; günlük korunuyor.');
    }
    pages = Number.isInteger(count) && count > 0 ? count : 1;
    for (const row of res.data) {
      const id = row?.[type]?.ids?.trakt;
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Geçersiz gizlenenler yanıtı.');
      ids.push(id);
    }
  }
  return ids;
}
export async function readHiddenSnapshot(s: HiddenSession, jobs: HiddenJob[]): Promise<HiddenSnapshot> {
  if (jobs.some((job) => job.trakt !== s.trakt)) {
    throw new Error('Gizleme sağlayıcısı değişti; önceki sağlayıcının günlüğü korunuyor.');
  }
  if (s.trakt) return { show: await readTraktHidden('show', s), movie: await readTraktHidden('movie', s) };
  const data = await workerPost('/library/sync', {}, s);
  if (data.kirpildi || !Array.isArray(data.gizliDiziler) || !Array.isArray(data.gizliFilmler)) {
    throw new Error('Gizleme anlık görüntüsü eksik; günlük korunuyor.');
  }
  return { show: data.gizliDiziler, movie: data.gizliFilmler };
}
