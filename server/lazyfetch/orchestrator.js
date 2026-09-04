// ==========================================================================
// LAZYFETCH — Orkestratör (L2, dosya 2/2)
// ==========================================================================
// TEK İŞİ: bir isteği alıp karar ağacını (docs/Lazy Down Plan/03_FAZLAR.md
// "3.7 Adım A→D Akışı") yürütmek:
//
//   rota defteri → PASSTHRU ise sağlayıcıya DOĞRUDAN git, cache'e hiç dokunma
//   cacheable ise:
//     bellek taze/bayat mı? → disk taze/bayat mı? → tek-uçuş kilidi → sağlayıcı
//
// 🔴 TEK-UÇUŞ KİLİDİ (Thundering Herd koruması, 01_MIMARI.md "3.6"):
// `inFlight` — Map<anahtar, Promise>. Aynı anahtara aynı anda gelen N istek
// TEK bir sağlayıcı çağrısını paylaşır. Kilit `finally` içinde silinir —
// hem başarı hem hata durumunda bir sonraki istek yeniden deneyebilir
// (03_FAZLAR.md L2 doğrulaması: "kilidi kazanan hata verirse kilit düşer").
//
// 🔴 SAĞLAYICI SOYUTLAMASI (01_MIMARI.md "Sağlayıcı Adaptörü — bağımsızlık
// anahtarı burada çevrilecek"): bu dosya TMDB/Trakt/eas hiçbir şey BİLMEZ.
// Çağıran taraf bir `fetcher(path, query) => Promise<{ data, maxAgeSeconds }>`
// fonksiyonu enjekte eder. `maxAgeSeconds`, sağlayıcının `Cache-Control`
// header'ından okunur (L3'te TMDB adaptörü bunu dolduracak) — yoksa
// `routeRegistry.resolveTtl()` varsayılana düşer.
//
// 🔴 GRACE FALLBACK (01_MIMARI.md kural 5 "sert-bayat"): sağlayıcı çağrısı
// BAŞARISIZ olursa ve elimizde eski (artık `hard_expires_at`'i de geçmiş)
// bir zarf varsa, hata fırlatmak yerine O ESKİ VERİ dönülür — dış API
// çökse bile kullanıcı boş ekran görmez. Elimizde hiç veri yoksa hata
// olduğu gibi yukarı iletilir.
//
// 🆕 L5 — SWR SAĞLAMLAŞTIRMA: "stale" durumda hemen dönülür + arka planda
// TEK yenileme tetiklenir (aynı `inFlight` kilidini paylaşır). L5'te buna
// iki koruma eklendi:
//   1. `refreshQueue` — arka plan yenilemeleri en fazla 2 paralel çalışır.
//      `singleFlight` yalnızca AYNI anahtarı tekilleştirir; farklı 200
//      anahtar aynı anda bayatladığında foreground'un token kotasını
//      çalıyorlardı (gerekçenin tamamı: refreshQueue.js başlığı).
//   2. Başarısız yenileme SOĞUMASI — yenileme hata verirse zarfa bellekte
//      `lastErrorAt` damgası vurulur ve `REVALIDATE_FAILURE_COOLDOWN_MS`
//      boyunca o anahtar için YENİ arka plan yenilemesi tetiklenmez.
//      Bu olmadan, sağlayıcı çökmüşken gelen HER istek yeni bir (kesin
//      başarısız olacak) yenileme başlatıyordu — ölü bir sağlayıcıyı
//      istek başına bir kez dövmek.
//
// 🆕 L4 — DİSİPLİN KATMANI: sağlayıcıya gitmeden HEMEN ÖNCE iki kapı var:
//   1. `circuitBreaker.canRequest()` — devre AÇIKSA sağlayıcı hiç aranmaz.
//   2. `tokenBucket.tryConsume()` — kendi kota tavanımız dolduysa da aranmaz.
// İkisi de `CircuitOpenError`/`RateLimitedError` fırlatır — bunlar normal
// bir sağlayıcı hatası GİBİ ele alınır (grace fallback devreye girer).
//
// 🆕 L4 — NEGATİF CACHE: sağlayıcı `NotFoundError` fırlatırsa (adaptörün
// 404'ü çevirdiği hal) bu devre kesiciye BAŞARI sayılır (sağlayıcı sağlıklı
// cevap verdi, yalnızca kaynak yok) ve kısa TTL'li (`NEGATIVE_TTL_MS`)
// özel bir zarf (`isNegative: true`, `payload: null`) diske yazılır.
// Sonraki aynı istek sağlayıcıya HİÇ gitmeden `not-found` döner.

const { resolveRoute, resolveTtl, NEGATIVE_TTL_MS, NEGATIVE_GRACE_MS } = require('./routeRegistry');
const { buildCacheKey, normalizeQuery } = require('./key');
const { createEnvelope, getEnvelopeState, markRevalidationFailed, SCHEMA_VERSION } = require('./envelope');
const { readCacheEntry, writeCacheEntry } = require('./diskStore');
const { createMemoryCache } = require('./memoryCache');
const { createRefreshQueue } = require('./refreshQueue');
const circuitBreaker = require('./circuitBreaker');
const tokenBucket = require('./tokenBucket');
const { NotFoundError, CircuitOpenError, RateLimitedError } = require('./errors');
// 🆕 A2 — arşiv "ikinci lavabo"su. Tek yönlü bağımlılık: LazyFetch arşivi
// tanır, arşiv LazyFetch'i tanımaz. Arşiv kapalıysa `enqueue` no-op'tur,
// yani bu require bir çalışma zamanı riski taşımaz.
const { archiveQueue } = require('../archive/queue');
// 🆕 A4 — arşivin OKUMA tarafı. Bağımlılık yönü A2'dekiyle aynı ve hâlâ
// TEK YÖNLÜ: LazyFetch arşivi tanır, arşiv LazyFetch'i tanımaz. Arşiv
// kapalıysa `readCatalogFromArchive` `{ok:false}` döner (throw etmez),
// yani bu require bir çalışma zamanı riski taşımaz.
const { readCatalogFromArchive } = require('../archive/reader');
// 🆕 A4 — geri düşüş SAYACI. Ayrı bir modül çünkü `reader.js`'in sözleşmesi
// "hiçbir şey yazmaz"; sayaç yazımı oraya konsaydı o sözleşme bulanırdı.
const { bumpFallback } = require('../archive/stats');

// Modül seviyesinde TEK paylaşılan bellek katmanı — Node'un require cache'i
// bunu doğal bir singleton yapar (memoryCache.js başlığındaki tasarım notu).
const memoryCache = createMemoryCache();

// 🆕 L5 — aynı singleton deseni: tüm arka plan yenilemeleri TEK kuyruktan
// geçer, yoksa eşzamanlılık tavanı anlamsız olurdu.
const refreshQueue = createRefreshQueue();

// 🆕 L5 — bir yenileme başarısız olduktan sonra aynı anahtar için yeni bir
// yenileme denemeden önce beklenecek süre. 30 sn seçildi çünkü devre
// kesicinin açık kalma süresiyle (circuitBreaker.js, 30 sn) AYNI ölçekte
// olması gerekiyor: daha kısa olsaydı, devre kapanmadan boşuna deneme
// üretirdik; çok daha uzun olsaydı, sağlayıcı toparladıktan sonra bile
// bayat veri servis etmeye gereksiz yere devam ederdik. Ölçülmüş bir sayı
// DEĞİL, gerekçelendirilmiş bir başlangıç değeri (04_KARARLAR.md B).
const REVALIDATE_FAILURE_COOLDOWN_MS = 30 * 1000;

// Tek-uçuş kilidi durumu — yalnızca "şu an uçuşta olan istekler", TTL/LRU
// DEĞİL. Bir anahtar burada en fazla birkaç saniye yaşar (sağlayıcı yanıt
// verene kadar).
const inFlight = new Map();

/** Bir zarfı `resolveRequest`'in dış sözleşmesine çevirir — `isNegative` ise `data` her zaman `null` ve status `not-found`'a sabitlenir. */
function envelopeToResult(envelope, status) {
  if (envelope.isNegative) return { status: 'not-found', data: null };
  return { status, data: envelope.payload };
}

function singleFlight(key, work) {
  if (inFlight.has(key)) return inFlight.get(key);
  const promise = (async () => {
    try {
      return await work();
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, promise);
  return promise;
}

/**
 * Sağlayıcıyı çağırır, başarılıysa yeni zarfı diske+belleğe yazar.
 *
 * Sırasıyla: devre kesici kapısı → token bucket kapısı → gerçek çağrı.
 * `NotFoundError` AYRI ele alınır (negatif zarf); diğer TÜM hatalar
 * (5xx/timeout/429/CircuitOpenError/RateLimitedError) devre kesiciye
 * BAŞARISIZLIK olarak işlenip olduğu gibi yukarı fırlatılır.
 */
async function fetchAndStore({ provider, family, relativePath, path, query, fetcher }) {
  if (!circuitBreaker.canRequest(provider)) {
    throw new CircuitOpenError(provider);
  }
  if (!tokenBucket.tryConsume(provider)) {
    throw new RateLimitedError(provider);
  }

  try {
    const result = await fetcher(path, query);
    circuitBreaker.recordSuccess(provider);
    // 🆕 L8: TTL artık aileyi ve yanıtın KENDİSİNİ de görüyor — yayını
    // süren bir dizinin sezon listesi 30 gün değil 7 gün taze kalsın diye
    // (routeRegistry.js "KATALOG ÖMRÜ POLİTİKASI").
    const { ttlMs, graceMs } = resolveTtl(result.maxAgeSeconds, { family, data: result.data });
    const envelope = createEnvelope({
      provider, family, payload: result.data, ttlMs, graceMs,
      // 🆕 A3: zarf kendini tanımlasın — `cache/`'ten arşive aktarım bunu
      // okuyacak (envelope.js'teki gerekçe). `normalizeQuery` sırları ayıklar.
      requestPath: path, requestQuery: normalizeQuery(query),
    });

    // 🆕 (L7+) SAĞLAYICI "SAKLAMA" DEDİYSE SAKLAMIYORUZ.
    // `storable === false` yalnızca `Cache-Control: no-store` / `no-cache` /
    // `private` görüldüğünde gelir (providers/cacheControl.js). Veri
    // kullanıcıya DÖNER — yalnızca diske ve belleğe yazılmaz, yani bir
    // sonraki istek yine sağlayıcıya gider.
    //
    // 🔴 Eski (varsa) zarf SİLİNMEZ: sağlayıcı YENİ yanıtı saklamamamızı
    // istedi, eskisini geçersiz kılmadı — eski kayıt kendi TTL'ini
    // yaşamaya devam eder. Ayrıca `storable` alanı OLMAYAN bir adaptör
    // (yarın yazılacak üçüncü bir sağlayıcı) eski davranışı görür:
    // `undefined === false` yanlıştır, yani varsayılan SAKLA'dır.
    if (result.storable === false) {
      envelope.__notStored = true;
      return envelope;
    }

    await writeCacheEntry(relativePath, envelope);
    memoryCache.set(relativePath, envelope);

    // 🆕 A2 — İKİNCİ LAVABO. Önbelleğe yazılan her TAZE yanıt arşive de
    // uğrar (01_MIMARI.md: iki sistem aynı boruyu paylaşır, kuralları zıt).
    //
    // 🔴 SONUÇ BEKLENMİYOR ve HATA YAKALANMIYOR — `enqueue` senkron, hiçbir
    // şey döndürmez, throw etmez. Kullanıcının isteği arşivin rehinesi
    // olamaz (03_FAZLAR.md A2). Arşiv kapalıysa çağrı sessizce hiçbir şey
    // yapmaz.
    //
    // 🔴 BURASI YALNIZCA "SAĞLAYICIDAN TAZE GELEN" YOLDUR. Cache hit'leri
    // (fresh/stale) buraya UĞRAMAZ — zaten arşivde olan bir veriyi tekrar
    // yazmanın anlamı yok. `no-store` yanıtları da gelmez: onlar bu satıra
    // ulaşmadan yukarıda dönüyor (sağlayıcı saklamamamızı istedi, arşiv de
    // saklamaz).
    //
    // ⚠️ Bu, orchestrator'ın arşivi TANIDIĞI tek yer. Sağlayıcı
    // soyutlamasını bozmuyor: hangi ailenin arşivlenebilir olduğuna
    // `writer.js` karar veriyor, orchestrator yalnızca haber veriyor.
    archiveQueue.enqueue({
      provider, family, path, query,
      data: result.data,
      fetchedAt: envelope.fetchedAt,
    });

    return envelope;
  } catch (error) {
    if (error instanceof NotFoundError) {
      // Sağlayıcı SAĞLIKLI cevap verdi (yalnızca "bu kaynak yok" dedi) —
      // devre kesici için bu bir arıza DEĞİL.
      circuitBreaker.recordSuccess(provider);
      const negativeEnvelope = createEnvelope({
        provider,
        family,
        payload: null,
        ttlMs: NEGATIVE_TTL_MS,
        graceMs: NEGATIVE_GRACE_MS,
        isNegative: true,
        requestPath: path, requestQuery: normalizeQuery(query),
      });
      await writeCacheEntry(relativePath, negativeEnvelope);
      memoryCache.set(relativePath, negativeEnvelope);
      return negativeEnvelope;
    }
    circuitBreaker.recordFailure(provider);
    throw error;
  }
}

/**
 * 🆕 L5 — bir yenileme başarısız olduğunda çağrılır: BELLEKTEKİ zarfa
 * `lastErrorAt` damgasını vurur (soğuma sayacı bunu okur).
 *
 * 🔴 DİSKE YAZILMAZ — bilinçli. Sağlayıcı çökmüşken her istek başına bir
 * gzip+yazma yapmak, hiçbir şey kazandırmadan SSD'yi yorardı; damganın tek
 * tüketicisi bellekteki soğuma kontrolü. Yeniden başlatmada kaybolması da
 * zararsız (en fazla bir fazladan deneme). Damganın DİSKE de işlenmesi
 * (teşhis/telemetri amaçlı) L6'ya bırakıldı.
 *
 * 🔴 KUŞAK KONTROLÜ: yenileme başarısız olurken PARALEL bir foreground
 * isteği başarılı olup yeni bir zarf yazmış olabilir. `fetchedAt`
 * değişmişse elimizdeki damga ARTIK BAŞKA BİR KAYDA aittir — vurulmaz,
 * yoksa taptaze bir kaydı 30 sn boyunca yenilenemez damgalardık.
 */
function recordRevalidateFailure(relativePath, staleFetchedAt, now = Date.now()) {
  const current = memoryCache.get(relativePath);
  if (!current || current.fetchedAt !== staleFetchedAt) return;
  memoryCache.set(relativePath, markRevalidationFailed(current, now));
}

/** 🆕 L5 — bu zarf için son yenileme yakın zamanda mı patladı? (soğuma penceresi) */
function isInFailureCooldown(envelope, now = Date.now()) {
  return typeof envelope.lastErrorAt === 'number' && now - envelope.lastErrorAt < REVALIDATE_FAILURE_COOLDOWN_MS;
}

/**
 * "Stale" durumda çağrılır — SONUCU BEKLEMEDEN (fire-and-forget) arka
 * planda TEK bir yenileme tetikler. Üç kat tekilleştirme/sınırlama var:
 *   1. `isInFailureCooldown` — son deneme patladıysa hiç kuyruğa girmez
 *   2. `refreshQueue` — en fazla 2 paralel, aynı anahtar bir kez (L5)
 *   3. `singleFlight` — kuyruktan çıkan iş, o an foreground'da aynı
 *      anahtar için uçuşta bir çağrı varsa onu PAYLAŞIR, ikincisini açmaz
 *
 * Yenileme BAŞARISIZ olursa: `writeCacheEntry` hiç çağrılmadığı için
 * diskteki (hâlâ stale ama geçerli) zarfa dokunulmaz — 01_MIMARI.md kural
 * 4'ün ("başarısız yenileme fetchedAt'i bozmaz") doğal sonucu, ekstra kod
 * gerekmiyor. Yalnızca `lastErrorAt` damgası bellekte güncellenir.
 */
function triggerBackgroundRevalidate({ provider, family, relativePath, path, query, fetcher, staleEnvelope }) {
  if (isInFailureCooldown(staleEnvelope)) return;

  const staleFetchedAt = staleEnvelope.fetchedAt;
  refreshQueue.enqueue(relativePath, () =>
    singleFlight(relativePath, () =>
      fetchAndStore({ provider, family, relativePath, path, query, fetcher })
    ).catch((error) => {
      recordRevalidateFailure(relativePath, staleFetchedAt);
      console.error(`[LazyFetch] Arka plan yenileme başarısız (${relativePath}): ${error.message}`);
      // Hata YUTULMAZ, yeniden fırlatılır — kuyruğun `failed` sayacı
      // (L6 telemetrisi) aksi halde sonsuza kadar 0 kalırdı. Kuyruk kendi
      // içinde yakalıyor, unhandled rejection riski yok (refreshQueue.js
      // `#run`: `.then(onOk, onErr)`).
      throw error;
    })
  );
}

/**
 * Bir isteği çözer — L1-L2'nin dışa açılan TEK giriş noktası.
 *
 * @param {Object} opts
 * @param {string} opts.provider  'tmdb' (bugün tek geçerli değer, L7'de 'trakt' eklenecek)
 * @param {string} opts.path      `/tv/1396` gibi
 * @param {Object} [opts.query]   Query parametreleri (dil dahil)
 * @param {(path: string, query: Object) => Promise<{data: any, maxAgeSeconds?: number}>} opts.fetcher
 *   Sağlayıcı adaptörü — bu fonksiyon TMDB/Trakt bilgisini taşır, orchestrator taşımaz.
 * @returns {Promise<{status: string, data: any}>}
 *   status: 'passthru' | 'fresh' | 'stale' | 'miss' | 'miss-refetched' |
 *   'grace-fallback' | 'not-found' (🆕 L4 — `data` bu durumda her zaman
 *   `null`; çağıran taraf, ör. `tmdbProxy.js`, buna HTTP 404 karşılığı verir)
 */
async function resolveRequest({ provider, path, query = {}, fetcher }) {
  if (typeof fetcher !== 'function') {
    throw new Error('[LazyFetch] resolveRequest: "fetcher" zorunlu bir fonksiyon olmalı.');
  }

  const route = resolveRoute(provider, path);
  if (!route.cacheable) {
    // ⚠️ PASSTHRU `fetchAndStore`'u KULLANMAZ (cache'e hiç dokunmaz, devre
    // kesici/token bucket kapılarından geçmez) — ama adaptör (`providers/
    // tmdb.js`) HER path için 404'ü `NotFoundError`'a çeviriyor, route
    // beyaz listede olsun olmasın. Burada yakalamazsak `NotFoundError`
    // (`.response` alanı OLMAYAN, axios error'dan FARKLI bir sınıf)
    // `tmdbProxy.js`'in `error.response?.status` kontrolünü yanıltıp
    // gerçek 404'ü yanlışlıkla 500'e çevirirdi — bu regresyon olurdu.
    try {
      const result = await fetcher(path, query);
      return { status: 'passthru', data: result.data };
    } catch (error) {
      if (error instanceof NotFoundError) {
        return { status: 'not-found', data: null };
      }
      throw error; // diğer hatalar (5xx/timeout) eskisi gibi olduğu gibi yukarı
    }
  }

  const { relativePath } = buildCacheKey({ provider, family: route.family, path, query });

  // 1) Bellek → 2) Disk (bellekte yoksa, bulursa belleğe de yazar)
  let envelope = memoryCache.get(relativePath);
  if (!envelope) {
    const diskResult = await readCacheEntry(relativePath);
    if (diskResult.ok) {
      envelope = diskResult.envelope;
      memoryCache.set(relativePath, envelope);
    }
  }

  if (envelope) {
    const state = getEnvelopeState(envelope, SCHEMA_VERSION);
    if (state === 'fresh') {
      return envelopeToResult(envelope, 'fresh');
    }
    if (state === 'stale') {
      // 🆕 Negatif bir kaydı "stale" iken de yenilemek anlamlı (TMDB'ye
      // içerik sonradan eklenmiş olabilir) — aynı SWR yolunu kullanır.
      triggerBackgroundRevalidate({
        provider,
        family: route.family,
        relativePath,
        path,
        query,
        fetcher,
        staleEnvelope: envelope,
      });
      return envelopeToResult(envelope, 'stale');
    }
    // state === 'expired' → envelope'u ELDE TUTUYORUZ (silmiyoruz), aşağıda
    // sağlayıcı çağrısı başarısız olursa GRACE FALLBACK olarak kullanılacak.
  }

  try {
    const freshEnvelope = await singleFlight(relativePath, () =>
      fetchAndStore({ provider, family: route.family, relativePath, path, query, fetcher })
    );
    // 🆕 (L7+) `no-store` teşhis için AYRI bir durum: `x-lazyfetch: no-store`
    // gören operatör, "önbellek neden hiç isabet etmiyor" sorusunun cevabını
    // ölçmeden görür. Madde 261'in dersi (yanlış alet yanlış teşhis üretir)
    // burada peşinen uygulanıyor.
    const status = freshEnvelope.__notStored ? 'no-store' : envelope ? 'miss-refetched' : 'miss';
    return envelopeToResult(freshEnvelope, status);
  } catch (error) {
    if (envelope) {
      console.error(`[LazyFetch] Sağlayıcı başarısız, grace fallback dönülüyor (${relativePath}): ${error.message}`);
      return envelopeToResult(envelope, 'grace-fallback');
    }

    // ==================================================================
    // 🆕 A4 — ARŞİV GERİ DÜŞÜŞÜ (karar A5, 2026-09-04)
    // ==================================================================
    // Buraya düşmek şu demek: sağlayıcı çöktü VE elimizde hiçbir cache
    // zarfı yok. A4 ÖNCESİ burada hata fırlatılırdı; kullanıcı boş ekran
    // görürdü. Artık son bir yere daha bakıyoruz: arşive.
    //
    // 🔴 SIRA BİLİNÇLİ — arşiv grace fallback'in ARDINDA. Eski bir cache
    // zarfı arşivdeki kayıttan DAHA TAZE olabilir (cache her istekte
    // yazılır, arşiv yalnızca sağlayıcıya gidilen isteklerde + gece
    // backfill'de). Sırayı ters kurmak en taze veriyi ıskalamak olurdu.
    //
    // 🔴 ARŞİVDEN GELEN VERİ CACHE'E YAZILMAZ. İki sebep:
    //   1. `cache/` sağlayıcıdan gelenin kopyasıdır; arşivden dolduracak
    //      olsaydık, TTL'i olmayan bir kaydı TTL'li bir depoya taze diye
    //      yazmış olurduk ve sağlayıcı düzeldikten sonra bile eski veriyi
    //      "taze" sayıp servis etmeye devam ederdik.
    //   2. Kesinti bitince ilk istek sağlayıcıya gitmeli — cache'i
    //      arşivle doldurmak o ilk isteği TTL boyunca ERTELERDİ.
    //
    // ⚠️ `x-lazyfetch: archive-fallback` AYRI bir durum olarak dönüyor:
    // operatör "kullanıcı ne gördü" sorusunu ÖLÇEREK cevaplayabilmeli
    // (Madde 261: yanlış alet yanlış teşhis üretir). `grace-fallback` ile
    // aynı ada koysaydık, kesinti sırasında verinin cache'ten mi arşivden
    // mi geldiğini bir daha ayırt edemezdik.
    const arsiv = await readCatalogFromArchive({ provider, family: route.family, path, query });
    if (arsiv.ok) {
      // 🔴 SAYAÇ — A4'ün kendi doğurduğu kör noktayı kapatır. A4 öncesi bu
      // durum kullanıcıya HATA olarak görünürdü (gürültülü, fark edilir);
      // artık SESSİZCE eski veri olarak görünüyor. Sayaç olmadan "sistem
      // haftalardır arşivden servis ediyor" durumunu kimse fark etmezdi.
      // Denetçi (`scripts/lazyfetch-inspect.js`) bunu okuyup basıyor.
      bumpFallback(route.family);
      const yas = arsiv.fetchedAt ? ` (arşiv kaydı ${Math.round((Date.now() - arsiv.fetchedAt) / 86400000)} gün önce çekilmiş)` : '';
      console.error(
        `[LazyFetch] Sağlayıcı başarısız + cache boş, ARŞİV geri düşüşü (${relativePath})${yas}: ${error.message}`
      );
      return { status: 'archive-fallback', data: arsiv.data };
    }

    throw error; // sağlayıcı da cache de arşiv de yok — hata olduğu gibi yukarı
  }
}

module.exports = {
  resolveRequest,
  // Yalnızca test/teşhis için dışa veriliyor.
  memoryCache,
  refreshQueue, // 🆕 L5 — `getStats()` L6 telemetrisinin bağlanacağı yer
  REVALIDATE_FAILURE_COOLDOWN_MS,
};
