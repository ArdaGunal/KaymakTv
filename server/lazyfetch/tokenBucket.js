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

const DEFAULT_LIMITS = {
  tmdb: { capacity: 20, refillRatePerSecond: 20 },
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

module.exports = {
  tryConsume,
  // Yalnızca test için dışa veriliyor.
  TokenBucket,
  DEFAULT_LIMITS,
};
