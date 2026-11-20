// ==========================================================================
// G-11 — TMDB proxy yol + parametre izin listesi, önbellek anahtarı kaçışı ve sürümü
// ==========================================================================
// Bulgu: `/api/tmdb` yolu normalize edip kalan HER query'yi TMDB'ye geçiriyordu; rota listesi
// dışındaki yol PASSTHRU oluyordu; `session_id` gibi parametreler upstream'e gidip anahtardan
// siliniyordu; anahtar çiftleri kaçışsız birleşiyordu ({language:'tr',x:'y'} ≡ {language:'tr&x=y'}).
// Ağ yok: `axios.get` sahte. Gerçek SSD'ye dokunulmaz (yardimci.js geçici kök).

const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { baslat, LF, PROJE_KOKU } = require('../yardimci');

const T = baslat('G-11 — TMDB PROXY IZIN LISTESI + ANAHTAR', { kokOneki: 'lf-g11-' });
process.env.TMDB_API_KEY = 'sunucu-test-anahtari';

const axios = require('axios');
const cagrilar = [];
axios.get = async (url, cfg) => {
  cagrilar.push({ url, cfg });
  const id = Number((url.match(/\/(\d+)(?:\/|$)/) || [])[1]) || 0;
  return { data: { id, dil: cfg?.params?.language || null }, headers: { 'cache-control': 'public, max-age=3600' } };
};

const express = require('express');
const key = require(path.join(LF, 'key'));
const { createEnvelope } = require(path.join(LF, 'envelope'));
const { writeCacheEntry } = require(path.join(LF, 'diskStore'));
const tmdbRouter = require(path.join(PROJE_KOKU, 'server', 'tmdbProxy'));
const { tmdbIstegiDenetle } = tmdbRouter;

// G-11 öncesi kanonik biçim (k sürümü yok) — eski diskteki kayıtların hash'i buydu.
const eskiHash = (provider, family, yol, sorgu) =>
  crypto.createHash('sha256').update(['v1', provider, family, 'GET', yol, sorgu].join('|')).digest('hex');

(async () => {
  // ======================================================================
  T.H('1 · Istemcinin GERCEK cagri bicimleri izinli (services/tmdbApi.ts, tmdbPerson.ts, tmdbBasliklari.ts)');
  // ======================================================================
  const istemciYollari = [
    ['/tv/1396', true], ['/movie/603', true], ['/tv/1396/images', false], ['/tv/1396/videos', true],
    ['/movie/603/videos', true], ['/tv/1396/season/1/episode/1', true], ['/tv/1396/credits', true],
    ['/movie/603/credits', true], ['/tv/1396/season/1/episode/1/credits', true], ['/person/17419', true],
  ];
  for (const [yol, dilli] of istemciYollari) {
    const s = dilli ? { endpoint: yol, language: 'tr-TR' } : { endpoint: yol };
    const d = tmdbIstegiDenetle(s);
    T.ok(`izinli: ${yol}${dilli ? ' + language' : ''}`, d.ok && d.endpoint === yol
      && JSON.stringify(d.query) === JSON.stringify(dilli ? { language: 'tr-TR' } : {}));
  }
  T.ok('basinda / olmayan yol normalize edilir', tmdbIstegiDenetle({ endpoint: 'tv/1', language: 'en-US' }).endpoint === '/tv/1');
  T.ok('BCP 47 bolge/yazi etiketi kabul (pt-BR, zh-Hant)', tmdbIstegiDenetle({ endpoint: '/tv/1', language: 'pt-BR' }).ok
    && tmdbIstegiDenetle({ endpoint: '/tv/1', language: 'zh-Hant' }).ok);

  // ======================================================================
  T.H('2 · Izin disi yol ve parametre reddedilir (saf denetim)');
  // ======================================================================
  const kotuYollar = [
    '/tv/1/account_states', '/movie/1/account_states', '/account/1/watchlist/tv', '/search/tv',
    '/authentication/token/new', '/tv/1/', '/tv/abc', '/../tv/1', '/tv/1?append_to_response=account_states',
    '/tv/1/season/1', '/list/1', '/configuration', '/' + 'a'.repeat(250),
  ];
  for (const yol of kotuYollar) {
    T.ok(`ret (yol): ${yol.slice(0, 50)}`, tmdbIstegiDenetle({ endpoint: yol }).ok === false);
  }
  const kotuParametreler = [
    ['session_id', 'x'], ['guest_session_id', 'x'], ['request_token', 'x'], ['api_key', 'x'],
    ['append_to_response', 'account_states'], ['append_to_response', 'credits'], ['include_adult', 'true'],
    ['Language', 'tr-TR'], ['_', '123'], ['page', '2'],
  ];
  for (const [ad, deger] of kotuParametreler) {
    T.ok(`ret (parametre): ${ad}`, tmdbIstegiDenetle({ endpoint: '/tv/1', language: 'tr-TR', [ad]: deger }).ok === false);
  }
  const kotuDiller = ['tr&x=y', 'tr=TR', '', 'TR-tr', 'tr-TR-x-uzun-bir-sey', '../../etc'];
  for (const dil of kotuDiller) {
    T.ok(`ret (dil degeri): "${dil}"`, tmdbIstegiDenetle({ endpoint: '/tv/1', language: dil }).ok === false);
  }
  T.ok('ret: language dizi ([tr-TR, en-US])', tmdbIstegiDenetle({ endpoint: '/tv/1', language: ['tr-TR', 'en-US'] }).ok === false);
  T.ok('ret: language nesne ({a:1})', tmdbIstegiDenetle({ endpoint: '/tv/1', language: { a: '1' } }).ok === false);
  T.ok('ret: endpoint yok / dizi', tmdbIstegiDenetle({}).ok === false && tmdbIstegiDenetle({ endpoint: ['/tv/1'] }).ok === false);

  // ======================================================================
  T.H('3 · HTTP: izinli istek gecer, izin disi 400 ve upstream e HIC gidilmez');
  // ======================================================================
  const app = express();
  app.use('/api/tmdb', tmdbRouter);
  const sunucu = app.listen(0);
  const port = sunucu.address().port;
  const getir = (yol) => new Promise((coz, red) => {
    http.get({ host: '127.0.0.1', port, path: yol, agent: false }, (y) => {
      let g = ''; y.on('data', (c) => { g += c; });
      y.on('end', () => coz({ status: y.statusCode, lf: y.headers['x-lazyfetch'], govde: g }));
    }).on('error', red);
  });

  const once = cagrilar.length;
  const iyi = await getir('/api/tmdb?endpoint=/tv/7&language=tr-TR');
  const giden = cagrilar[cagrilar.length - 1];
  T.ok('izinli: 200 + miss', iyi.status === 200 && iyi.lf === 'miss', `${iyi.status} ${iyi.lf}`);
  T.ok('upstream e yalniz language + sunucu anahtari gider', cagrilar.length === once + 1
    && JSON.stringify(Object.keys(giden.cfg.params).sort()) === '["api_key","language"]'
    && giden.cfg.params.api_key === 'sunucu-test-anahtari', JSON.stringify(giden.cfg.params));
  const dilsiz = await getir('/api/tmdb?endpoint=/tv/7');
  T.ok('dilsiz izinli istek (web-guvenlik testindeki bicim) gecer', dilsiz.status === 200, String(dilsiz.status));

  const retler = [
    '/api/tmdb?endpoint=/tv/7&session_id=GIZLI-OTURUM',
    '/api/tmdb?endpoint=/tv/7&language=tr-TR&append_to_response=account_states',
    '/api/tmdb?endpoint=/tv/7/account_states&session_id=GIZLI-OTURUM',
    '/api/tmdb?endpoint=/account/1/watchlist/tv',
    '/api/tmdb?endpoint=/tv/7&language=tr-TR%26x%3Dy',
    '/api/tmdb?endpoint=/tv/7&language=tr-TR&language=en-US',
    '/api/tmdb?endpoint=/tv/7&guest_session_id=abc',
  ];
  for (const yol of retler) {
    const sayac = cagrilar.length;
    const y = await getir(yol);
    T.ok(`400 + kisa govde + upstream yok: ${yol.slice(9, 70)}`, y.status === 400
      && y.govde === '{"error":"Bad request"}' && cagrilar.length === sayac, `${y.status} ${y.govde}`);
  }
  const eskiTip = await getir('/api/tmdb?endpoint=a&endpoint=b');
  T.ok('D-9 korunur: dizi endpoint 400 (eski mesaj)', eskiTip.status === 400 && /Endpoint is required/.test(eskiTip.govde));

  // ======================================================================
  T.H('4 · Farkli parametre setleri ayri anahtar (ayrac kacisi)');
  // ======================================================================
  const k = (q, provider = 'tmdb', family = 'tv_detail', yol = '/tv/1') => key.buildCacheKey({ provider, family, path: yol, query: q }).hash;
  T.ok("{language:'tr',x:'y'} ≠ {language:'tr&x=y'} (G-11 ornegi)", k({ language: 'tr', x: 'y' }) !== k({ language: 'tr&x=y' }));
  T.ok("{a:'b=c'} ≠ {'a=b':'c'}", k({ a: 'b=c' }) !== k({ 'a=b': 'c' }));
  T.ok("literal '%26' ≠ '&'", k({ q: 'a%26b' }) !== k({ q: 'a&b' }));
  T.ok('Trakt tarafinda da: {extended:full&page=2} ≠ {extended:full, page:2}',
    k({ extended: 'full&page=2' }, 'trakt', 'show_detail', '/shows/1') !== k({ extended: 'full', page: '2' }, 'trakt', 'show_detail', '/shows/1'));
  T.ok('tr-TR ≠ en-US (dil anahtarin parcasi)', k({ language: 'tr-TR' }) !== k({ language: 'en-US' }));
  T.ok('sira bagimsizligi korunur', k({ a: '1', b: '2' }) === k({ b: '2', a: '1' }));
  T.ok('normalizeQuery: ayrac icermeyen deger aynen (envelope.requestQuery bicimi)', key.normalizeQuery({ language: 'tr-TR' }) === 'language=tr-TR');
  T.ok('normalizeQuery: ayraclar kacisli', key.normalizeQuery({ q: 'a&b=c%' }) === 'q=a%26b%3Dc%25', key.normalizeQuery({ q: 'a&b=c%' }));

  const t1 = await getir('/api/tmdb?endpoint=/tv/8&language=tr-TR');
  const t2 = await getir('/api/tmdb?endpoint=/tv/8&language=en-US');
  const t3 = await getir('/api/tmdb?endpoint=/tv/8&language=tr-TR');
  T.ok('uctan uca: iki dil iki ayri kayit, ucuncu istek isabet', t1.lf === 'miss' && t2.lf === 'miss' && t3.lf === 'fresh'
    && JSON.parse(t2.govde).dil === 'en-US' && JSON.parse(t3.govde).dil === 'tr-TR', `${t1.lf} ${t2.lf} ${t3.lf}`);

  // ======================================================================
  T.H('5 · Anahtar surumu: TMDB 2 (eski kayit okunmaz), Trakt 1 (soğumaz)');
  // ======================================================================
  T.ok('TMDB anahtar surumu 2, Trakt 1', key.anahtarSurumu('tmdb') === 2 && key.anahtarSurumu('trakt') === 1);
  T.ok('TMDB hash i G-11 oncesinden FARKLI', k({ language: 'tr-TR' }, 'tmdb', 'tv_detail', '/tv/1396') !== eskiHash('tmdb', 'tv_detail', '/tv/1396', 'language=tr-TR'));
  T.ok('Trakt hash i G-11 oncesiyle BAYT BAYT AYNI (Trakt onbellegi soğumaz)',
    k({ extended: 'full' }, 'trakt', 'show_detail', '/shows/1388') === eskiHash('trakt', 'show_detail', '/shows/1388', 'extended=full'));

  // Eski anahtarla diske yazilmis bir TMDB kaydi: yeni kod onu GORMEMELI (miss → upstream).
  const eski = eskiHash('tmdb', 'tv_detail', '/tv/9', 'language=tr-TR');
  const eskiYol = `tmdb/tv_detail/${eski.slice(0, 2)}/${eski}.json.gz`;
  const yazim = await writeCacheEntry(eskiYol, createEnvelope({
    provider: 'tmdb', family: 'tv_detail', payload: { id: 9, dil: 'ESKI-ZEHIRLI' },
    ttlMs: 30 * 86400000, graceMs: 150 * 86400000, requestPath: '/tv/9', requestQuery: 'language=tr-TR',
  }));
  T.ok('eski surum kaydi diske yazildi (kurulum)', yazim.ok === true, JSON.stringify(yazim));
  const sayac = cagrilar.length;
  const yeni = await getir('/api/tmdb?endpoint=/tv/9&language=tr-TR');
  T.ok('eski surum kaydi servis EDILMEZ: miss + upstream e gidildi', yeni.lf === 'miss' && cagrilar.length === sayac + 1
    && JSON.parse(yeni.govde).dil === 'tr-TR', `${yeni.lf} ${yeni.govde}`);

  sunucu.closeAllConnections();
  sunucu.close();
  T.bitir();
})().catch((e) => { console.error(e); process.exit(1); });
