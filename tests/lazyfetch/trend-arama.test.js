// ==========================================================================
// K5 (M533) — /api/trakt-proxy GET: trend + arama önbellekten, arşivden yerel arama
// ==========================================================================
// Ağ yok: `axios.get` sahte Trakt'a bağlanır (sağlayıcı adaptörü ve katman aynı
// axios modülünü kullanıyor). Gerçek Express, gerçek orkestratör, gerçek arşiv.

const path = require('path');
const http = require('http');
const { baslat, LF, AR, PROJE_KOKU } = require('../yardimci');

const T = baslat('TREND + ARAMA ONBELLEGI (K5)', { kokOneki: 'lf-trend-' });
process.env.ARCHIVE_ROOT = path.join(T.kok, 'archive');
process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID = 'public-test-id';

const axios = require('axios');
let trakt = async () => ({ data: [], headers: {} });
const cagrilar = [];
axios.get = async (url, cfg) => { cagrilar.push({ url, cfg }); return trakt(url, cfg); };

const express = require('express');
const rr = require(path.join(LF, 'routeRegistry'));
const tb = require(path.join(LF, 'tokenBucket'));
const { initArchive } = require(path.join(AR, 'db'));
const { archiveCatalogResponse } = require(path.join(AR, 'writer'));
const katman = require(path.join(PROJE_KOKU, 'server', 'traktProxyOnbellek'));

const TREND = [{ watchers: 10, show: { title: 'Dark', ids: { trakt: 1, tmdb: 70523 } } }];
const ARAMA = [{ type: 'show', score: 900, show: { title: 'Dark', ids: { trakt: 1, tmdb: 70523 } } }];

(async () => {
  T.ok('Arsiv acildi', initArchive().enabled);

  T.H('TTL politikasi');
  const t = rr.resolveTtl(43200, { family: 'trending' });
  T.ok('trending: 1 sa taze + 23 sa bayat (saglayicinin 12 sa beyani YOK SAYILIR)', t.ttlMs === 3600e3 && t.graceMs === 23 * 3600e3, JSON.stringify(t));
  const s = rr.resolveTtl(undefined, { family: 'search' });
  T.ok('search: 1 sa / 24 sa', s.ttlMs === 3600e3 && s.ttlMs + s.graceMs === 24 * 3600e3);
  T.ok('Katalog politikasi degismedi (show_detail 30 gun)', rr.resolveTtl(0, { family: 'show_detail' }).ttlMs === 30 * 864e5);

  T.H('Sorgu sadelestirme');
  T.ok('Bilinmeyen parametre anahtara girmez', JSON.stringify(katman.sadeSorgu({ endpoint: '/x', query: 'a', foo: '1', _: '9' })) === '{"query":"a"}');
  T.ok('Arama metni: yalniz bosluk sade, harfler AYNEN', katman.sadeSorgu({ query: '  Breaking   BAD ' }).query === 'Breaking BAD');
  T.ok('🔴 M535: harf KUCULTULMEZ (Trakt «severance» 0, «Severance» 1 donduruyor)', katman.sadeSorgu({ query: 'Severance' }).query === 'Severance');

  const app = express();
  app.get('/api/trakt-proxy', katman);
  app.get('/api/trakt-proxy', (req, res) => res.json({ eski: true }));
  const sunucu = app.listen(0);
  const port = sunucu.address().port;
  const getir = (q, basliklar = {}) => new Promise((coz, red) => {
    http.get({ host: '127.0.0.1', port, path: '/api/trakt-proxy?' + q, agent: false, headers: basliklar }, (y) => {
      let b = ''; y.on('data', (c) => { b += c; });
      y.on('end', () => coz({ status: y.statusCode, lf: y.headers['x-lazyfetch'], govde: JSON.parse(b) }));
    }).on('error', red);
  });

  T.H('Trend ve arama onbellekten');
  trakt = async () => ({ data: TREND, headers: { 'cache-control': 'public, s-maxage=3600' } });
  const t1 = await getir('endpoint=/shows/trending&extended=full&page=1&limit=7', { authorization: 'Bearer GIZLI' });
  const t2 = await getir('endpoint=/shows/trending&extended=full&page=1&limit=7');
  T.ok('Ilk istek miss, ikinci fresh — Trakt a TEK cagri', t1.lf === 'miss' && t2.lf === 'fresh' && cagrilar.length === 1, `${t1.lf}/${t2.lf} ${cagrilar.length}`);
  T.ok('🔒 Authorization Trakt a GITMEDI', !cagrilar[0].cfg.headers.Authorization && !JSON.stringify(cagrilar[0].cfg).includes('GIZLI'));
  T.ok('Veri ayni', t2.govde[0].show.title === 'Dark');

  trakt = async () => ({ data: ARAMA, headers: {} });
  const c0 = cagrilar.length;
  await getir('endpoint=/search/show&query=Dark&extended=full');
  const a2 = await getir('endpoint=/search/show&query=%20Dark%20&extended=full');
  T.ok('«Dark» ve « Dark » ayni kayit (Trakt a tek cagri)', a2.lf === 'fresh' && cagrilar.length === c0 + 1, `${a2.lf} ${cagrilar.length - c0}`);
  const a3 = await getir('endpoint=/search/show&query=dark&extended=full');
  T.ok('🔴 M535: «dark» AYRI kayit — Trakt a kullanicinin yazdigi gider', a3.lf === 'miss' && cagrilar[cagrilar.length - 1].cfg.params.query === 'dark', a3.lf);
  T.ok('Bos arama -> [] (Trakt a gidilmez)', (await getir('endpoint=/search/show&query=%20')).govde.length === 0 && cagrilar.length === c0 + 2);

  trakt = async () => ({ data: [], headers: {} });
  const b1 = await getir('endpoint=/search/show&query=Bos&extended=full');
  const b2 = await getir('endpoint=/search/show&query=Bos&extended=full');
  T.ok('🔴 M535: BOS arama sonucu saklanmaz (iki istek de no-store, Trakt a yeniden sorulur)', b1.lf === 'no-store' && b2.lf === 'no-store', `${b1.lf}/${b2.lf}`);

  T.H('Diger yollar eski isleyiciye AYNEN duser');
  T.ok('/users/settings -> next()', (await getir('endpoint=/users/settings')).govde.eski === true);
  T.ok('/shows/popular -> next()', (await getir('endpoint=/shows/popular')).govde.eski === true);

  T.H('🔴 Kendi kovamiz doluysa hata DEGIL, dogrudan Trakt (K3 dersi)');
  while (tb.tryConsume('trakt')) { /* bosalt */ }
  trakt = async () => ({ data: ARAMA, headers: {} });
  const k = await getir('endpoint=/search/movie&query=yeni&extended=full');
  T.ok('Kova bos + MISS -> passthru-kapi, 200', k.status === 200 && k.lf === 'passthru-kapi', `${k.status} ${k.lf}`);
  await new Promise((r) => setTimeout(r, 5500)); // kova dolsun (2/sn)

  T.H('🔴 Trakt coktu -> arsivden yerel arama');
  await archiveCatalogResponse({ provider: 'trakt', family: 'show_detail', path: '/shows/1388', query: { extended: 'full', translations: 'tr' },
    data: { title: 'Breaking Bad', year: 2008, overview: 'Kimya ogretmeni', ids: { trakt: 1388, slug: 'breaking-bad', tmdb: 1396 } } });
  await archiveCatalogResponse({ provider: 'trakt', family: 'movie_detail', path: '/movies/481', query: { extended: 'full', translations: 'tr' },
    data: { title: 'The Matrix', year: 1999, ids: { trakt: 481, tmdb: 603 } } });
  trakt = async () => { throw Object.assign(new Error('Request failed with status code 503'), { response: { status: 503, data: 'down' } }); };
  const y = await getir('endpoint=/search/show&query=breaking&extended=full');
  T.ok('Trakt 503 + onbellek bos -> archive-search', y.status === 200 && y.lf === 'archive-search', `${y.status} ${y.lf}`);
  T.ok('Sonuc Trakt arama sekli + TAM kunye (ids.trakt, ids.tmdb, overview)',
    y.govde[0].type === 'show' && y.govde[0].show.ids.trakt === 1388 && y.govde[0].show.ids.tmdb === 1396 && y.govde[0].show.overview === 'Kimya ogretmeni');
  T.ok('Film aramasi dizi dondurmez', (await getir('endpoint=/search/movie&query=breaking&extended=full')).status === 503);
  const yuzde = await getir('endpoint=/search/show&query=%25&extended=full');
  T.ok('LIKE joker karakteri kalip olmaz («%» her seyi getirmez)', yuzde.status === 503);
  const tr2 = await getir('endpoint=/movies/trending&extended=full');
  T.ok('Trend icin yerel arama YOK (dürüst hata)', tr2.status === 503);

  sunucu.closeAllConnections();
  await new Promise((r) => sunucu.close(r));
  T.bitir();
})();
