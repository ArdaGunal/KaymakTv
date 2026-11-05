import axios from 'axios';
import { ciftYaz } from '../ciftYaz';
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
  const section = job.mediaType === 'show' ? 'progress_watched' : 'calendar';
  await ciftYaz(
    () => workerPost('/library/hidden', { op: job.hidden ? 'ekle' : 'sil',
      trakt: job.mediaType === 'show' ? { showId: job.mediaId } : { movieId: job.mediaId } }, s),
    job.trakt
      ? () => axios.post(proxy, { [job.mediaType === 'show' ? 'shows' : 'movies']: [{ ids: { trakt: job.mediaId } }] },
        config(s, `/users/hidden/${section}${job.hidden ? '' : '/remove'}`))
      : null,
  );
}
// 🔴 Anlık görüntü herkes için BİZDEN (M575): ekran `/library/sync`'ten okuyor.
export async function readHiddenSnapshot(s: HiddenSession, jobs: HiddenJob[]): Promise<HiddenSnapshot> {
  if (jobs.some((job) => job.trakt !== s.trakt)) {
    throw new Error('Gizleme sağlayıcısı değişti; önceki sağlayıcının günlüğü korunuyor.');
  }
  const data = await workerPost('/library/sync', {}, s);
  if (data.kirpildi || !Array.isArray(data.gizliDiziler) || !Array.isArray(data.gizliFilmler)) {
    throw new Error('Gizleme anlık görüntüsü eksik; günlük korunuyor.');
  }
  return { show: data.gizliDiziler, movie: data.gizliFilmler };
}
