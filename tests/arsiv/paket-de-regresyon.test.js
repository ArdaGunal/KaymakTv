// ==========================================================================
// M558 — Dış denetim Paket D + E + seçili F: R7 (sızma), R8 (yedek), O-2 (parçalı harita), O-4 (imleç),
// O-10 (kuyruk taşması + sağlık ucu), D-1 (negatif → arşiv), D-9 (tmdbProxy tip kontrolü)
// ==========================================================================
// 07 §3: «Bu betik, düzeltmeler yazılırken depo testine dönüştürülecek.» R7/R8 düzeltme ÖNCESİ kalırdı:
//   R7 — açık işlem geri alınınca işlem DIŞI yazımlar (TMDB künyesi, log, defter) KAYBOLUYORDU.
//   R8 — ana bağlantıda işlem açıkken `VACUUM INTO` «cannot VACUUM from within a transaction».
// Ağ yok; gerçek modüller, geçici kök.

const path = require('path');
const fs = require('fs');
const http = require('http');
const { baslat, AR, LF, PROJE_KOKU } = require('../yardimci');

const T = baslat('PAKET D + E + F (M558)', { kokOneki: 'arsiv-paket-de-' });
const db = require(path.join(AR, 'db'));
const store = require(path.join(AR, 'store'));
const kimlik = require(path.join(AR, 'identity'));
const tmdbArsiv = require(path.join(AR, 'tmdbArsiv'));
const yazici = require(path.join(AR, 'writer'));
const { createArchiveQueue } = require(path.join(AR, 'queue'));
const { haritalariKur, haritalariKurAsync } = require(path.join(AR, 'aynaSatirlari'));
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  db.initArchive();
  const h = db.getDb();
  const meta = (k) => h.prepare('SELECT value FROM meta WHERE key = ?').get(k);

  // TMDB künyesinin bağlanacağı dizi (A1: birincil Trakt kimliğiyle)
  kimlik.resolveOrCreate({ type: 'show', externalIds: [{ source: 'trakt:show', source_id: '9555' }, { source: 'tmdb:show', source_id: '555' }], derived: { title: 'R7 Dizi' } });

  // ======================================================================
  T.H('R7 · O-1a — başkasının işlemi GERİ ALINSA da işlem dışı yazımlar KAYBOLMAZ');
  // ======================================================================
  let birak;
  const A = db.transactionAsync(async (b) => {
    b.prepare("INSERT INTO meta (key, value) VALUES ('r7_ic', '1')").run();
    await new Promise((r) => { birak = r; }); // «nefes»: işlem AÇIK
    throw new Error('A geri alinir');
  });
  await bekle(10);
  T.ok('İşlem açık (önkoşul)', db.islemAcikMi() === true);
  const log = store.logSync({ event: 'error', detail: 'R7 log satiri' });
  const disari = db.islemDisiYaz((b) => b.prepare("INSERT INTO meta (key, value) VALUES ('r7_disari', '1')").run());
  const kunye = tmdbArsiv.archiveTmdbDetail({ family: 'tv_detail', path: '/tv/555', data: { id: 555, name: 'R7' }, lang: 'tr' });
  T.ok('Açık işlem varken dış yazım HENÜZ yazılmadı (ertelendi)', !meta('r7_disari'));
  birak();
  await A.catch(() => {});
  await disari; const k = await kunye;
  T.ok('İşlemin kendi yazımı geri alındı', !meta('r7_ic'));
  T.ok('🔴 R7: işlem dışı meta yazımı KORUNDU', meta('r7_disari') && meta('r7_disari').value === '1');
  T.ok('🔴 R7: log satırı KORUNDU', log === true && !!h.prepare("SELECT 1 FROM sync_log WHERE detail = 'R7 log satiri'").get());
  T.ok('🔴 R7: TMDB künyesi KORUNDU (yazım zincirinde sırayla)', k.ok === true
    && !!h.prepare("SELECT 1 FROM payloads WHERE provider='tmdb' AND endpoint='tv_detail' AND kaymak_id=?").get(k.arsivId), JSON.stringify(k));
  T.ok('Açık işlem yokken log ANINDA yazılır (senkron sonuç)', store.logSync({ event: 'error', detail: 'aninda' }) === true
    && !!h.prepare("SELECT 1 FROM sync_log WHERE detail = 'aninda'").get());

  // ======================================================================
  T.H('R8 · O-1b/O-2 — işlem AÇIKKEN yedek; ayrı bağlantı + iş parçacığı + quick_check');
  // ======================================================================
  let birak2;
  const B = db.transactionAsync(async () => { await new Promise((r) => { birak2 = r; }); });
  await bekle(10);
  const s1 = db.backupTo(path.join(T.kok, 'r8-senkron.db'));
  T.ok('🔴 R8: senkron yedek işlem açıkken ALINDI', s1.ok === true, s1.reason);
  const tickler = []; const sayac = setInterval(() => tickler.push(Date.now()), 1);
  const s2 = await db.backupToAsync(path.join(T.kok, 'r8-isci.db'));
  clearInterval(sayac);
  T.ok('🔴 R8: iş parçacığında yedek ALINDI (quick_check ok)', s2.ok === true && s2.bytes > 0, s2.reason);
  T.ok('Yedek sırasında olay döngüsü dönmeye devam etti', tickler.length > 0, String(tickler.length));
  birak2(); await B;
  const { DatabaseSync } = require('node:sqlite');
  const kopya = new DatabaseSync(path.join(T.kok, 'r8-isci.db'), { readOnly: true });
  T.ok('Yedek işlenmiş veriyi içeriyor', !!kopya.prepare("SELECT 1 FROM meta WHERE key='r7_disari'").get());
  kopya.close();

  // ======================================================================
  T.H('O-2 — parçalı ayna haritası senkronla BİREBİR aynı');
  // ======================================================================
  await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'show_detail', path: '/shows/1388', query: { extended: 'full', translations: 'tr' },
    data: { title: 'Breaking Bad', year: 2008, runtime: 47, genres: ['drama'], first_aired: '2008-01-20T00:00:00.000Z', ids: { trakt: 1388, tmdb: 1396 } } });
  await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'show_seasons', path: '/shows/1388/seasons', query: { extended: 'full,episodes' },
    data: [{ number: 1, ids: { trakt: 3950 }, episodes: [{ season: 1, number: 1, title: 'Pilot', runtime: 58, first_aired: '2008-01-20T00:00:00.000Z', ids: { trakt: 73482, tmdb: 62085 } }] }] });
  const ser = (m) => JSON.stringify(Object.fromEntries(Object.entries(m).map(([a, v]) => [a, [...v.entries()].sort()])));
  const hs = haritalariKur(h);
  const ha = await haritalariKurAsync(h, null, { parca: 1 });
  T.ok('runtime/tmdb/genres/firstAired aynı', ser(hs) === ser(ha) && hs.runtime.size > 0, ser(ha).slice(0, 120));

  // ======================================================================
  T.H('O-4 — ayna imleci tur başından 5 dk geride sınırlanır');
  // ======================================================================
  process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL = 'http://sahte-worker';
  process.env.PI_SYNC_SECRET = 'x'.repeat(40);
  const asilFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, yazilan: 1, atlanan: 0 }), { status: 200 });
  const mirror = require(path.join(AR, 'mirror'));
  const turBasi = Date.now();
  const r = await mirror.runMirror();
  globalThis.fetch = asilFetch;
  T.ok('Tur başarılı', r.ok === true, JSON.stringify(r));
  T.ok('🔴 O-4: imleç ≤ tur başı − 5 dk (taze satırlar bir sonraki turda yeniden gider)', r.imlec <= turBasi - mirror.IMLEC_GUVENLIK_PAYI_MS + 5, `${r.imlec} vs ${turBasi - mirror.IMLEC_GUVENLIK_PAYI_MS}`);

  // ======================================================================
  T.H('O-10 — kuyruk taşması görünür + sağlık ucu');
  // ======================================================================
  const uyarilar = []; const asilUyari = console.warn; console.warn = (m) => uyarilar.push(String(m));
  try {
    const q = createArchiveQueue({ maxQueue: 2, worker: async () => { await bekle(50); return { ok: true }; } });
    for (let i = 0; i < 5; i++) q.enqueue({ provider: 'trakt', family: 'show_detail', path: `/shows/${i}`, query: {} });
    T.ok('Taşmada en eskiler düştü', q.getStats().dusurulen >= 2, JSON.stringify(q.getStats()));
    T.ok('🔴 Taşma bir kez UYARILDI (gürültü sınırlı) + sync_log', uyarilar.filter((u) => u.includes('TASTI')).length === 1
      && !!h.prepare("SELECT 1 FROM sync_log WHERE detail LIKE 'kuyruk_tasmasi%'").get(), String(uyarilar.length));
    await q.drain();
  } finally { console.warn = asilUyari; }
  store.logSync({ event: 'mirror', provider: 'supabase', detail: 'entities season basarisiz: http_502 {"message":"supabase_zaman_asimi gizli ayrinti"}' });
  const saglik = await require(path.join(PROJE_KOKU, 'server', 'saglik')).saglikRaporu();
  T.ok('Sağlık: anlık aktarım sayaçları', Number.isInteger(saglik.arsiv.anlikAktarim.bekleyen), JSON.stringify(saglik.arsiv.anlikAktarim));
  T.ok('Sağlık: son ayna düştü, neden kodu', saglik.arsiv.sonAyna.basarili === false && saglik.arsiv.sonAyna.neden === 'http_502', JSON.stringify(saglik.arsiv.sonAyna));
  T.ok('🔒 Sağlık: hata METNİ sızmıyor', !JSON.stringify(saglik).includes('gizli ayrinti'));

  // ======================================================================
  T.H('D-1 — negatif zarf varken sağlayıcı çökerse ÖNCE arşiv');
  // ======================================================================
  const orch = require(path.join(LF, 'orchestrator'));
  const { NotFoundError } = require(path.join(LF, 'errors'));
  let mod = 'yok';
  const fetcher = async () => {
    if (mod === 'yok') throw new NotFoundError('trakt');
    throw Object.assign(new Error('Request failed with status code 503'), { response: { status: 503 } });
  };
  const n1 = await orch.resolveRequest({ provider: 'trakt', path: '/shows/1388', query: { extended: 'full', translations: 'tr' }, fetcher });
  T.ok('Önce 404 → negatif zarf', n1.status === 'not-found', n1.status);
  mod = 'cokuk';
  const n2 = await orch.resolveRequest({ provider: 'trakt', path: '/shows/1388', query: { extended: 'full', translations: 'tr' }, fetcher, maxEnvelopeAgeMs: 1 });
  T.ok('🔴 D-1: sağlayıcı 503 + negatif zarf → ARŞİVDEN servis', n2.status === 'archive-fallback' && n2.data && n2.data.title === 'Breaking Bad', `${n2.status}`);
  const n3 = await orch.resolveRequest({ provider: 'trakt', path: '/shows/424242', query: { extended: 'full', translations: 'tr' }, fetcher: async () => { throw new NotFoundError('trakt'); } });
  const n4 = await orch.resolveRequest({ provider: 'trakt', path: '/shows/424242', query: { extended: 'full', translations: 'tr' }, fetcher, maxEnvelopeAgeMs: 1 });
  T.ok('Arşivde de yoksa negatif sonuç eskisi gibi (not-found)', n3.status === 'not-found' && n4.status === 'not-found', `${n3.status}/${n4.status}`);

  // ======================================================================
  T.H('D-9 — tmdbProxy: dizi endpoint 400 (500 + iç mesaj sızıntısı değil)');
  // ======================================================================
  process.env.TMDB_API_KEY = 'test-anahtar';
  const express = require('express');
  const app = express();
  app.use('/api/tmdb-proxy', require(path.join(PROJE_KOKU, 'server', 'tmdbProxy')));
  const sunucu = app.listen(0);
  const port = sunucu.address().port;
  const yanit = await new Promise((coz, red) => {
    http.get({ host: '127.0.0.1', port, path: '/api/tmdb-proxy?endpoint=a&endpoint=b', agent: false }, (y) => {
      let g = ''; y.on('data', (c) => { g += c; }); y.on('end', () => coz({ status: y.statusCode, govde: g }));
    }).on('error', red);
  });
  T.ok('🔴 D-9: 400, iç hata mesajı yok', yanit.status === 400 && !/TypeError|startsWith/.test(yanit.govde), `${yanit.status} ${yanit.govde.slice(0, 80)}`);
  sunucu.closeAllConnections();
  await new Promise((r2) => sunucu.close(r2));

  // ======================================================================
  T.H('Düzgün kapanış yardımcısı');
  // ======================================================================
  T.ok('yazimlarBitsin sıradaki işlemleri bekler', await Promise.race([db.yazimlarBitsin().then(() => true), bekle(1000).then(() => false)]));
  fs.rmSync(path.join(T.kok, 'r8-senkron.db'), { force: true });

  db.closeArchive();
  T.bitir();
})();
