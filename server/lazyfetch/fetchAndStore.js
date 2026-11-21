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

const { resolveRoute, resolveTtl, NEGATIVE_TTL_MS, NEGATIVE_GRACE_MS } = require('./routeRegistry');

/** `/shows/:id/seasons` → arşivdeki `entities.status` (id sayı ya da slug). Asla throw etmez. */
function arsivDiziDurumu(yol) {
  try {
    const m = /^\/shows\/([^/]+)\/seasons$/.exec(yol || '');
    if (!m) return null;
    const db = require('../archive/db').getDb();
    if (!db) return null;
    const r = db.prepare(
      `SELECT e.status FROM external_ids x JOIN entities e ON e.kaymak_id = x.kaymak_id
        WHERE x.source IN ('trakt:show', 'trakt:slug') AND x.source_id = ? AND x.retired_at IS NULL LIMIT 1`
    ).get(m[1]);
    return r ? r.status : null;
  } catch (_) {
    return null;
  }
}
const { buildCacheKey, normalizeQuery } = require('./key');
const { createEnvelope } = require('./envelope');
const { writeCacheEntry } = require('./diskStore');
const circuitBreaker = require('./circuitBreaker');
const tokenBucket = require('./tokenBucket');
const { NotFoundError, CircuitOpenError, RateLimitedError } = require('./errors');
// 🆕 A2 — arşiv "ikinci lavabo"su. Tek yönlü bağımlılık: LazyFetch arşivi
// tanır, arşiv LazyFetch'i tanımaz. Arşiv kapalıysa `enqueue` no-op'tur,
// yani bu require bir çalışma zamanı riski taşımaz.
const { archiveQueue } = require('../archive/queue');
const { kanonikMi, kapiKaydet } = require('../archive/kanonik');
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
  let yanitAlindi = false;
  try {
    const result = await saglayicidanCek({ provider, path, query, fetcher });
    yanitAlindi = true;
    const envelope = yanitZarfi({ provider, family, path, query, yanit: result });

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
    // 🆕 Paket C (M550): YALNIZ KANONİK sorgu kuyruğa girer (`archive/kanonik.js`). Varyant hem
    // arşiv yuvasını ezmesin hem de kuyrukta bekleyen DOĞRU yazımın yerini almasın — kuyruk anahtarı
    // yalnız dili ayırıyor, varyant onu `bekleyenler.set` ile değiştiriyordu (dış denetim K-1).
    // 🆕 M551: karar SAYILIR (`/api/health` → `arsiv.kanonikKapi`) — ret sessiz kalmasın (Madde 286).
    const kanonik = kanonikMi(provider, family, query);
    kapiKaydet(provider, family, query, kanonik);
    if (kanonik) {
      archiveQueue.enqueue({
        provider, family, path, query,
        data: result.data,
        fetchedAt: envelope.fetchedAt,
      });
    }

    return envelope;
  } catch (error) {
    if (error instanceof NotFoundError) {
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
    if (yanitAlindi) circuitBreaker.recordFailure(provider);
    throw error;
  }
}

/** LazyFetch ve Radar için ortak sağlayıcı bütçesi ve devre kesici. */
async function saglayicidanCek({ provider, path, query, fetcher }) {
  if (!circuitBreaker.canRequest(provider)) throw new CircuitOpenError(provider);
  if (!tokenBucket.tryConsume(provider)) throw new RateLimitedError(provider);
  try {
    const result = await fetcher(path, query);
    circuitBreaker.recordSuccess(provider);
    return result;
  } catch (error) {
    if (error instanceof NotFoundError) circuitBreaker.recordSuccess(provider);
    else circuitBreaker.recordFailure(provider);
    throw error;
  }
}

function yanitZarfi({ provider, family, path, query, yanit, fetchedAt }) {
  const durum = family === 'show_seasons' ? arsivDiziDurumu(path) : null;
  const { ttlMs, graceMs } = resolveTtl(yanit.maxAgeSeconds, { family, data: yanit.data, durum });
  return createEnvelope({
    provider, family, payload: yanit.data, ttlMs, graceMs, now: fetchedAt,
    requestPath: path, requestQuery: normalizeQuery(query),
  });
}

/** Radar ağı TTL'den bağımsız çağırır, arşiv onayına kadar önbelleğe dokunmaz. */
function tazeYanitHazirla({ provider, path, query, yanit, fetchedAt }) {
  const { cacheable, family } = resolveRoute(provider, path);
  const is = { provider, family, path, query, data: yanit.data, fetchedAt };
  if (!cacheable || yanit.storable === false) return { is, yayinla: null };
  const { relativePath } = buildCacheKey({ provider, family, path, query });
  const envelope = yanitZarfi({ provider, family, path, query, yanit, fetchedAt });
  return {
    is,
    yayinla: async () => {
      if (memoryCache.get(relativePath)?.fetchedAt > fetchedAt) return;
      const sonuc = await writeCacheEntry(relativePath, envelope);
      if (!sonuc.ok && sonuc.reason !== 'disabled') {
        if (!(memoryCache.get(relativePath)?.fetchedAt > fetchedAt)) memoryCache.delete(relativePath);
        throw new (require('../radar/ayar').RadarHatasi)('onbellek_yazimi');
      }
      if (!(memoryCache.get(relativePath)?.fetchedAt > fetchedAt)) memoryCache.set(relativePath, envelope);
    },
  };
}

module.exports = { fetchAndStore, arsivDiziDurumu, saglayicidanCek, tazeYanitHazirla };
