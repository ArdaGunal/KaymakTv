// ==========================================================================
// LAZYFETCH — Rota Kayıt Defteri (L2, dosya 1/2)
// ==========================================================================
// TEK İŞİ: "Bu istek cache'lenir mi, hangi aileye ait, TTL/grace sınırları
// ne olmalı?" sorusunun TEK karar noktası olmak.
//
// 🔴 KALIPLAR UYDURULMADI — `services/tmdbApi.ts`'teki (istemci) GERÇEK
// `fetchFromTmdb()` çağrılarından çıkarıldı (2026-08-28 taraması, 8 farklı
// uç): `/tv/:id`, `/movie/:id`, `/tv/:id/images`, `/tv/:id/videos`,
// `/movie/:id/videos`, `/tv/:id/season/:s/episode/:e`, `/:type/:id/credits`,
// `/tv/:id/season/:s/episode/:e/credits`. Buradaki listenin dışında kalan
// HER path otomatik olarak PASSTHRU'dur — beyaz liste mantığı (bilinmeyen
// bir uca "belki cache'lenir" denmez).
//
// 🆕 TTL BURADA SABİT YAZILMAZ (docs/Lazy Down Plan/01_MIMARI.md kural 1 +
// 04_KARARLAR.md A3): TMDB de Trakt gibi HER yanıtta kendi `Cache-Control:
// max-age=N`'ini söylüyor (canlı ölçüldü, 2026-08-28: `/tv/1396` →
// max-age=3760, `/tv/1396/credits` → max-age=10870 — sabit DEĞİL, isteğe
// göre değişiyor). Bu yüzden route registry yalnızca bir GÜVENLİK AĞI
// (taban/tavan `clamp`) taşır — 04_KARARLAR.md A3 kararı (c): sağlayıcı
// anormal bir değer dönerse (çok kısa/çok uzun) kırpılır, normal şartlarda
// sağlayıcının kendi değeri kullanılır. Gerçek TTL kararı orchestrator.js'te
// `clampTtl()` ile, sağlayıcı yanıtının header'ına göre verilir.
//
// 🆕 TMDB'de 304 (`If-None-Match`) ÇALIŞIYOR (canlı ölçüldü, Trakt'ın
// tersine) — bu dosyada henüz KULLANILMIYOR, L5'in (SWR) revalidation'ında
// bant genişliği tasarrufu için değerlendirilecek (04_KARARLAR.md B2 artık
// kapalı: TMDB'de çalışıyor, Trakt'ta çalışmıyor).
//
// `gracePeriodMultiplier` (bayatlık tavanı) bir BAŞLANGIÇ değeridir — kesin
// sayı telemetry olmadan iddia edilmez (04_KARARLAR.md B: "gerçek sayılar
// ölçülmeden belirlenmez"). Amacı yalnızca "taze TTL'in birkaç katı kadar
// bayat veriyi servis etmeye devam et" oranını sabitlemek; L6'da gerçek
// kullanım verisiyle ayarlanacak.

const TTL_FLOOR_MS = 60 * 1000; // 1 dakika — sağlayıcı anormal derecede kısa bir max-age dönerse taban
const TTL_CEILING_MS = 7 * 24 * 60 * 60 * 1000; // 7 gün — anormal derecede uzun bir max-age dönerse tavan
const DEFAULT_TTL_MS = 60 * 60 * 1000; // sağlayıcı hiç Cache-Control döndürmezse (uç durum) kullanılan yedek
const DEFAULT_GRACE_MULTIPLIER = 4; // toplam "servis edilebilir" pencere ≈ TTL × (1 + 4) = TTL'in 5 katı

// 🆕 (L4, negatif cache): "kaynak yok" (404) bilgisinin ne kadar saklanacağı.
// Sağlayıcıdan bir `max-age` gelmiyor (404 yanıtının kendi TTL'i yok) — bu
// yüzden route registry'nin normal `resolveTtl()`'inden AYRI, sabit bir
// değer. Lazy_down.txt'teki AI önerisi ("404 için 10 dakika") başlangıç
// noktası — L6 telemetry ile ayarlanabilir. Grace kısa tutuldu (TTL'in
// yalnızca katı) çünkü negatif bir kaydın uzun süre "yok" demeye devam
// etmesi istenmez (TMDB'ye içerik sonradan eklenebilir).
const NEGATIVE_TTL_MS = 10 * 60 * 1000; // 10 dakika
const NEGATIVE_GRACE_MS = 10 * 60 * 1000; // +10 dakika (toplam 20 dakika sonra tamamen düşer)

// Path kalıpları — ID'ler zaten `key.js`'in hash'ine gireceği için burada
// yalnızca "bu path hangi AİLEye ait" ayrımını yapıyoruz, ID'nin kendisini
// yakalamaya gerek yok (`\d+` yeterli, capture group gerekmez).
const TMDB_ROUTES = [
  { family: 'tv_detail', regex: /^\/tv\/\d+$/ },
  { family: 'movie_detail', regex: /^\/movie\/\d+$/ },
  { family: 'tv_images', regex: /^\/tv\/\d+\/images$/ },
  { family: 'tv_videos', regex: /^\/tv\/\d+\/videos$/ },
  { family: 'movie_videos', regex: /^\/movie\/\d+\/videos$/ },
  { family: 'episode_detail', regex: /^\/tv\/\d+\/season\/\d+\/episode\/\d+$/ },
  { family: 'credits', regex: /^\/(tv|movie)\/\d+\/credits$/ },
  { family: 'episode_credits', regex: /^\/tv\/\d+\/season\/\d+\/episode\/\d+\/credits$/ },
];

const PROVIDER_ROUTES = {
  tmdb: TMDB_ROUTES,
  // trakt: L7'de eklenecek (03_FAZLAR.md — istemci değişikliği gerektiren,
  // en riskli adım; L1-L3'ün kapsamı dışında, bilinçli olarak burada yok).
};

/**
 * Bir isteğin cache politikasını çözer.
 *
 * @param {string} provider  'tmdb' (şimdilik tek geçerli değer)
 * @param {string} rawPath   `/tv/1396` gibi normalize edilmemiş path
 * @returns {{ cacheable: boolean, family: string|null }}
 *   `cacheable: false` → PASSTHRU, orchestrator cache'e hiç dokunmadan
 *   doğrudan sağlayıcıya gider. Bilinmeyen provider da PASSTHRU sayılır
 *   (beyaz liste dışına "belki" denmez).
 */
function resolveRoute(provider, rawPath) {
  const routes = PROVIDER_ROUTES[provider];
  if (!routes) return { cacheable: false, family: null };

  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const match = routes.find((r) => r.regex.test(normalizedPath));
  if (!match) return { cacheable: false, family: null };

  return { cacheable: true, family: match.family };
}

/**
 * Sağlayıcının `Cache-Control: max-age=N` değerini (saniye) taban/tavan
 * arasına kırpar ve grace süresini oranlar. Sağlayıcı hiç header
 * vermezse (`providerMaxAgeSeconds` null/undefined) `DEFAULT_TTL_MS` kullanılır.
 */
function resolveTtl(providerMaxAgeSeconds) {
  const raw =
    typeof providerMaxAgeSeconds === 'number' && providerMaxAgeSeconds > 0
      ? providerMaxAgeSeconds * 1000
      : DEFAULT_TTL_MS;

  const ttlMs = Math.min(Math.max(raw, TTL_FLOOR_MS), TTL_CEILING_MS);
  const graceMs = ttlMs * DEFAULT_GRACE_MULTIPLIER;

  return { ttlMs, graceMs };
}

module.exports = {
  resolveRoute,
  resolveTtl,
  NEGATIVE_TTL_MS,
  NEGATIVE_GRACE_MS,
  // Yalnızca test/teşhis için dışa veriliyor.
  TTL_FLOOR_MS,
  TTL_CEILING_MS,
  DEFAULT_TTL_MS,
  DEFAULT_GRACE_MULTIPLIER,
};
