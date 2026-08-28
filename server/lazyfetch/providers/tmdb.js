// ==========================================================================
// LAZYFETCH — TMDB Sağlayıcı Adaptörü (L3, dosya 1/2)
// ==========================================================================
// TEK İŞİ: orchestrator.js'in beklediği `fetcher(path, query) =>
// Promise<{data, maxAgeSeconds}>` sözleşmesini TMDB'ye özel doldurmak.
// Bu dosya "Sağlayıcı Adaptörü" (docs/Lazy Down Plan/01_MIMARI.md tablosu)
// — TMDB'yi BİLEN tek yer. orchestrator.js/routeRegistry.js TMDB'nin var
// olduğunu bile bilmez; yarın Trakt (L7) veya arşiv (A4) eklendiğinde bu
// dosyanın bir kardeşi (`providers/trakt.js`) yazılır, orchestrator
// DEĞİŞMEZ — bağımsızlık anahtarının tam olarak burada çevrileceği yer.
//
// 🔴 İSTEK ŞEKLİ `server.js`'in ESKİ TMDB handler'ıyla BİREBİR AYNI —
// istemci tarafında hiçbir davranış farkı yaratmamak için URL, params,
// header'lar bilerek KORUNDU. Tek fark: yanıtın `Cache-Control` header'ı
// artık okunuyor (eskiden atılıyordu).
//
// 🆕 `max-age` PARSE EDİLİYOR (canlı ölçüldü, 2026-08-28: TMDB her yanıtta
// `Cache-Control: public, max-age=N` dönüyor, N sabit değil — `/tv/1396`
// için 3760, `/tv/1396/credits` için 10870). Header yoksa/parse edilemezse
// `maxAgeSeconds: undefined` döner — orchestrator bu durumda
// `routeRegistry.resolveTtl()`'in varsayılanına düşer, hata FIRLATILMAZ.
//
// 🆕 L7: parser `providers/cacheControl.js`'e taşındı (Trakt adaptörü de
// aynısını istiyordu). TMDB `s-maxage` DÖNDÜRMÜYOR (canlı doğrulandı),
// dolayısıyla bu taşıma TMDB davranışını hiç değiştirmiyor.
//
// ⚠️ Axios global singleton üzerinden çağrılıyor (`require('axios')`,
// `axios.create()` DEĞİL) — `server.js`'in en başında ayarladığı
// `axios.defaults.httpsAgent` (Madde 234: `family:4` + `keepAlive`, DNS
// gecikmesi düzeltmesi) Node'un modül cache'i sayesinde OTOMATİK miras
// alınır. Ayrı bir instance açmak bu kazanımı sessizce kaybettirirdi.

const axios = require('axios');
const { NotFoundError } = require('../errors');
const { parseSharedMaxAge } = require('./cacheControl');

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

/**
 * orchestrator.js'in `fetcher` sözleşmesini dolduran fabrika — `apiKey`'i
 * (server.js `process.env.TMDB_API_KEY`'den okuyup buraya geçirir) closure
 * içine kapatır, orchestrator'a yalnızca `(path, query) => Promise<...>`
 * imzalı saf bir fonksiyon gider.
 *
 * @param {string} apiKey
 * @returns {(path: string, query: Object) => Promise<{data: any, maxAgeSeconds?: number}>}
 */
function createTmdbFetcher(apiKey) {
  return async function fetchFromTmdb(path, query) {
    try {
      const response = await axios.get(`${TMDB_BASE_URL}${path}`, {
        params: {
          ...query,
          api_key: apiKey,
        },
        headers: { 'Content-Type': 'application/json' },
      });

      return {
        data: response.data,
        maxAgeSeconds: parseSharedMaxAge(response.headers['cache-control']),
      };
    } catch (error) {
      // 🆕 (L4, negatif cache): "kaynak gerçekten yok" (404) GENEL bir
      // hataya çevrilir — orchestrator.js HTTP durum kodu bilmez, yalnızca
      // `NotFoundError`'ı tanır (bkz. errors.js başlığı, sağlayıcı
      // soyutlaması). Diğer TÜM hatalar (429/5xx/timeout/DNS) OLDUĞU GİBİ
      // yeniden fırlatılır — orchestrator'ın grace fallback davranışı
      // bunlarda hiç değişmedi.
      if (error.response?.status === 404) {
        throw new NotFoundError(`TMDB: "${path}" bulunamadı.`);
      }
      throw error;
    }
  };
}

module.exports = {
  createTmdbFetcher,
};
