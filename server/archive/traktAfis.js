// ==========================================================================
// KATALOG ARŞİVİ — Trakt afiş yedeği  (K1(b) · M532)
// ==========================================================================
// TEK İŞİ: TMDB kimliğinden, arşivdeki Trakt detay yanıtının `images.poster`
// adresini bulmak. Ağa ÇIKMAZ, yazmaz — yalnız arşivden okur.
//
// NEDEN: TMDB afiş yolu alınamadığında (TMDB'de yok, 503, kesinti) istemci boş
// yer tutucu gösteriyordu. Oysa arşivlenen Trakt `extended=full` detay
// yanıtlarının 2.277 / 2.284'ü zaten bir afiş adresi taşıyor (canlı ölçüm
// 2026-10-18, M530) ve kullanılmıyordu. Kullanıcı + danışman kararı: görsel
// baytı Pi'ye inmez; adres Trakt'ın kendi CDN'ini gösterir (yeniden dağıtım yok).
//
// 🔒 Dönen adres YALNIZ Trakt'ın görsel sunucularından olabilir — arşivdeki
// veri dış kaynaklıdır; başka bir alan adına giden adres istemciye verilmez.

const { findByExternal } = require('./identity');
const { readPayload, DILSIZ } = require('./store');

const IZINLI_SUNUCU = /^(media|walter[a-z0-9-]*)\.trakt\.tv\/[A-Za-z0-9/_.\-]+$/;
const DILLER = ['tr', 'en', DILSIZ];

/** `images.poster[0]` → `https://…`; geçersiz/yabancı sunucu → null. */
function afisAdresi(images) {
  const ham = images && Array.isArray(images.poster) ? images.poster[0] : null;
  if (typeof ham !== 'string') return null;
  const temiz = ham.replace(/^https?:\/\//, '');
  return IZINLI_SUNUCU.test(temiz) ? `https://${temiz}` : null;
}

/**
 * @param {'show'|'movie'} tur
 * @param {string|number} tmdbId
 * @returns {Promise<string|null>} Throw etmez.
 */
async function traktAfisYedegi(tur, tmdbId) {
  if ((tur !== 'show' && tur !== 'movie') || !/^\d+$/.test(String(tmdbId))) return null;
  try {
    const kaymakId = findByExternal(`tmdb:${tur}`, String(tmdbId));
    if (!kaymakId) return null;
    const endpoint = tur === 'show' ? 'show_detail' : 'movie_detail';
    for (const lang of DILLER) {
      const yuk = await readPayload({ kaymakId, provider: 'trakt', endpoint, lang });
      const url = yuk.ok ? afisAdresi(yuk.data && yuk.data.images) : null;
      if (url) return url;
    }
    return null;
  } catch (_) {
    return null;
  }
}

module.exports = { traktAfisYedegi, afisAdresi };
