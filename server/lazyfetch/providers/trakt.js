// ==========================================================================
// LAZYFETCH — Trakt Katalog Sağlayıcı Adaptörü (L7, dosya 2/3)
// ==========================================================================
// TEK İŞİ: orchestrator'ın beklediği `fetcher(path, query)` sözleşmesini
// Trakt'ın PUBLIC KATALOG uçları için doldurmak.
//
// 🔴🔴 EN KRİTİK KURAL: BU DOSYA `Authorization` BAŞLIĞI GÖNDERMEZ —
// gönderemez, çünkü fonksiyon onu parametre olarak bile ALMIYOR. Bu,
// unutulabilecek bir disiplin değil, YAPISAL bir imkânsızlık. Üç sebep:
//
//   1. GİZLİLİK: LazyFetch paylaşımlı bir önbellek. Kullanıcı token'ı
//      taşıyan bir istek kişiselleştirilmiş yanıt döndürebilir ve o yanıt
//      DİĞER kullanıcılara servis edilirdi. Bu, `02_ENVANTER.md`'nin
//      🔴 gizlilik sınırının ihlali olurdu.
//   2. MADDE 229'UN DERSİ: geçersiz bir `Authorization` başlığı, Trakt'ın
//      PUBLIC uçlarını bile 401'liyordu. Katalog verisi kimlikten
//      tamamen bağımsız olmalı ki misafir/Google-only kullanıcılar da
//      aynı yanıtı alabilsin.
//   3. TEKİLLİK: cache anahtarı kullanıcıyı içermez (`key.js`). Yanıt
//      kullanıcıya göre değişebilseydi anahtar yalan söylerdi.
//
// Mevcut `/api/trakt-proxy` (server.js) BUNUN TERSİNİ yapar — `req.headers
// .authorization`'ı bilerek iletir, çünkü onun işi kullanıcıya özel
// uçlardır. İki köprü BİLİNÇLİ olarak ayrıdır; birleştirilmemelidir.
//
// ⚠️ Axios global singleton üzerinden (`require('axios')`) — `server.js`'in
// ayarladığı `family:4` + `keepAlive` agent'ı (Madde 234) miras alınsın.
// `axios.create()` bu kazanımı sessizce kaybettirirdi (tmdb.js ile aynı not).

const axios = require('axios');
const { NotFoundError } = require('../errors');
const { parseSharedMaxAge } = require('./cacheControl');

const TRAKT_API_URL = 'https://api.trakt.tv';

/**
 * @param {string} clientId  `EXPO_PUBLIC_TRAKT_CLIENT_ID` — Trakt'ın PUBLIC
 *   anahtarı (client SECRET değil; o yalnızca `/api/trakt` token akışında
 *   kullanılır ve buraya hiç gelmez).
 * @returns {(path: string, query: Object) => Promise<{data: any, maxAgeSeconds?: number}>}
 */
function createTraktCatalogFetcher(clientId) {
  return async function fetchFromTraktCatalog(path, query) {
    try {
      const response = await axios.get(`${TRAKT_API_URL}${path}`, {
        params: query,
        headers: {
          'Content-Type': 'application/json',
          'trakt-api-version': '2',
          'trakt-api-key': clientId,
          // ⛔ `Authorization` BİLEREK YOK — dosya başlığındaki üç sebep.
        },
      });

      return {
        data: response.data,
        // Trakt paylaşımlı cache'lere ayrı bir TTL söylüyor (canlı ölçüm
        // 2026-08-29: `max-age=3600, s-maxage=43200`). `cacheControl.js`
        // `s-maxage`'i tercih ediyor → 1 saat yerine 12 saat.
        maxAgeSeconds: parseSharedMaxAge(response.headers['cache-control']),
      };
    } catch (error) {
      // tmdb.js ile AYNI sözleşme: 404 → `NotFoundError` (negatif cache),
      // diğer her şey olduğu gibi yukarı (grace fallback / devre kesici
      // davranışı orchestrator'ın işi, burada karar verilmez).
      if (error.response?.status === 404) {
        throw new NotFoundError(`Trakt: "${path}" bulunamadı.`);
      }
      throw error;
    }
  };
}

module.exports = {
  createTraktCatalogFetcher,
};
