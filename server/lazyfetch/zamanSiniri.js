// ==========================================================================
// DIŞ ÇAĞRI SÜRE SINIRLARI — Paket B (M548) · dış denetim K-2, 2026-10-20 teyidi
// ==========================================================================
// SORUN (yeniden üretildi, R9): sağlayıcı adaptörlerinde `timeout` YOKTU (axios varsayılanı 0 =
// sınırsız). Yavaş/ölü bir bağlantıda:
//   • tek-uçuş sözü asılı kalır → aynı anahtara gelen her istek onu bekler (diskte eski zarf olsa bile),
//   • iki SWR yuvası asılı kalır → arka plan tazelemesi durur,
//   • HALF_OPEN sondası asılı kalır → devre kesici o sağlayıcıya giden TÜM ıskaları kilitler.
//
// İKİ AYRI SINIR — biri tek başına yetmez:
//   • BOŞTA (axios `timeout` = soket hareketsizlik süresi): ölü / yanıtsız bağlantı hızla kesilir;
//     yavaş AMA veri akan büyük bir yanıt (6,2 MB'lık sezon listesi) kesilmez.
//   • TOPLAM (`AbortSignal.timeout`): damla damla veri akıtan bir bağlantı da sonsuza dek sürmez.
// Zaman aşımı sıradan bir hatadır: `fetchAndStore` devre kesiciye BAŞARISIZLIK yazar, orkestratör
// grace → arşiv merdiveninden iner.
const SAGLAYICI_BOSTA_MS = 10_000;
const SAGLAYICI_TOPLAM_MS = 45_000;

/** Katalog sağlayıcı çağrısı (TMDB / Trakt katalog) için axios seçenekleri. */
function saglayiciSecenekleri() {
  return { timeout: SAGLAYICI_BOSTA_MS, signal: AbortSignal.timeout(SAGLAYICI_TOPLAM_MS) };
}

/** Kullanıcıya özel Trakt köprüleri (server.js) — aynı mantık, biraz daha geniş pay. */
const KOPRU_BOSTA_MS = 15_000;
const KOPRU_TOPLAM_MS = 60_000;
function kopruSecenekleri() {
  return { timeout: KOPRU_BOSTA_MS, signal: AbortSignal.timeout(KOPRU_TOPLAM_MS) };
}

module.exports = {
  saglayiciSecenekleri,
  kopruSecenekleri,
  SAGLAYICI_BOSTA_MS,
  SAGLAYICI_TOPLAM_MS,
  KOPRU_BOSTA_MS,
  KOPRU_TOPLAM_MS,
};
