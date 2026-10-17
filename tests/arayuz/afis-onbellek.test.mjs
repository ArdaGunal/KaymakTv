import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// K2 · LAZYFETCH-01 (M531) — canlı bulgu: Pi'nin kendi TMDB kotası dolunca (503) istemci afişi
// belleğe `null` yazıyor, `peekPosterCache` bunu isabet sayıyor → afiş o oturumda bir daha denenmiyordu.
// Kural: «görsel YOK» yalnız KESİN cevapta (başarılı yanıtta boş yol ya da 404) saklanır.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('AFIS ONBELLEGI (K2 · M531)', { kokOneki: 'afis-' });

let sonraki = []; // sıradaki /api/tmdb davranışları
const istekler = [];
const yedekler = new Map(); // 'show:123' -> /api/afis-yedek cevabındaki url (K1(b))
const yedekIstekleri = [];
const disk = new Map();
const hata = (status, code) => Object.assign(new Error(status ? `Request failed with status code ${status}` : 'Network Error'),
  status ? { response: { status } } : { code: code || 'ERR_NETWORK' });

const load = tsLoader(root, {
  axios: { default: { get: async (url, cfg) => {
    if (url.includes('afis-yedek')) {
      yedekIstekleri.push(`${cfg.params.tur}:${cfg.params.tmdb}`);
      return { data: { url: yedekler.get(`${cfg.params.tur}:${cfg.params.tmdb}`) ?? null } };
    }
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

T.H('K1(b) · M532 — TMDB afis vermezse arsivdeki Trakt afisi');
const TRAKT = 'https://media.trakt.tv/images/shows/000/002/177/posters/medium/9cb5875b93.jpg.webp';
yedekler.set('show:501', TRAKT);
sonraki = [{ poster_path: null }];
T.ok('TMDB de yol yok -> Trakt yedegi doner', (await A.getShowPoster(501)) === TRAKT);
T.ok('Kesin cevapta yedek KALICI saklanir (disk)', disk.get('@tmdb_poster_cache_show_501') === TRAKT && A.peekPosterCache('show', 501).url === TRAKT);

yedekler.set('movie:502', TRAKT);
sonraki = [hata(503)];
T.ok('🔴 Pi kotasi 503 -> Trakt yedegi doner (eskiden yer tutucu)', (await A.getMoviePoster(502)) === TRAKT);
T.ok('Gecici hatada yedek YALNIZ oturumluk (diske yazilmaz)', A.peekPosterCache('movie', 502).url === TRAKT && !disk.has('@tmdb_poster_cache_movie_502'));

sonraki = [hata(0)];
T.ok('Ag hatasi + yedek yok -> null, onbellege yazilmaz', (await A.getShowPoster(503)) === null && A.peekPosterCache('show', 503).hit === false);

yedekler.set('show:504', 'https://kotu.example.com/afis.jpg');
sonraki = [{ poster_path: null }];
T.ok('🔒 Trakt disi sunucu adresi REDDEDILIR', (await A.getShowPoster(504)) === null);

const y0 = yedekIstekleri.length;
sonraki = [{ poster_path: '/var.jpg' }];
await A.getShowPoster(505);
T.ok('TMDB afisi varsa yedek HIC sorulmaz', yedekIstekleri.length === y0);
T.bitir();
