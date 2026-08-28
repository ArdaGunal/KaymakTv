// ==========================================================================
// LAZYFETCH — Devre Kesici (L4, dosya 3/4)
// ==========================================================================
// TEK İŞİ: bir sağlayıcı üst üste hata vermeye başladığında Pi'nin "zaman
// aşımı kuyruğuna" dönüşmesini engellemek (01_MIMARI.md "Disiplin Katmanı",
// Lazy_down.txt "3.8": "Bu, Trakt çöktüğünde Pi'nin zaman-aşımı kuyruğuna
// dönüşmesini engeller").
//
// Klasik üç durumlu devre kesici:
//   CLOSED    → normal, her istek sağlayıcıya gider
//   OPEN      → `openDurationMs` boyunca sağlayıcıya HİÇ gidilmez,
//               `CircuitOpenError` fırlatılır (orchestrator bunu grace
//               fallback'e çevirir — elimizde eski veri varsa kullanıcı
//               yine de bir cevap alır)
//   HALF_OPEN → süre dolunca TEK bir deneme hakkı verilir; başarılıysa
//               CLOSED'a döner, başarısızsa tekrar OPEN olur
//
// 🔴 SAYI UYDURULMADI AMA ÖLÇÜLMEDİ DE (tokenBucket.js'teki aynı dürüstlük):
// `failureThreshold`/`openDurationMs` makul BAŞLANGIÇ değerleri — kesin
// doğru sayı iddiası değil, L6 telemetry ile ayarlanacak.

const DEFAULT_CONFIG = {
  tmdb: { failureThreshold: 5, openDurationMs: 30 * 1000 },
  // 🆕 L7 — Trakt katalog geçidi. TMDB ile AYNI eşikler: iki sağlayıcı da
  // "çökerse bekle, boşuna dövme" davranışını aynı ölçekte istiyor ve
  // farklı bir sayı için elimizde hiçbir gerekçe yok. Ayrıştırmak
  // gerekirse telemetri söyler (04_KARARLAR.md B).
  trakt: { failureThreshold: 5, openDurationMs: 30 * 1000 },
};

class CircuitBreaker {
  constructor({ failureThreshold, openDurationMs }) {
    if (!Number.isInteger(failureThreshold) || failureThreshold <= 0) {
      throw new Error('[LazyFetch] CircuitBreaker: "failureThreshold" pozitif bir tam sayı olmalı.');
    }
    if (!Number.isFinite(openDurationMs) || openDurationMs <= 0) {
      throw new Error('[LazyFetch] CircuitBreaker: "openDurationMs" pozitif bir sayı olmalı.');
    }
    this.failureThreshold = failureThreshold;
    this.openDurationMs = openDurationMs;
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.openedAt = null;
  }

  /**
   * İstek atılabilir mi? OPEN durumdayken süre dolmuşsa TEK SEFERLİK
   * HALF_OPEN geçişi burada (yan etkili) yapılır — aynı tick'te gelen
   * ikinci bir `canRequest` çağrısı artık `false` döner (tek deneme
   * garantisi, paralel isteklerin hepsinin aynı anda "deneme hakkını"
   * kullanmaya çalışmasını önler).
   */
  canRequest(now = Date.now()) {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      if (now - this.openedAt >= this.openDurationMs) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    // HALF_OPEN: deneme hakkı zaten verilmişti (veya kullanılmayı bekliyor) — yeni istek beklemeli.
    return false;
  }

  recordSuccess() {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.openedAt = null;
  }

  recordFailure(now = Date.now()) {
    this.consecutiveFailures += 1;
    if (this.state === 'HALF_OPEN') {
      // Deneme başarısız — hemen tekrar AÇ, tam eşiği yeniden doldurmayı bekleme.
      this.state = 'OPEN';
      this.openedAt = now;
      return;
    }
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = now;
    }
  }
}

// Sağlayıcı başına TEK paylaşılan devre — tokenBucket.js'teki registry deseniyle aynı.
const breakers = new Map();

function getBreaker(providerId) {
  if (!breakers.has(providerId)) {
    const config = DEFAULT_CONFIG[providerId];
    if (!config) {
      throw new Error(`[LazyFetch] CircuitBreaker: "${providerId}" için tanımlı config yok.`);
    }
    breakers.set(providerId, new CircuitBreaker(config));
  }
  return breakers.get(providerId);
}

function canRequest(providerId) {
  return getBreaker(providerId).canRequest();
}

function recordSuccess(providerId) {
  getBreaker(providerId).recordSuccess();
}

function recordFailure(providerId) {
  getBreaker(providerId).recordFailure();
}

module.exports = {
  canRequest,
  recordSuccess,
  recordFailure,
  // Yalnızca test için dışa veriliyor.
  CircuitBreaker,
  DEFAULT_CONFIG,
};
