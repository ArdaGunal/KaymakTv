// ==========================================================================
// DIŞ DENETİM REGRESYONU — LazyFetch tarafı (M548 Paket B · M550 Paket C/K2/K4)
// ==========================================================================
// Kaynak: `docs/Lazy Down Plan/07_DENETIM_TEYIT_VE_PLAN_2026-10-20.md`. R9 deponun gerçek modülleriyle
// yeniden üretilmişti: hiç dönmeyen bir HALF_OPEN sondası, sağlam sağlayıcıya giden TÜM ıskaları 10 dk
// sonra bile `CircuitOpenError` ile kilitliyordu. Ağ yok: `axios.get` sahte.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { baslat, LF, AR, PROJE_KOKU } = require('../yardimci');

const T = baslat('DIS DENETIM REGRESYONU — LAZYFETCH (M548/M550)', { kokOneki: 'lf-denetim-' });
process.env.ARCHIVE_ROOT = path.join(T.kok, 'archive');
process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID = 'public-test-id';

const axios = require('axios');
const cagrilar = [];
let saglayici = async () => ({ data: { id: 1 }, headers: {} });
axios.get = async (url, cfg) => { cagrilar.push({ url, cfg }); return saglayici(url, cfg); };

const express = require('express');
const orch = require(path.join(LF, 'orchestrator'));
const devre = require(path.join(LF, 'circuitBreaker'));
const kova = require(path.join(LF, 'tokenBucket'));
const { CircuitOpenError } = require(path.join(LF, 'errors'));
const { createTmdbFetcher } = require(path.join(LF, 'providers', 'tmdb'));
const { createTraktCatalogFetcher } = require(path.join(LF, 'providers', 'trakt'));
const { normalizeQuery } = require(path.join(LF, 'key'));
const { initArchive } = require(path.join(AR, 'db'));
const katman = require(path.join(PROJE_KOKU, 'server', 'traktProxyOnbellek'));
const katalogRouter = require(path.join(PROJE_KOKU, 'server', 'traktCatalog'));
const { clientIpKey } = require(path.join(PROJE_KOKU, 'server', 'security'));

const sonCagri = () => cagrilar[cagrilar.length - 1];

(async () => {
  T.ok('Arsiv acildi', initArchive().enabled);

  // ======================================================================
  T.H('Paket B — saglayici adaptorlerinde sure siniri (bosta + toplam)');
  // ======================================================================
  await createTmdbFetcher('k')('/tv/1', { language: 'tr-TR' });
  T.ok('TMDB: bosta 10 sn + toplam sinyal', sonCagri().cfg.timeout === 10_000 && sonCagri().cfg.signal instanceof AbortSignal);
  await createTraktCatalogFetcher('id')('/shows/1', { extended: 'full' });
  T.ok('Trakt katalog: bosta 10 sn + toplam sinyal', sonCagri().cfg.timeout === 10_000 && sonCagri().cfg.signal instanceof AbortSignal);

  const sunucuKaynagi = fs.readFileSync(path.join(PROJE_KOKU, 'server.js'), 'utf8');
  T.ok('server.js: 3 Trakt koprusu sure sinirli (GET, POST, oauth)', (sunucuKaynagi.match(/kopruSecenekleri\(\)/g) || []).length === 3);
  T.ok('server.js: https.Agent bosta soket zaman asimi', /new https\.Agent\(\{[^}]*timeout: 60_000/.test(sunucuKaynagi));
  const aynaKaynagi = fs.readFileSync(path.join(AR, 'mirror.js'), 'utf8');
  const backfillKaynagi = fs.readFileSync(path.join(AR, 'backfillSource.js'), 'utf8');
  T.ok('Ayna ve backfill fetch cagrilari sinirli', /AbortSignal\.timeout\(60_000\)/.test(aynaKaynagi) && (backfillKaynagi.match(/AbortSignal\.timeout\(30_000\)/g) || []).length === 2);

  // ======================================================================
  T.H('R9 · K-2 — asili HALF_OPEN sondasi ıskalari SURESIZ kilitlemez');
  // ======================================================================
  const basarisiz = () => Promise.reject(Object.assign(new Error('503'), { response: { status: 503 } }));
  for (let i = 0; i < 5; i++) await orch.resolveRequest({ provider: 'tmdb', path: `/tv/${100 + i}`, query: {}, fetcher: basarisiz }).catch(() => {});
  T.ok('5 hata → devre ACIK', devre.devreDurumu('tmdb').durum === 'OPEN', JSON.stringify(devre.devreDurumu('tmdb')));
  const gercek = Date.now;
  let kaydir = 31_000;
  Date.now = () => gercek() + kaydir;
  const sonda = orch.resolveRequest({ provider: 'tmdb', path: '/tv/200', query: {}, fetcher: () => new Promise(() => {}) });
  sonda.catch(() => {});
  await new Promise((r) => setTimeout(r, 30));
  const saglam = () => Promise.resolve({ data: { id: 1 } });
  let hemenKilit = 0;
  for (let i = 0; i < 3; i++) {
    try { await orch.resolveRequest({ provider: 'tmdb', path: `/tv/${300 + i}`, query: {}, fetcher: saglam }); } catch (e) { if (e instanceof CircuitOpenError) hemenKilit++; }
  }
  T.ok('Sonda ucustayken diger ıskalar bekler (tasarim geregi)', hemenKilit === 3);
  kaydir = 31_000 + 61_000; // iki acik-kalma suresi gecti, sonda hala asili
  let sonra;
  try { sonra = await orch.resolveRequest({ provider: 'tmdb', path: '/tv/400', query: {}, fetcher: saglam }); } catch (e) { sonra = e; }
  T.ok('🔴 Bekci: yeni sonda hakki verildi ve basarili (eskiden 10 dk sonra bile CircuitOpenError)', sonra && sonra.status === 'miss', sonra && (sonra.status || sonra.name));
  T.ok('Devre yeniden KAPALI', devre.devreDurumu('tmdb').durum === 'CLOSED');
  Date.now = gercek;

  // ======================================================================
  T.H('K2 — devre ACIKKEN dogrudan Trakt 4 sn, kova DOLUYKEN 15 sn');
  // ======================================================================
  const app = express();
  app.get('/api/trakt-proxy', katman);
  app.use('/api/trakt-catalog', katalogRouter);
  const sunucu = app.listen(0);
  const port = sunucu.address().port;
  const getir = (yol, basliklar = {}) => new Promise((coz, red) => {
    http.get({ host: '127.0.0.1', port, path: yol, agent: false, headers: basliklar }, (y) => {
      let b = ''; y.on('data', (c) => { b += c; });
      y.on('end', () => coz({ status: y.statusCode, lf: y.headers['x-lazyfetch'] }));
    }).on('error', red);
  });
  saglayici = async () => ({ data: [{ type: 'show', show: { title: 'X', ids: { trakt: 1 } } }], headers: {} });
  for (let i = 0; i < 5; i++) devre.recordFailure('trakt');
  const acik = await getir('/api/trakt-proxy?endpoint=/search/show&query=DevreAcik&extended=full');
  T.ok('Devre acik: dogrudan Trakt, sinir 4000 ms', acik.lf === 'passthru-kapi' && sonCagri().cfg.timeout === katman.DOGRUDAN_DEVRE_ACIK_MS && katman.DOGRUDAN_DEVRE_ACIK_MS === 4_000, `${acik.lf} ${sonCagri().cfg.timeout}`);
  devre.recordSuccess('trakt');
  while (kova.tryConsume('trakt')) { /* kovayi bosalt */ }
  const dolu = await getir('/api/trakt-proxy?endpoint=/search/show&query=KovaDolu&extended=full');
  T.ok('Kova dolu: dogrudan Trakt, sinir 15000 ms (M533 karari aynen)', dolu.lf === 'passthru-kapi' && sonCagri().cfg.timeout === 15_000, `${dolu.lf} ${sonCagri().cfg.timeout}`);

  // ======================================================================
  T.H('Paket C · K-1 — /api/trakt-catalog izinli parametre suzgeci');
  // ======================================================================
  await new Promise((r) => setTimeout(r, 1100)); // kova biraz dolsun (2/sn)
  saglayici = async () => ({ data: { title: 'Dizi', ids: { trakt: 42 } }, headers: {} });
  await getir('/api/trakt-catalog?endpoint=/shows/42&extended=full&translations=tr&foo=bar&api_key=SIZMA&session_id=S');
  const p1 = sonCagri().cfg.params;
  T.ok('🔴 Yalniz izinli parametreler saglayiciya gitti', JSON.stringify(Object.keys(p1).sort()) === '["extended","translations"]', JSON.stringify(p1));
  await new Promise((r) => setTimeout(r, 600));
  await getir('/api/trakt-catalog?endpoint=/shows/43&extended=full&extended=x');
  T.ok('Dizi degerli (ayni parametre iki kez) parametre atildi', !('extended' in sonCagri().cfg.params), JSON.stringify(sonCagri().cfg.params));

  // ======================================================================
  T.H('K4 — CF-Connecting-IP yalniz loopback ten (yerel cloudflared) gelirse gecerli');
  // ======================================================================
  const istek = (soket, cf) => ({ headers: cf ? { 'cf-connecting-ip': cf } : {}, socket: { remoteAddress: soket }, ip: soket });
  T.ok('Tunel (127.0.0.1) + baslik → ziyaretci IP si', clientIpKey(istek('127.0.0.1', '203.0.113.9')) === '203.0.113.9');
  T.ok('Tunel (::ffff:127.0.0.1, cift yigin) + baslik → ziyaretci IP si', clientIpKey(istek('::ffff:127.0.0.1', '203.0.113.9')) === '203.0.113.9');
  T.ok('🔴 LAN (192.168.1.50) + SAHTE baslik → soket IP si (sahtecilik etkisiz)', clientIpKey(istek('192.168.1.50', '203.0.113.9')) === '192.168.1.50');
  T.ok('Basliksiz LAN istegi → soket IP si', clientIpKey(istek('192.168.1.50', null)) === '192.168.1.50');

  // ======================================================================
  T.H('D-8 — kullaniciya ozel TMDB oturum parametreleri anahtara/diske sizmaz');
  // ======================================================================
  T.ok('session_id / guest_session_id / request_token atilir', normalizeQuery({ language: 'tr-TR', session_id: 'a', guest_session_id: 'b', request_token: 'c' }) === 'language=tr-TR');

  sunucu.closeAllConnections();
  sunucu.close();
  T.bitir();
})().catch((e) => { console.error(e); process.exit(1); });
