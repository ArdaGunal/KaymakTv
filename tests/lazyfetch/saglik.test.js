// ==========================================================================
// K8 (M531) — GET /api/health: salt okuma, sırsız, durumu DEĞİŞTİRMEZ
// ==========================================================================
// Ağ yok: sahte kökte gerçek modüller; HTTP kısmı yerel portta gerçek Express.

const path = require('path');
const { baslat, LF, AR } = require('../yardimci');

const T = baslat('SAGLIK UCU (K8)', { kokOneki: 'lf-saglik-' });

const express = require('express');
const cb = require(path.join(LF, 'circuitBreaker'));
const tb = require(path.join(LF, 'tokenBucket'));
const { initArchive } = require(path.join(AR, 'db'));
const saglik = require(path.join(__dirname, '..', '..', 'server', 'saglik'));

(async () => {
  initArchive();

  T.H('Rapor icerigi');
  const r = await saglik.saglikRaporu();
  T.ok('LazyFetch ve arsiv acik -> ok:true', r.ok === true && r.lazyfetch.etkin && r.arsiv.etkin, JSON.stringify({ ok: r.ok }));
  T.ok('Iki saglayici raporlaniyor (devre + kova)', ['tmdb', 'trakt'].every((p) => r.lazyfetch.saglayicilar[p].devre && r.lazyfetch.saglayicilar[p].kova));
  T.ok('Yeni K3 kovasi gorunuyor (tmdb kapasite 40)', r.lazyfetch.saglayicilar.tmdb.kova.kapasite === 40);
  const metin = JSON.stringify(r);
  T.ok('🔴 Dosya yolu SIZMIYOR (kok, dbPath, root yok)', !metin.includes(T.kok) && !/dbPath|"root"|katalog\.db/.test(metin));
  T.ok('🔴 Sir/ortam degeri SIZMIYOR', !/secret|api_key|TMDB_API_KEY|SYNC_SECRET|Bearer/i.test(metin));

  T.H('Durumu DEGISTIRMEDEN okur');
  for (let i = 0; i < 5; i++) cb.recordFailure('trakt');
  const devreOnce = cb.devreDurumu('trakt');
  T.ok('Trakt devresi 5 hatada OPEN gorunur', devreOnce.durum === 'OPEN', JSON.stringify(devreOnce));
  // `canRequest()` sure dolunca OPEN -> HALF_OPEN yapar ve tek deneme hakkini harcar; rapor bunu YAPMAMALI.
  await saglik.saglikRaporu();
  await saglik.saglikRaporu();
  T.ok('🔴 Rapor devreyi HALF_OPEN a cevirmedi / deneme hakkini yemedi', cb.devreDurumu('trakt').durum === 'OPEN');

  for (let i = 0; i < 5; i++) tb.tryConsume('tmdb');
  const j1 = (await saglik.saglikRaporu()).lazyfetch.saglayicilar.tmdb.kova.jeton;
  const j2 = (await saglik.saglikRaporu()).lazyfetch.saglayicilar.tmdb.kova.jeton;
  T.ok('5 jeton harcandi -> rapor 35 civari gosterir', j1 >= 35 && j1 < 40, String(j1));
  T.ok('🔴 Rapor jeton HARCAMAZ (art arda iki okuma dusmuyor)', j2 >= j1, `${j1} -> ${j2}`);

  T.H('HTTP');
  const app = express();
  app.use('/api/health', require(path.join(__dirname, '..', '..', 'server', 'saglik')));
  const sunucu = app.listen(0);
  const port = sunucu.address().port;
  // `fetch` (undici) DEGIL: Windows'ta process.exit sirasinda libuv iddiasi dusuruyor.
  const http = require('http');
  const getir = () => new Promise((coz, red) => {
    http.get({ host: '127.0.0.1', port, path: '/api/health', agent: false }, (y) => {
      let b = ''; y.on('data', (c) => { b += c; });
      y.on('end', () => coz({ status: y.statusCode, headers: y.headers, govde: b ? JSON.parse(b) : null }));
    }).on('error', red);
  });
  const yanit = await getir();
  T.ok('200 + no-store + ok:true', yanit.status === 200 && yanit.headers['cache-control'] === 'no-store' && yanit.govde.ok === true, String(yanit.status));
  let son = null;
  for (let i = 0; i < 31; i++) son = await getir();
  T.ok('Kendi sinirlayicisi var (dakikada 30 -> 429)', son.status === 429, String(son.status));
  // Açık keep-alive soketleri kapanmadan süreç biterse Windows'ta libuv iddiası düşüyor.
  sunucu.closeAllConnections();
  await new Promise((r) => sunucu.close(r));

  T.H('Baglanti');
  const fs = require('fs');
  const srv = fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf8');
  T.ok("server.js /api/health'i 404 yakalayicisindan ONCE bagliyor",
    srv.indexOf("app.use('/api/health'") > 0 && srv.indexOf("app.use('/api/health'") < srv.indexOf('app.use((req, res) =>'));

  T.bitir();
})();
