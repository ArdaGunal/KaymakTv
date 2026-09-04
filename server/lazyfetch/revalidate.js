// ==========================================================================
// LAZYFETCH — Arka Plan Yenileme / SWR (L5, dosya 3/5)
// ==========================================================================
// TEK İŞİ: "bayat" bir kaydı KULLANICIYI BEKLETMEDEN arka planda tazelemek
// ve ölü bir sağlayıcıyı boşuna dövmemek (soğuma penceresi).
//
// Bu dosya `orchestrator.js`'ten ayrıldı (Madde 295). Ayrılma çizgisi
// doğal: buradaki her şey L5'in "SWR sağlamlaştırma" turunda eklendi ve
// tek bir soruyu cevaplıyor — *"bayat kaydı ne zaman, kaç kez, hangi
// koşulda yenilemeye çalışırız?"*

const { markRevalidationFailed } = require('./envelope');
const { fetchAndStore } = require('./fetchAndStore');
// 🔴 Singleton'lar `state.js`'ten — kendi kuyruğunu yaratsaydı L5'in
// "en fazla 2 paralel" tavanı sessizce ikiye katlanırdı (state.js başlığı).
const { memoryCache, refreshQueue, singleFlight } = require('./state');

/**
 * 🆕 L5 — bir yenileme başarısız olduktan sonra aynı anahtar için yeni bir
 * yenileme denemeden önce beklenecek süre. 30 sn seçildi çünkü devre
 * kesicinin açık kalma süresiyle (circuitBreaker.js, 30 sn) AYNI ölçekte
 * olması gerekiyor: daha kısa olsaydı, devre kapanmadan boşuna deneme
 * üretirdik; çok daha uzun olsaydı, sağlayıcı toparladıktan sonra bile
 * bayat veri servis etmeye gereksiz yere devam ederdik. Ölçülmüş bir sayı
 * DEĞİL, gerekçelendirilmiş bir başlangıç değeri (04_KARARLAR.md B).
 */
const REVALIDATE_FAILURE_COOLDOWN_MS = 30 * 1000;

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

module.exports = {
  triggerBackgroundRevalidate,
  REVALIDATE_FAILURE_COOLDOWN_MS,
  // Yalnızca test/teşhis için dışa veriliyor.
  recordRevalidateFailure,
  isInFailureCooldown,
};
