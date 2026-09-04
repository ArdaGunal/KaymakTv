// ==========================================================================
// LAZYFETCH — Orkestratör / KARAR AĞACI (L2, dosya 5/5)
// ==========================================================================
// TEK İŞİ: bir isteği alıp karar ağacını (docs/Lazy Down Plan/03_FAZLAR.md
// "3.7 Adım A→D Akışı") yürütmek:
//
//   rota defteri → PASSTHRU ise sağlayıcıya DOĞRUDAN git, cache'e hiç dokunma
//   cacheable ise:
//     bellek taze/bayat mı? → disk taze/bayat mı? → tek-uçuş kilidi → sağlayıcı
//     sağlayıcı çöktüyse: grace fallback → arşiv → hata
//
// ==========================================================================
// 📁 AİLE HARİTASI — bu dosya 446 satıra çıkınca BÖLÜNDÜ (Madde 295)
// ==========================================================================
// AI_RULES 400 satır kuralı. Bölme çizgileri rastgele değil; her parça TEK
// bir soruyu cevaplıyor ve **karar ağacı burada, tek parça halinde kaldı** —
// asıl korunması gereken şey oydu.
//
//   state.js           paylaşılan singleton'lar + tek-uçuş kilidi
//                      → "aynı anda gelen N istek nasıl tekilleşir?"
//   fetchAndStore.js   sağlayıcıya giden TEK yol + üç kapı (devre kesici,
//                      token bucket, no-store) + yazım + arşiv kancası
//                      → "sağlayıcıya ne zaman gidilir, sonuç nereye yazılır?"
//   revalidate.js      SWR arka plan yenileme + başarısızlık soğuması (L5)
//                      → "bayat kayıt ne zaman, kaç kez tazelenir?"
//   archiveFallback.js arşivden servis + sayaç + kesinti uyarısı (A4)
//                      → "her şey başarısız olunca ne yaparız, kim öğrenir?"
//   orchestrator.js    BU DOSYA — yalnızca sıralama/karar
//
// 🔴 SAĞLAYICI SOYUTLAMASI (01_MIMARI.md "Sağlayıcı Adaptörü — bağımsızlık
// anahtarı burada çevrilecek"): bu aile TMDB/Trakt hiçbir şey BİLMEZ.
// Çağıran taraf bir `fetcher(path, query) => Promise<{ data, maxAgeSeconds }>`
// fonksiyonu enjekte eder.
//
// 🔴 GRACE FALLBACK (01_MIMARI.md kural 5 "sert-bayat"): sağlayıcı çağrısı
// BAŞARISIZ olursa ve elimizde eski (artık `hard_expires_at`'i de geçmiş)
// bir zarf varsa, hata fırlatmak yerine O ESKİ VERİ dönülür — dış API
// çökse bile kullanıcı boş ekran görmez.
//
// 🆕 L4 — DİSİPLİN KATMANI ve NEGATİF CACHE `fetchAndStore.js`'te; ikisi de
// sağlayıcıya giden yolun parçası olduğu için oraya taşındı.

const { resolveRoute } = require('./routeRegistry');
const { buildCacheKey } = require('./key');
const { getEnvelopeState, SCHEMA_VERSION } = require('./envelope');
const { readCacheEntry } = require('./diskStore');
const { NotFoundError } = require('./errors');

const { memoryCache, refreshQueue, singleFlight } = require('./state');
const { fetchAndStore } = require('./fetchAndStore');
const { triggerBackgroundRevalidate, REVALIDATE_FAILURE_COOLDOWN_MS } = require('./revalidate');
const { tryArchiveFallback } = require('./archiveFallback');

/** Bir zarfı `resolveRequest`'in dış sözleşmesine çevirir — `isNegative` ise `data` her zaman `null` ve status `not-found`'a sabitlenir. */
function envelopeToResult(envelope, status) {
  if (envelope.isNegative) return { status: 'not-found', data: null };
  return { status, data: envelope.payload };
}

/**
 * Bir isteği çözer — L1-L2'nin dışa açılan TEK giriş noktası.
 *
 * @param {Object} opts
 * @param {string} opts.provider  'tmdb' | 'trakt'
 * @param {string} opts.path      `/tv/1396` gibi
 * @param {Object} [opts.query]   Query parametreleri (dil dahil)
 * @param {(path: string, query: Object) => Promise<{data: any, maxAgeSeconds?: number}>} opts.fetcher
 *   Sağlayıcı adaptörü — bu fonksiyon TMDB/Trakt bilgisini taşır, orchestrator taşımaz.
 * @returns {Promise<{status: string, data: any}>}
 *   status: 'passthru' | 'fresh' | 'stale' | 'miss' | 'miss-refetched' |
 *   'no-store' | 'grace-fallback' | 'archive-fallback' (🆕 A4) |
 *   'not-found' (🆕 L4 — `data` bu durumda her zaman `null`; çağıran taraf,
 *   ör. `tmdbProxy.js`, buna HTTP 404 karşılığı verir)
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
    // ------------------------------------------------------------------
    // BAŞARISIZLIK MERDİVENİ — sıra bilinçli, gerekçesi `04_KARARLAR.md` §A5
    // ------------------------------------------------------------------
    // 1) GRACE FALLBACK: elimizde eski bir cache zarfı varsa onu dön.
    if (envelope) {
      console.error(`[LazyFetch] Sağlayıcı başarısız, grace fallback dönülüyor (${relativePath}): ${error.message}`);
      return envelopeToResult(envelope, 'grace-fallback');
    }

    // 2) 🆕 A4 — ARŞİV. Buraya düşmek şu demek: sağlayıcı çöktü VE elimizde
    //    hiçbir cache zarfı yok. A4 ÖNCESİ burada hata fırlatılırdı;
    //    kullanıcı boş ekran görürdü.
    //
    // 🔴 ARŞİV GRACE'İN ARDINDA, ÖNÜNDE DEĞİL: eski bir cache zarfı
    // arşivdeki kayıttan DAHA TAZE olabilir (cache her istekte yazılır,
    // arşiv yalnızca sağlayıcıya gidilen isteklerde + gece backfill'de).
    // Sırayı ters kurmak elimizdeki en taze veriyi ıskalamak olurdu.
    //
    // 🔴 ARŞİVDEN GELEN VERİ CACHE'E YAZILMAZ. İki sebep:
    //   1. TTL'i olmayan bir kaydı TTL'li bir depoya "taze" diye yazmak,
    //      sağlayıcı düzeldikten sonra bile eski veriyi servis etmek olurdu.
    //   2. Kesinti bitince ilk istek sağlayıcıya gitmeli — cache'i arşivle
    //      doldurmak o ilk isteği TTL boyunca ERTELERDİ.
    //
    // ⚠️ `archive-fallback` AYRI bir durum adı: operatör "kullanıcı ne
    // gördü" sorusunu ÖLÇEREK cevaplayabilmeli (Madde 261). `grace-fallback`
    // ile aynı ada koysaydık, kesinti sırasında verinin cache'ten mi
    // arşivden mi geldiğini bir daha ayırt edemezdik.
    const arsiv = await tryArchiveFallback({
      provider, family: route.family, path, query, relativePath, error,
    });
    if (arsiv.ok) {
      return { status: 'archive-fallback', data: arsiv.data };
    }

    // 3) Sağlayıcı da cache de arşiv de yok — hata OLDUĞU GİBİ yukarı.
    //    Geri düşüş yolları teşhisi BOZMAMALI: operatör "Trakt 504 verdi"
    //    görmeli, "sqlite ..." değil.
    throw error;
  }
}

module.exports = {
  resolveRequest,
  // Yalnızca test/teşhis için dışa veriliyor. 🔴 BÖLÜNMEDEN SONRA DA AYNI
  // SÖZLEŞME: bunlar artık `state.js`/`revalidate.js`'te yaşıyor ama
  // buradan yeniden dışa veriliyor — `tmdbProxy.js`, `traktCatalog.js`,
  // `backfill.js` ve testler bu dosyayı tanıyor, onları kırmanın anlamı yok.
  memoryCache,
  refreshQueue, // 🆕 L5 — `getStats()` L6 telemetrisinin bağlanacağı yer
  REVALIDATE_FAILURE_COOLDOWN_MS,
};
