// ==========================================================================
// LAZYFETCH — Sağlayıcı Çağrısı ve Yazım (L2, dosya 2/5)
// ==========================================================================
// TEK İŞİ: sağlayıcıya GİTMEK ve dönen yanıtı zarfa sarıp diske+belleğe
// (+ arşive) yazmak. Karar ağacı burada DEĞİL — o `orchestrator.js`'te.
//
// Bu dosya `orchestrator.js`'ten ayrıldı (Madde 295, 400 satır kuralı).
// Ayrılma çizgisi rastgele değil: burası "sağlayıcıya giden TEK yol"dur ve
// üç kapının (devre kesici · token bucket · `no-store`) hepsi burada.
// Dolayısıyla "sağlayıcıya ne zaman gidilir?" sorusunun cevabı TEK dosyada.

const { resolveTtl, NEGATIVE_TTL_MS, NEGATIVE_GRACE_MS } = require('./routeRegistry');
const { normalizeQuery } = require('./key');
const { createEnvelope } = require('./envelope');
const { writeCacheEntry } = require('./diskStore');
const circuitBreaker = require('./circuitBreaker');
const tokenBucket = require('./tokenBucket');
const { NotFoundError, CircuitOpenError, RateLimitedError } = require('./errors');
// 🆕 A2 — arşiv "ikinci lavabo"su. Tek yönlü bağımlılık: LazyFetch arşivi
// tanır, arşiv LazyFetch'i tanımaz. Arşiv kapalıysa `enqueue` no-op'tur,
// yani bu require bir çalışma zamanı riski taşımaz.
const { archiveQueue } = require('../archive/queue');
// 🔴 SINGLETON PAYLAŞIMI: `memoryCache` burada YARATILMAZ, `state.js`'ten
// alınır. Yaratsaydık bu dosya kendi önbelleğine yazar, `resolveRequest`
// onu hiç göremezdi — sessizce yanlış çalışan bir sistem (state.js başlığı).
const { memoryCache } = require('./state');

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
    // ⚠️ Bu, LazyFetch'in arşivi YAZMA amacıyla tanıdığı tek yer. Sağlayıcı
    // soyutlamasını bozmuyor: hangi ailenin arşivlenebilir olduğuna
    // `writer.js` karar veriyor, buradan yalnızca haber veriliyor.
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

module.exports = { fetchAndStore };
