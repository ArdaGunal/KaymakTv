// ==========================================================================
// LAZYFETCH — Anahtar Üretici (L1, dosya 2/5)
// ==========================================================================
// TEK İŞİ: bir isteği (provider + aile + method + path + query) deterministik,
// GÜVENLİ bir dosya anahtarına çevirmek.
//
// 🔴 GÜVENLİK BURADA KURULUYOR (docs/Lazy Down Plan/02_ENVANTER.md "Anahtar
// üretimi"): çıktı HER ZAMAN sabit uzunlukta bir hex özet. Kullanıcıdan gelen
// hiçbir ham veri (`:id`, `query=`) dosya yoluna DOĞRUDAN değmez — girdi ne
// olursa olsun (`../../etc/passwd` dahil) çıktı yine 64 karakterlik bir
// hash'tir. Path traversal bu yüzden matematiksel olarak imkânsız; anahtar
// üretici "temizlik" yapmaya ÇALIŞMAZ, yalnızca opaklaştırır.
//
// Bu dosya da (paths.js gibi) hiçbir API'ye bağlı değil — saf fonksiyonlar.

const crypto = require('crypto');

// Hiçbir koşulda cache anahtarına veya diske YAZILMAMASI gereken parametre
// adları (case-insensitive). `api_key` bugün istemciden gelmiyor (server.js
// bunu sunucu tarafında ekliyor, `endpoint` dışındaki her şeyi olduğu gibi
// TMDB'ye iletiyor) ama savunma amaçlı: yarın bir entegrasyon yanlışlıkla
// bir token'ı query'ye karıştırırsa, o token'ın dosya adına/loga sızmasını
// burada kesin olarak önlüyoruz.
const SECRET_PARAM_NAMES = new Set([
  'api_key', 'apikey', 'key', 'token', 'access_token', 'accesstoken',
  'authorization', 'auth', 'client_secret', 'session_token', 'session',
]);

/**
 * Query nesnesini deterministik bir stringe çevirir:
 *   1. Sır parametreleri at (SECRET_PARAM_NAMES, case-insensitive)
 *   2. Kalan anahtarları alfabetik sırala — `?a=1&b=2` ile `?b=2&a=1` AYNI
 *      anahtarı üretmeli (02_ENVANTER.md'nin "sıra bağımsızlığı" kuralı)
 *   3. Değerleri string'e sabitle (sayı/boolean/string farkı anahtarı
 *      etkilemesin)
 *
 * `undefined`/`null` değerli alanlar atlanır — "parametre hiç verilmemiş"
 * ile "boş string verilmiş" bilinçli olarak AYNI kabul edilir (TMDB/Trakt
 * tarafında pratik anlamları zaten aynı).
 */
function normalizeQuery(query) {
  if (!query || typeof query !== 'object') return '';

  const entries = Object.entries(query)
    .filter(([k, v]) => v !== undefined && v !== null && !SECRET_PARAM_NAMES.has(k.toLowerCase()))
    .map(([k, v]) => [k, String(v)])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  return entries.map(([k, v]) => `${k}=${v}`).join('&');
}

/**
 * Path'i normalize eder — yalnızca baştaki/sondaki `/` tutarlılığı için.
 * ⚠️ BİLİNÇLİ OLARAK `..` / path traversal TEMİZLİĞİ YAPILMAZ — buna gerek
 * yok, çünkü bu fonksiyonun çıktısı asla dosya yolu olarak kullanılmıyor,
 * yalnızca hash'in girdisi. `../../etc/passwd` da normal bir path gibi
 * hashlenir, sonucu yine 64 karakterlik zararsız bir hex string'tir.
 */
function normalizePath(rawPath) {
  const p = typeof rawPath === 'string' ? rawPath : '';
  const withLeadingSlash = p.startsWith('/') ? p : `/${p}`;
  return withLeadingSlash.replace(/\/+$/, '') || '/';
}

/**
 * Cache anahtarını üretir.
 *
 * @param {Object} opts
 * @param {string} opts.provider  'tmdb' | 'trakt' — aile klasörünün üst dizini
 * @param {string} opts.family    'tv_detail' | 'show_seasons' | ... (02_ENVANTER.md sınıflandırması)
 * @param {string} [opts.method]  Varsayılan 'GET' — LazyFetch bugün yalnızca GET'i cache'liyor
 * @param {string} opts.path      İstenen yol (`/tv/1396` gibi)
 * @param {Object} [opts.query]   Query parametreleri (dil dahil — DİL ANAHTARIN PARÇASI)
 * @param {number} [opts.schemaVersion] Zarf şeması sürümü — değişirse TÜM eski
 *   anahtarlar otomatik "başka bir dosya" sayılır, elle geçersiz kılmaya gerek kalmaz
 * @returns {{ hash: string, shardPrefix: string, relativePath: string }}
 *   `relativePath` = `<provider>/<family>/<shardPrefix>/<hash>.json.gz` —
 *   diskStore.js bunu `paths.js`'in cache kökiyle birleştirip gerçek dosya
 *   yolunu kurar. Bu fonksiyon KENDİSİ hiç dosya sistemine dokunmaz.
 */
function buildCacheKey({ provider, family, method = 'GET', path: reqPath, query, schemaVersion = 1 }) {
  if (!provider || typeof provider !== 'string') {
    throw new Error('[LazyFetch] buildCacheKey: "provider" zorunlu.');
  }
  if (!family || typeof family !== 'string') {
    throw new Error('[LazyFetch] buildCacheKey: "family" zorunlu.');
  }

  const canonical = [
    `v${schemaVersion}`,
    provider,
    family,
    String(method).toUpperCase(),
    normalizePath(reqPath),
    normalizeQuery(query),
  ].join('|');

  const hash = crypto.createHash('sha256').update(canonical).digest('hex');
  // İlk 2 hex karakter = 256 kova (02_ENVANTER.md "Inode Koruma") — ext4
  // dizin indeksi büyük dosya sayısında rahatlar.
  const shardPrefix = hash.slice(0, 2);

  return {
    hash,
    shardPrefix,
    relativePath: `${provider}/${family}/${shardPrefix}/${hash}.json.gz`,
  };
}

module.exports = {
  buildCacheKey,
  // Yalnızca test/denetim için dışa veriliyor — diskStore.js bunları
  // doğrudan kullanmaz, `buildCacheKey` üzerinden dolaylı çağrılır.
  normalizeQuery,
  normalizePath,
};
