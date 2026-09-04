// ==========================================================================
// LAZYFETCH — Paylaşılan Durum (L2, dosya 1/5)
// ==========================================================================
// TEK İŞİ: orchestrator ailesinin PAYLAŞTIĞI üç singleton'ı tutmak ve
// tek-uçuş kilidini sunmak.
//
// ==========================================================================
// 🔴 BÖLÜNMENİN EN RİSKLİ PARÇASI BURASI — VE BU DOSYA O RİSKİN CEVABI
// ==========================================================================
// `orchestrator.js` 446 satıra çıkınca 400 sınırı gereği bölündü
// (Madde 295). Bölmenin tek gerçek tehlikesi şuydu: `memoryCache`,
// `refreshQueue` ve `inFlight` MODÜL SEVİYESİ SINGLETON'lardı ve bu
// bilinçliydi (`memoryCache.js` / `refreshQueue.js` başlıkları: "orchestrator
// bunu modül seviyesinde BİR kez çağırır"). Parçalar bunları kendi
// içlerinde yaratsaydı, her dosya KENDİ önbelleğine yazardı:
//   • `fetchAndStore` bir zarfı yazar, `resolveRequest` onu HİÇ göremezdi
//   • tek-uçuş kilidi anlamsızlaşır, thundering herd koruması ÇÖKERDİ
//   • `refreshQueue`'nun 2-paralel tavanı iki ayrı kuyruğa bölünür,
//     yani sessizce 4 paralel olurdu
// Hiçbiri hata vermezdi — sessizce yanlış çalışırdı (M284/286).
//
// Çözüm: singleton'lar TEK bir yerde yaratılıyor ve Node'un `require`
// önbelleği onları doğal olarak paylaştırıyor — yani eski davranış
// birebir korunuyor, yalnızca artık NEREDE yaşadıkları açıkça yazılı.
// `tests/lazyfetch/cekirdek.test.js` bu paylaşımı ölçüyor.

const { createMemoryCache } = require('./memoryCache');
const { createRefreshQueue } = require('./refreshQueue');

/**
 * Modül seviyesinde TEK paylaşılan bellek katmanı — Node'un require cache'i
 * bunu doğal bir singleton yapar (memoryCache.js başlığındaki tasarım notu).
 */
const memoryCache = createMemoryCache();

/**
 * 🆕 L5 — aynı singleton deseni: tüm arka plan yenilemeleri TEK kuyruktan
 * geçer, yoksa eşzamanlılık tavanı anlamsız kalırdı.
 */
const refreshQueue = createRefreshQueue();

/**
 * Tek-uçuş kilidi durumu — yalnızca "şu an uçuşta olan istekler", TTL/LRU
 * DEĞİL. Bir anahtar burada en fazla birkaç saniye yaşar (sağlayıcı yanıt
 * verene kadar).
 */
const inFlight = new Map();

/**
 * 🔴 TEK-UÇUŞ KİLİDİ (Thundering Herd koruması, 01_MIMARI.md "3.6"):
 * Aynı anahtara aynı anda gelen N istek TEK bir sağlayıcı çağrısını
 * paylaşır. Kilit `finally` içinde silinir — hem başarı hem hata durumunda
 * bir sonraki istek yeniden deneyebilir (03_FAZLAR.md L2 doğrulaması:
 * "kilidi kazanan hata verirse kilit düşer").
 */
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

module.exports = {
  memoryCache,
  refreshQueue,
  singleFlight,
  // Yalnızca test/teşhis için — uçuştaki istek sayısı.
  inFlight,
};
