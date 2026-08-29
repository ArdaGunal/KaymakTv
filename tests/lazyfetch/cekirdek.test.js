// ==========================================================================
// LAZYFETCH — L1-L5 ÇEKİRDEK TESTLERİ
// ==========================================================================
// Kapsam: disk çekirdeği (L1) · rota defteri + tek-uçuş (L2) · disiplin
// katmanı (L4) · SWR + yenileme kuyruğu (L5).
//
// 🔴 HİÇBİR AĞ İSTEĞİ YAPILMAZ. Sağlayıcı adaptörü orchestrator'a
// PARAMETRE olarak veriliyor (`fetcher`), bu yüzden sahte bir fonksiyonla
// tüm karar ağacı gerçek kodla çalıştırılabiliyor. Bu, `01_MIMARI.md`'nin
// "Sağlayıcı Adaptörü" soyutlamasının test edilebilirlik kazancı.
//
// Doğrulanan iddiaların kaynağı: `docs/Lazy Down Plan/03_FAZLAR.md`'nin
// her faz altındaki "Doğrulama" listesi.

const fs = require('fs');
const path = require('path');
const { baslat, LF } = require('./yardimci');

const T = baslat('CEKIRDEK (L1-L5)', { kokOneki: 'lf-cekirdek-' });

const key = require(path.join(LF, 'key'));
const env = require(path.join(LF, 'envelope'));
const disk = require(path.join(LF, 'diskStore'));
const paths = require(path.join(LF, 'paths'));
const rr = require(path.join(LF, 'routeRegistry'));
const orch = require(path.join(LF, 'orchestrator'));
const cb = require(path.join(LF, 'circuitBreaker'));
const tb = require(path.join(LF, 'tokenBucket'));
const { createRefreshQueue } = require(path.join(LF, 'refreshQueue'));
const { NotFoundError } = require(path.join(LF, 'errors'));

(async () => {
  // ======================================================================
  T.H('L1 - Disk cekirdegi');
  // ======================================================================
  T.ok('LAZYFETCH_ROOT etkin', paths.isLazyFetchEnabled());

  const kTrav = key.buildCacheKey({ provider: 'tmdb', family: 'tv_detail', path: '/../../etc/passwd' });
  T.ok(
    'Path traversal hash e donusuyor (yol kokun disina CIKMIYOR)',
    /^tmdb\/tv_detail\/[0-9a-f]{2}\/[0-9a-f]{64}\.json\.gz$/.test(kTrav.relativePath)
  );

  const kTr = key.buildCacheKey({ provider: 'tmdb', family: 'tv_detail', path: '/tv/1396', query: { language: 'tr-TR' } });
  const kEn = key.buildCacheKey({ provider: 'tmdb', family: 'tv_detail', path: '/tv/1396', query: { language: 'en-US' } });
  T.ok('Dil ayrimi: tr-TR ve en-US AYRI dosyalar', kTr.hash !== kEn.hash);

  const kA = key.buildCacheKey({ provider: 'tmdb', family: 'tv_detail', path: '/tv/1396', query: { a: 1, b: 2 } });
  const kB = key.buildCacheKey({ provider: 'tmdb', family: 'tv_detail', path: '/tv/1396', query: { b: 2, a: 1 } });
  T.ok('Sira bagimsizligi: ?a=1&b=2 == ?b=2&a=1', kA.hash === kB.hash);

  const kBare = key.buildCacheKey({ provider: 'tmdb', family: 'tv_detail', path: '/tv/1396' });
  const kSec = key.buildCacheKey({
    provider: 'tmdb', family: 'tv_detail', path: '/tv/1396',
    query: { api_key: 'GIZLI', ACCESS_TOKEN: 'X', Authorization: 'Bearer y' },
  });
  T.ok('Sir parametreleri anahtara/dosya adina SIZMIYOR', kSec.hash === kBare.hash);

  let reddetti = false;
  try { disk.resolveSafePath(path.join(T.kok, 'cache'), '../../../../etc/passwd'); } catch (e) { reddetti = true; }
  T.ok('Ikinci kademe yol korumasi (savunma derinligi) reddediyor', reddetti);

  const zarf = env.createEnvelope({
    provider: 'tmdb', family: 'tv_detail', payload: { n: 'Breaking Bad' }, ttlMs: 60000, graceMs: 60000,
  });
  const yazim = await disk.writeCacheEntry(kBare.relativePath, zarf);
  T.ok('Atomik yazma basarili (gzip)', yazim.ok, yazim.bytes + ' bayt');

  const okuma = await disk.readCacheEntry(kBare.relativePath);
  T.ok('Geri okuma birebir', okuma.ok && okuma.envelope.payload.n === 'Breaking Bad');
  T.ok('tmp/ temiz - rename tamamlandi, yarim dosya YOK', fs.readdirSync(path.join(T.kok, 'tmp')).length === 0);

  // Bozuk dosya -> karantina (SILINMEZ, teshis kaniti)
  const mutlak = path.join(T.kok, 'cache', kBare.relativePath);
  fs.writeFileSync(mutlak, Buffer.from('BU GECERLI BIR GZIP DEGIL'));
  const bozukOkuma = await disk.readCacheEntry(kBare.relativePath);
  T.ok('Bozuk kayit: okuma COKMUYOR, corrupt donuyor', bozukOkuma.ok === false && bozukOkuma.reason === 'corrupt');
  T.ok('Bozuk kayit karantinaya TASINDI (silinmedi)', fs.readdirSync(path.join(T.kok, 'quarantine')).length === 1);
  T.ok('Bozuk dosya cache/ ten kalkti', !fs.existsSync(mutlak));

  const simdi = Date.now();
  T.ok('Zaman bolgesi: fresh', env.getEnvelopeState({ v: 1, expiresAt: simdi + 1000, hardExpiresAt: simdi + 2000 }) === 'fresh');
  T.ok('Zaman bolgesi: stale', env.getEnvelopeState({ v: 1, expiresAt: simdi - 1, hardExpiresAt: simdi + 1000 }) === 'stale');
  T.ok('Zaman bolgesi: expired', env.getEnvelopeState({ v: 1, expiresAt: simdi - 2, hardExpiresAt: simdi - 1 }) === 'expired');
  T.ok(
    'Sema surumu uyusmazsa TUM eski kayitlar expired',
    env.getEnvelopeState({ v: 99, expiresAt: simdi + 9e9, hardExpiresAt: simdi + 9e9 }) === 'expired'
  );

  const damgali = env.markRevalidationFailed(zarf);
  T.ok(
    'Basarisiz yenileme fetchedAt/expiresAt i BOZMUYOR (bozuk veri taze sanilmaz)',
    damgali.fetchedAt === zarf.fetchedAt && damgali.expiresAt === zarf.expiresAt && typeof damgali.lastErrorAt === 'number'
  );

  let graceZorunlu = false;
  try { env.createEnvelope({ provider: 't', family: 'f', payload: 1, ttlMs: 1000 }); } catch (e) { graceZorunlu = true; }
  T.ok('graceMs ZORUNLU - varsayilan uydurulmuyor', graceZorunlu);

  // ======================================================================
  T.H('L2 - Rota defteri + tek-ucus kilidi');
  // ======================================================================
  T.ok('Beyaz liste disi path PASSTHRU', rr.resolveRoute('tmdb', '/configuration').cacheable === false);
  T.ok('Bilinmeyen provider PASSTHRU', rr.resolveRoute('imdb', '/tv/1').cacheable === false);
  T.ok('/tv/1396 -> tv_detail ailesi', rr.resolveRoute('tmdb', '/tv/1396').family === 'tv_detail');

  // SURU (thundering herd) TESTI - 03_FAZLAR.md L2 dogrulamasi
  let cagriSayisi = 0;
  const yavasFetcher = async () => {
    cagriSayisi++;
    await new Promise((r) => setTimeout(r, 80));
    return { data: { v: 'X' }, maxAgeSeconds: 600 };
  };
  const sonuclar = await Promise.all(
    Array.from({ length: 50 }, () => orch.resolveRequest({ provider: 'tmdb', path: '/tv/999001', fetcher: yavasFetcher }))
  );
  T.ok('SURU TESTI: 50 eszamanli istek -> TAM 1 saglayici cagrisi', cagriSayisi === 1, cagriSayisi + ' cagri');
  T.ok('50 istegin HEPSI veri aldi', sonuclar.every((r) => r.data.v === 'X'));

  const oncekiAileler = fs.readdirSync(path.join(T.kok, 'cache', 'tmdb')).length;
  let passthruCagri = 0;
  const pt = await orch.resolveRequest({
    provider: 'tmdb', path: '/configuration',
    fetcher: async () => { passthruCagri++; return { data: { p: 1 } }; },
  });
  T.ok(
    'PASSTHRU cache e HIC dokunmuyor (yeni aile klasoru acilmadi)',
    passthruCagri === 1 && pt.status === 'passthru' && fs.readdirSync(path.join(T.kok, 'cache', 'tmdb')).length === oncekiAileler
  );

  let hataDenemesi = 0;
  const patlayanFetcher = async () => { hataDenemesi++; throw new Error('saglayici patladi'); };
  for (let i = 0; i < 2; i++) {
    try { await orch.resolveRequest({ provider: 'tmdb', path: '/tv/999002', fetcher: patlayanFetcher }); } catch (e) { /* beklenen */ }
  }
  T.ok('Kilit hata sonrasi finally de DUSUYOR (yeniden denenebiliyor)', hataDenemesi === 2, hataDenemesi + ' deneme');

  // ======================================================================
  T.H('L4 - Disiplin katmani');
  // ======================================================================
  let bulunamadiCagri = 0;
  const yokFetcher = async () => { bulunamadiCagri++; throw new NotFoundError('yok'); };
  const n1 = await orch.resolveRequest({ provider: 'tmdb', path: '/tv/999003', fetcher: yokFetcher });
  const n2 = await orch.resolveRequest({ provider: 'tmdb', path: '/tv/999003', fetcher: yokFetcher });
  T.ok(
    'NEGATIF CACHE: 404 saklandi, ikinci istek saglayiciya GITMEDI',
    bulunamadiCagri === 1 && n1.status === 'not-found' && n2.status === 'not-found',
    bulunamadiCagri + ' cagri'
  );
  T.ok('Negatif TTL 10 dk / grace 10 dk', rr.NEGATIVE_TTL_MS === 600000 && rr.NEGATIVE_GRACE_MS === 600000);

  const devre = new cb.CircuitBreaker({ failureThreshold: 5, openDurationMs: 30000 });
  for (let i = 0; i < 4; i++) devre.recordFailure();
  T.ok('Devre 4 hatada hala KAPALI', devre.canRequest() === true);
  devre.recordFailure();
  T.ok('Devre 5. hatada ACILDI', devre.canRequest() === false && devre.state === 'OPEN');
  devre.openedAt = Date.now() - 30001;
  T.ok('30 sn sonra HALF_OPEN ve yalnizca TEK deneme hakki', devre.canRequest() === true && devre.canRequest() === false);
  devre.recordSuccess();
  T.ok('Basari -> CLOSED', devre.state === 'CLOSED' && devre.canRequest());

  // Madde 258: ilk canli istek 500 dondu cunku "trakt" config'i YOKTU.
  T.ok('circuitBreaker: trakt config VAR (Madde 258 kusuru)', !!cb.DEFAULT_CONFIG.trakt, JSON.stringify(cb.DEFAULT_CONFIG.trakt));
  T.ok('tokenBucket: trakt limiti VAR', !!tb.DEFAULT_LIMITS.trakt, JSON.stringify(tb.DEFAULT_LIMITS.trakt));
  T.ok('Trakt kotasi TMDB den DAR (saglayici beyani dar)', tb.DEFAULT_LIMITS.trakt.refillRatePerSecond < tb.DEFAULT_LIMITS.tmdb.refillRatePerSecond);

  const kova = new tb.TokenBucket({ capacity: 3, refillRatePerSecond: 1, now: 1000 });
  T.ok('Bucket kapasitesi kadar geciriyor', [1, 2, 3].every(() => kova.tryConsume(1000)));
  T.ok('Kapasite bitince REDDEDIYOR (kuyruga almiyor)', kova.tryConsume(1000) === false);
  T.ok('1 sn sonra tam 1 token dolmus', kova.tryConsume(2000) === true && kova.tryConsume(2000) === false);

  // ======================================================================
  T.H('L5 - SWR + yenileme kuyrugu');
  // ======================================================================
  T.ok('GRACE_CEILING_MS = 24 sa', rr.GRACE_CEILING_MS === 24 * 60 * 60 * 1000);
  T.ok('Anormal uzun max-age de grace 24 sa e kirpiliyor', rr.resolveTtl(7 * 24 * 3600).graceMs === 24 * 3600 * 1000);
  T.ok(
    'GERCEK TMDB degerinde (3760 sn) tavan DEVREYE GIRMIYOR',
    rr.resolveTtl(3760).graceMs === 3760 * 1000 * 4,
    (rr.resolveTtl(3760).graceMs / 3600000).toFixed(1) + ' sa'
  );
  T.ok('TTL tabani 1 dk (anormal kisa kirpilir)', rr.resolveTtl(1).ttlMs === 60000);
  T.ok('TTL tavani 7 gun', rr.resolveTtl(99999999).ttlMs === 7 * 24 * 3600 * 1000);
  T.ok('Header hic yoksa varsayilan 1 sa', rr.resolveTtl(null).ttlMs === 3600000);

  const kuyruk = createRefreshQueue();
  let anlik = 0;
  let zirve = 0;
  await Promise.all(
    Array.from({ length: 12 }, (_, i) => new Promise((bitti) => {
      kuyruk.enqueue('k' + i, async () => {
        anlik++;
        zirve = Math.max(zirve, anlik);
        await new Promise((r) => setTimeout(r, 30));
        anlik--;
        bitti();
      });
    }))
  );
  T.ok('Arka plan yenilemeleri en fazla 2 PARALEL', zirve <= 2, 'zirve=' + zirve);
  T.ok('Basarisiz yenileme sogumasi 30 sn', orch.REVALIDATE_FAILURE_COOLDOWN_MS === 30000);

  // Bayat kayit: BEKLEMEDEN don + arkada TEK yenileme
  const kSwr = key.buildCacheKey({ provider: 'tmdb', family: 'tv_detail', path: '/tv/999004' });
  const bayat = env.createEnvelope({ provider: 'tmdb', family: 'tv_detail', payload: { v: 'ESKI' }, ttlMs: 60000, graceMs: 600000 });
  bayat.expiresAt = Date.now() - 1000;
  bayat.hardExpiresAt = Date.now() + 600000;
  await disk.writeCacheEntry(kSwr.relativePath, bayat);

  let arkaPlan = 0;
  const t0 = Date.now();
  const swr = await orch.resolveRequest({
    provider: 'tmdb', path: '/tv/999004',
    fetcher: async () => {
      arkaPlan++;
      await new Promise((r) => setTimeout(r, 60));
      return { data: { v: 'YENI' }, maxAgeSeconds: 600 };
    },
  });
  const sure = Date.now() - t0;
  T.ok('Bayat veri BEKLEMEDEN dondu', swr.status === 'stale' && swr.data.v === 'ESKI' && sure < 50, sure + ' ms');
  await new Promise((r) => setTimeout(r, 250));
  T.ok('Arka planda TEK yenileme yapildi', arkaPlan === 1, arkaPlan + ' cagri');
  const sonrasi = await orch.resolveRequest({
    provider: 'tmdb', path: '/tv/999004',
    fetcher: async () => { throw new Error('cagrilmamaliydi'); },
  });
  T.ok('Yenileme sonrasi kayit TAZE ve GUNCEL', sonrasi.status === 'fresh' && sonrasi.data.v === 'YENI');

  // GRACE FALLBACK: saglayici coktu ama elimizde eski veri var
  const kGrace = key.buildCacheKey({ provider: 'tmdb', family: 'tv_detail', path: '/tv/999005' });
  const olu = env.createEnvelope({ provider: 'tmdb', family: 'tv_detail', payload: { v: 'COK_ESKI' }, ttlMs: 60000, graceMs: 1000 });
  olu.expiresAt = Date.now() - 100000;
  olu.hardExpiresAt = Date.now() - 50000;
  await disk.writeCacheEntry(kGrace.relativePath, olu);
  const grace = await orch.resolveRequest({
    provider: 'tmdb', path: '/tv/999005',
    fetcher: async () => { throw new Error('TMDB coktu'); },
  });
  T.ok('GRACE FALLBACK: saglayici cokunce ESKI veri donuyor (bos ekran yok)', grace.status === 'grace-fallback' && grace.data.v === 'COK_ESKI');

  let hataYukari = false;
  try {
    await orch.resolveRequest({ provider: 'tmdb', path: '/tv/999006', fetcher: async () => { throw new Error('coktu'); } });
  } catch (e) { hataYukari = true; }
  T.ok('Elde HIC veri yoksa hata oldugu gibi yukari iletiliyor', hataYukari);

  T.bitir();
})();
