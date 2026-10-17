// ==========================================================================
// LAZYFETCH — Token Bucket (L4, dosya 2/4)
// ==========================================================================
// TEK İŞİ: sağlayıcıya (TMDB) kendi koyduğumuz bir hız tavanının üstünde
// istek atmamak — "kendimizi koruma" değil, "sağlayıcıyı koruma" (01_MIMARI.md
// "Rate limiting = KaymakTV'nin KENDİSİNİ koruma" ile KARIŞTIRILMASIN; o,
// server/security.js'teki `tmdbLimiter`'ın işi — istemciden Pi'ye gelen
// trafiği sınırlar. Bu dosya Pi'den SAĞLAYICIYA giden trafiği sınırlar).
//
// 🔴 SAYI UYDURULMADI AMA ÖLÇÜLMEDİ DE (04_KARARLAR.md B1'in ikizi):
// TMDB'nin resmi dokümanı ~40 istek/sn civarında üst sınır olduğunu
// söylüyor (00_BULGULAR.md §3'te alıntılanan kaynak) — bu KENDİ ölçümümüz
// DEĞİL, sağlayıcının beyanı. Güvenlik payı için tavanın YARISI (20/sn)
// kullanılıyor. Gerçek trafik ölçülünce (L6 telemetri) ayarlanabilir —
// bu bir başlangıç değeri, kesin doğru sayı iddiası değil.
//
// Algoritma: klasik token bucket. `capacity` kadar "patlama" (burst) tokenı
// birikebilir, her saniye `refillRatePerSecond` kadar yeni token eklenir
// (tavana kadar). Token yoksa istek REDDEDİLİR (kuyruğa alınıp
// BEKLETİLMEZ — bu, L4'ün kapsamını büyütmemek için bilinçli bir
// sadeleştirme; reddedilen istek orchestrator'da grace fallback'e düşer).

// 🆕 K3 (2026-10-18, M531) — TMDB 20/20'den 40/30'a. Canlıda kendi kovamız iki
// kez doldu ve TMDB'ye hiç gitmeden 503 verdik: 2026-09-20 03:44 (31 istek) ve
// 2026-10-09 02:36 (37 istek) — soğuk önbellekte uzun bir afiş ızgarası aynı
// saniyede 30-40 MISS üretiyor. TMDB'nin güncel beyanı (developer.themoviedb.org
// /docs/rate-limiting, 2026-10-18 okundu): «somewhere in the 40 requests per
// second range». `capacity: 40` = o patlamayı tek seferde karşılar; sürekli hız
// 30/sn = beyanın %75'i (arka plan SWR yenilemeleri de bu kovadan yer, en fazla
// 2 paralel — `refreshQueue.js`). Jeton YALNIZCA sağlayıcıya çıkarken harcanır
// (`fetchAndStore.js`); önbellek isabeti ve bayat dönüş kovaya dokunmaz.
const DEFAULT_LIMITS = {
  tmdb: { capacity: 40, refillRatePerSecond: 30 },
  // 🆕 L7 — Trakt. TMDB'den ÇOK daha düşük, çünkü Trakt'ın beyan ettiği
  // sınır çok daha dar: dokümanında 5 dakikada 1.000 çağrı (≈200/dk ≈
  // 3,3/sn) diyor. Bu BİZİM ölçümümüz DEĞİL, sağlayıcının beyanı — ve
  // Trakt bu uçta gerçek bir `X-Ratelimit` başlığı DÖNDÜRMÜYOR (canlı
  // kontrol edildi, yalnızca `Access-Control-Expose-Headers` listesinde
  // adı geçiyor), yani ölçerek doğrulayamıyoruz.
  //
  // Güvenlik payıyla sürekli hız 2/sn (≈120/dk) seçildi; `capacity: 10`
  // ise bir sayfa açılışındaki kısa patlamayı karşılar. Gerçek origin
  // yükü bundan ÇOK daha düşük olacak: bu uçların arkasında LazyFetch var
  // ve Trakt paylaşımlı cache'lere 12 saat TTL veriyor (`s-maxage=43200`,
  // canlı ölçüldü) — yani aynı dizi günde en fazla iki kez origin'e gider.
  trakt: { capacity: 10, refillRatePerSecond: 2 },
};

class TokenBucket {
  /** `now` test edilebilirlik için enjekte edilebilir (envelope.js'teki aynı desen) — verilmezse gerçek `Date.now()`. */
  constructor({ capacity, refillRatePerSecond, now = Date.now() }) {
    if (!Number.isFinite(capacity) || capacity <= 0) {
      throw new Error('[LazyFetch] TokenBucket: "capacity" pozitif bir sayı olmalı.');
    }
    if (!Number.isFinite(refillRatePerSecond) || refillRatePerSecond <= 0) {
      throw new Error('[LazyFetch] TokenBucket: "refillRatePerSecond" pozitif bir sayı olmalı.');
    }
    this.capacity = capacity;
    this.refillRatePerSecond = refillRatePerSecond;
    this.tokens = capacity; // başlangıçta dolu — ilk saniyede tam hız
    this.lastRefillAt = now;
  }

  _refill(now) {
    const elapsedSeconds = Math.max(0, (now - this.lastRefillAt) / 1000);
    if (elapsedSeconds <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillRatePerSecond);
    this.lastRefillAt = now;
  }

  /** Token varsa tüketir ve `true` döner; yoksa `false` (istek reddedilmeli). */
  tryConsume(now = Date.now()) {
    this._refill(now);
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

// Sağlayıcı başına TEK paylaşılan bucket — modül seviyesinde (Node require
// cache'i sayesinde doğal singleton), routeRegistry/memoryCache ile aynı desen.
const buckets = new Map();

function getBucket(providerId) {
  if (!buckets.has(providerId)) {
    const limits = DEFAULT_LIMITS[providerId];
    if (!limits) {
      throw new Error(`[LazyFetch] TokenBucket: "${providerId}" için tanımlı limit yok.`);
    }
    buckets.set(providerId, new TokenBucket(limits));
  }
  return buckets.get(providerId);
}

function tryConsume(providerId) {
  return getBucket(providerId).tryConsume();
}

/**
 * 🆕 K8 (M531) — sağlık ucu için SALT OKUMA anlık görüntü. Kovanın durumunu
 * DEĞİŞTİRMEZ (`_refill` çağrılmaz, jeton harcanmaz); dolumu yalnızca hesaplar.
 */
function kovaDurumu(providerId, now = Date.now()) {
  const limit = DEFAULT_LIMITS[providerId];
  if (!limit) return null;
  const kova = buckets.get(providerId);
  if (!kova) return { jeton: limit.capacity, kapasite: limit.capacity, dolumSn: limit.refillRatePerSecond };
  const gecen = Math.max(0, (now - kova.lastRefillAt) / 1000);
  const jeton = Math.min(kova.capacity, kova.tokens + gecen * kova.refillRatePerSecond);
  return { jeton: Math.floor(jeton), kapasite: kova.capacity, dolumSn: kova.refillRatePerSecond };
}

module.exports = {
  tryConsume,
  kovaDurumu,
  // Yalnızca test için dışa veriliyor.
  TokenBucket,
  DEFAULT_LIMITS,
};
