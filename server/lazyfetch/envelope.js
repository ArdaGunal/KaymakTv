// ==========================================================================
// LAZYFETCH — Zarf Formatı (L1, dosya 3/5)
// ==========================================================================
// TEK İŞİ: diskteki her cache kaydının ORTAK dilini tanımlamak ve "bu kayıt
// şu an taze mi, bayat mı, tamamen süresi dolmuş mu" sorusunu cevaplamak.
//
// 🔴 NEDEN DOSYA MTIME'A GÜVENİLMEZ (docs/Lazy Down Plan/01_MIMARI.md kural 3):
// dosya kopyalanınca/taşınınca/saat atlayınca mtime yalan söyler. Zaman
// damgaları zarfın İÇİNE gömülür — TTL kararı her zaman `payload`'ın
// yanındaki bu alanlara bakılarak verilir.
//
// 🔴 ÜÇ ZAMAN BÖLGESİ (01_MIMARI.md kural 5):
//   fresh   → now < expiresAt          : SSD'den dön, dışarı ÇIKMA
//   stale   → expiresAt <= now < hardExpiresAt : SSD'den HEMEN dön + arkada
//             TEK yenileme (SWR, L5'te bağlanacak)
//   expired → now >= hardExpiresAt     : normalde dönme; dış API çökmüşse
//             grace fallback ayrı bir karar (orchestrator L2'nin işi)
//
// 🔴 BAŞARISIZ YENİLEME `fetchedAt`'İ GÜNCELLEMEZ (01_MIMARI.md kural 4):
// aksi halde sistem bozuk veriyi taze sanıp sonsuza saklar. Bu yüzden
// `markRevalidationFailed` yalnızca `lastErrorAt`'i dokunur, gerisi sabit.
//
// Bu dosya da saf — hiçbir API'ye, hiçbir dosya sistemine bağlı değil.

const SCHEMA_VERSION = 1;

/**
 * TTL'e ±%10 rastgelelik uygular (01_MIMARI.md kural 1) — aynı anda
 * doldurulan yüzlerce kaydın aynı anda bayatlayıp senkron bir yenileme
 * dalgası (stampede) yaratmasını önler.
 */
function applyJitter(ttlMs) {
  const jitterRatio = 0.9 + Math.random() * 0.2; // [0.9, 1.1)
  return Math.round(ttlMs * jitterRatio);
}

/**
 * Yeni bir zarf oluşturur.
 *
 * @param {Object} opts
 * @param {string} opts.provider   'tmdb' | 'trakt'
 * @param {string} opts.family     02_ENVANTER.md sınıflandırması (ör. 'tv_detail')
 * @param {*}      opts.payload    Sağlayıcıdan gelen HAM yanıt (yalnızca veri — sır YOK, bkz. key.js SECRET_PARAM_NAMES ile aynı disiplin)
 * @param {number} opts.ttlMs      Taze kalma süresi (jitter ÖNCESİ) — tercihen sağlayıcının kendi `Cache-Control`'ünden (03_FAZLAR.md A3 karar kaydı)
 * @param {number} opts.graceMs    `ttlMs` bittikten SONRA "bayat ama servis edilebilir" ek süre — ZORUNLU parametre, burada uydurulmaz (04_KARARLAR.md B: "gerçek sayılar telemetry ile ölçülmeden belirlenmez"), çağıran taraf (routeRegistry) her aile için kendi kararını verir
 * @param {number} [opts.schemaVersion] Varsayılan modül sabiti — yanıt şekli değişirse çağıran taraf artırır
 * @param {number} [opts.now]      Test edilebilirlik için enjekte edilebilir
 * @param {boolean} [opts.isNegative] 🆕 (L4, negatif cache): sağlayıcı "bu kaynak yok" (404) dediğinde
 *   `true` — `payload` bu durumda `null`. Aynı TTL/grace kurallarına tabi, yalnızca orchestrator'ın
 *   okuma tarafı bu bayrağı görünce "veri" yerine "yok" bilgisini yeniden üretir
 *   (bkz. `docs/Lazy Down Plan/02_ENVANTER.md` "404 için negative cache").
 */
function createEnvelope({ provider, family, payload, ttlMs, graceMs, schemaVersion = SCHEMA_VERSION, now = Date.now(), isNegative = false }) {
  if (!provider || !family) {
    throw new Error('[LazyFetch] createEnvelope: "provider" ve "family" zorunlu.');
  }
  if (typeof ttlMs !== 'number' || ttlMs <= 0) {
    throw new Error('[LazyFetch] createEnvelope: "ttlMs" pozitif bir sayı olmalı.');
  }
  if (typeof graceMs !== 'number' || graceMs < 0) {
    throw new Error('[LazyFetch] createEnvelope: "graceMs" verilmeli (uydurulmasın diye burada varsayılan YOK — bkz. dosya başlığı).');
  }

  const jitteredTtl = applyJitter(ttlMs);
  const expiresAt = now + jitteredTtl;

  return {
    v: schemaVersion,
    provider,
    family,
    fetchedAt: now,
    expiresAt,
    hardExpiresAt: expiresAt + graceMs,
    lastErrorAt: null,
    isNegative,
    payload,
  };
}

/**
 * Bir zarfın şu an hangi zaman bölgesinde olduğunu döner.
 *
 * `expectedSchemaVersion` uyuşmazsa (yanıt şekli değişmiş, eski zarf
 * artık okunamaz demektir) doğrudan 'expired' — 01_MIMARI.md kural 3'ün
 * "v alanı tüm cache'i tek sayıyla geçersiz kılar" davranışı burada uygulanır.
 */
function getEnvelopeState(envelope, expectedSchemaVersion = SCHEMA_VERSION, now = Date.now()) {
  if (!envelope || typeof envelope !== 'object') return 'expired';
  if (envelope.v !== expectedSchemaVersion) return 'expired';
  if (typeof envelope.expiresAt !== 'number' || typeof envelope.hardExpiresAt !== 'number') return 'expired';

  if (now < envelope.expiresAt) return 'fresh';
  if (now < envelope.hardExpiresAt) return 'stale';
  return 'expired';
}

/**
 * SWR revalidation'ı BAŞARISIZ olduğunda çağrılır (L5'te bağlanacak).
 * Yalnızca `lastErrorAt` değişir — `fetchedAt`/`expiresAt`/`hardExpiresAt`/
 * `payload` AYNEN kalır. Bu, "bozuk/erişilemeyen veriyi taze sanma" hatasının
 * yapısal olarak imkânsız kılınmasıdır (dosya başlığındaki kırmızı not).
 */
function markRevalidationFailed(envelope, now = Date.now()) {
  return { ...envelope, lastErrorAt: now };
}

module.exports = {
  SCHEMA_VERSION,
  createEnvelope,
  getEnvelopeState,
  markRevalidationFailed,
  // Yalnızca test için dışa veriliyor.
  applyJitter,
};
