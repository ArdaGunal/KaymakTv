import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// K2 · LAZYFETCH-01 (M531) — canlı bulgu: Pi'nin kendi TMDB kotası dolunca (503) istemci afişi
// belleğe `null` yazıyor, `peekPosterCache` bunu isabet sayıyor → afiş o oturumda bir daha denenmiyordu.
// Kural: «görsel YOK» yalnız KESİN cevapta (başarılı yanıtta boş yol ya da 404) saklanır.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('AFIS ONBELLEGI (K2 · M531)', { kokOneki: 'afis-' });

let sonraki = []; // sıradaki axios.get davranışları
const istekler = [];
const disk = new Map();
const hata = (status, code) => Object.assign(new Error(status ? `Request failed with status code ${status}` : 'Network Error'),
  status ? { response: { status } } : { code: code || 'ERR_NETWORK' });

const load = tsLoader(root, {
  axios: { default: { get: async (url, cfg) => {
    istekler.push(cfg.params.endpoint);
    const d = sonraki.shift();
    if (d instanceof Error) throw d;
    return { data: d };
  } } },
  '../locales/index': { default: { language: 'tr' } },
  '../utils/cacheManager': { cacheManager: { get: async (k) => disk.get(k) ?? null, set: async (k, v) => { disk.set(k, v); } } },
  '../utils/cacheTTL': { CACHE_TTL: { LONG: 7 * 864e5 } },
});
const A = load('services/tmdbApi.ts');

T.H('Gecici hata (503 / 5xx / zaman asimi / ag) afisi "yok" diye SAKLAMAZ');
for (const [ad, e, id] of [
  ['Pi kotasi 503', hata(503), 101], ['TMDB 500', hata(500), 102], ['429', hata(429), 103],
  ['zaman asimi', hata(0, 'ECONNABORTED'), 104], ['ag kopmasi', hata(0), 105],
]) {
  sonraki = [e];
  const url = await A.getShowPoster(id);
  T.ok(`${ad}: null doner ama onbellege YAZILMAZ`, url === null && A.peekPosterCache('show', id).hit === false,
    JSON.stringify(A.peekPosterCache('show', id)));
}
sonraki = [hata(503), { poster_path: '/abc.jpg' }];
await A.getMoviePoster(201);
const ikinci = await A.getMoviePoster(201);
T.ok('🔴 503 sonrasi IKINCI deneme agdan afisi alir (eskiden oturum boyu yer tutucu)',
  ikinci === 'https://image.tmdb.org/t/p/w500/abc.jpg' && A.peekPosterCache('movie', 201).url === ikinci, String(ikinci));

T.H('Kesin "yok" cevabi saklanir (gereksiz tekrar yok)');
sonraki = [{ poster_path: null }];
await A.getShowPoster(301);
T.ok('Basarili yanit + poster_path null -> "yok" saklanir', A.peekPosterCache('show', 301).hit === true && A.peekPosterCache('show', 301).url === null);
sonraki = [hata(404)];
await A.getMoviePoster(302);
T.ok('404 -> "yok" saklanir', A.peekPosterCache('movie', 302).hit === true);
// Tekrarı önleyen kapı `MediaPoster`'daki `peekPosterCache` (isabet → `getShowPoster` hiç çağrılmaz).
T.ok('Saklanan "yok" MediaPoster kapisinda isabet (aga tekrar gidilmez)', A.peekPosterCache('show', 301).hit === true);

T.H('Ayni kural arka plan / bolum gorseli / fragmanda');
sonraki = [hata(503), { backdrops: [{ file_path: '/bd.jpg' }] }];
await A.getShowBackdrop(401);
T.ok('Arka plan: 503 sonrasi yeniden dener', (await A.getShowBackdrop(401)) === 'https://image.tmdb.org/t/p/w1280/bd.jpg');
sonraki = [hata(0), { still_path: '/st.jpg' }];
await A.getEpisodeStill(402, 1, 1);
T.ok('Bolum gorseli: ag hatasi sonrasi yeniden dener', (await A.getEpisodeStill(402, 1, 1)) === 'https://image.tmdb.org/t/p/w1280/st.jpg');
sonraki = [hata(502), { results: [{ site: 'YouTube', type: 'Trailer', key: 'yt1' }] }];
await A.getMovieTrailer(403);
T.ok('Fragman: 502 sonrasi yeniden dener', (await A.getMovieTrailer(403)) === 'yt1');
sonraki = [hata(404)];
await A.getShowBackdrop(404);
const once2 = istekler.length;
await A.getShowBackdrop(404);
T.ok('Arka plan: 404 saklanir, tekrar istenmez', istekler.length === once2);
T.bitir();
