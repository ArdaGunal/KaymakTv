// ==========================================================================
// LAZYFETCH — Ortak Hata Sınıfları (L4, dosya 1/4)
// ==========================================================================
// TEK İŞİ: sağlayıcıdan BAĞIMSIZ, orchestrator'ın anlayabileceği hata
// kavramları tanımlamak.
//
// 🔴 NEDEN GEREKLİ (01_MIMARI.md "Sağlayıcı Adaptörü"): orchestrator.js
// TMDB/Trakt'ın HTTP durum kodlarını (404, 429...) BİLMEMELİ — bilirse
// "sağlayıcı soyutlaması" kırılır, yarın Trakt (L7) eklendiğinde
// orchestrator'a tekrar dokunmak gerekirdi. Bunun yerine adaptörler
// (`providers/tmdb.js`, ileride `providers/trakt.js`) kendi HTTP bilgisini
// bu GENEL sınıflara çevirir; orchestrator yalnızca `instanceof` ile
// tanır.
//
// `NotFoundError` → negatif cache'e girer (02_ENVANTER.md, Lazy_down.txt
// "404 için negative cache"): "bu kaynak GERÇEKTEN yok" bilgisi kısa süre
// saklanır, olmayan bir ID sürekli sorulursa sağlayıcıya her seferinde
// gidilmez.

class NotFoundError extends Error {
  constructor(message = 'Kaynak bulunamadı') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** Devre kesici AÇIK durumdayken sağlayıcı hiç çağrılmadan fırlatılır. */
class CircuitOpenError extends Error {
  constructor(providerId) {
    super(`[LazyFetch] Devre kesici AÇIK — "${providerId}" sağlayıcısına şu an istek atılmıyor.`);
    this.name = 'CircuitOpenError';
    this.providerId = providerId;
  }
}

/** Kendi token bucket kotamız tükendiğinde sağlayıcı hiç çağrılmadan fırlatılır. */
class RateLimitedError extends Error {
  constructor(providerId) {
    super(`[LazyFetch] Kendi kota sınırımız doldu — "${providerId}" sağlayıcısına şu an istek atılmıyor.`);
    this.name = 'RateLimitedError';
    this.providerId = providerId;
  }
}

module.exports = {
  NotFoundError,
  CircuitOpenError,
  RateLimitedError,
};
