// ==========================================================================
// EKSİKTE ÇEKME — Worker "bu yapım katalogda yok" deyince  (§C30)
// ==========================================================================
// TEK İŞİ: tek bir yapımı (dizi/film, istenirse belirli sezon/bölümleriyle)
// Supabase kataloğuna HEMEN getirmek, sonucu söylemek.
//
//   1) Arşivde YETERLİ veri var mı?  → evet: anında aktar, bitti.
//   2) Yoksa LazyFetch ile TAZE çek (istemcinin kullandığı AYNI yol ve
//      sorgular → aynı önbellek kaydı), arşive yazılmasını BEKLE, aktar.
//
// 🔴 NEDEN ANLIK AKTARIM TEK BAŞINA YETMİYOR (M411, ölçüldü):
//   • Aktarım yalnızca TAZE çekimde tetiklenir; sezon önbelleği 7 gün
//     (yayında) / 30 gün yaşar → bilinen dizinin YENİ bölümünde tetiklenmez.
//   • Sıradaki/Takvim'den işaretlemede yapım sayfası HİÇ açılmaz.
//   • İstemci Pi'ye ulaşamazsa doğrudan Trakt'a düşer → arşiv hiç görmez.
//
// 🛡️ TRAKT'I KORUYAN KAPILAR: çekim `resolveRequest` üzerinden gider → devre
// kesici, token kovası, singleFlight (aynı yola eşzamanlı iki istek TEK
// Trakt çağrısı) aynen geçerli. Önbellek yalnızca `ZORLA_YAS_MS`'den
// ESKİYSE atlanır — daha tazesi zaten arşive yazılmıştır.
//
// ⛔ Bu, 2026-09-06'daki «anlık LazyFetch YOK» kararının DARALTILMIŞ hâli
// (kullanıcı, M411): TOPLU içe aktarım gece vardiyasında kalır; burası
// yalnızca TEK kullanıcı eyleminin TEK yapımı.

const { getDb } = require('./db');
const { archiveQueue } = require('./queue');
const { anlikAktarim } = require('./anlikAktarim');
const { resolveRequest } = require('../lazyfetch/orchestrator');
const { createTraktCatalogFetcher } = require('../lazyfetch/providers/trakt');

/** Bundan genç önbellek zarfı ZORLA tazelenmez (yeni bilgi olmaz). */
const ZORLA_YAS_MS = 5 * 60 * 1000;
/** Arşiv yazımını bekleme tavanı — kuyruk tıkanırsa istek askıda kalmasın. */
const YAZIM_BEKLEME_MS = 4000;
/** Varsayılan çeviri dili — istemcinin en sık kullandığı anahtar. */
const DIL = 'tr';

const TAMSAYI = (n) => Number.isInteger(n) && n >= 0 && n <= 1e12;

/**
 * SAF — istek gövdesini doğrular.
 * @returns {{tur: 'show'|'movie', traktId: number, sezon: number|null, bolumler: number[]} | {hata: string}}
 */
function istegiDogrula(g) {
  if (!g || typeof g !== 'object') return { hata: 'govde' };
  if (g.tur !== 'show' && g.tur !== 'movie') return { hata: 'tur' };
  if (!TAMSAYI(g.traktId) || g.traktId === 0) return { hata: 'traktId' };
  let sezon = null;
  let bolumler = [];
  if (g.tur === 'show' && g.sezon !== undefined && g.sezon !== null) {
    if (!TAMSAYI(g.sezon) || g.sezon > 1000) return { hata: 'sezon' };
    sezon = g.sezon;
    if (g.bolumler !== undefined) {
      if (!Array.isArray(g.bolumler) || g.bolumler.length > 100
        || !g.bolumler.every((b) => TAMSAYI(b) && b <= 10000)) return { hata: 'bolumler' };
      bolumler = [...new Set(g.bolumler)];
    }
  }
  return { tur: g.tur, traktId: g.traktId, sezon, bolumler };
}

/**
 * Arşivde yeterli mi? `{kok, yeterli}` — kök yoksa `kok: null`.
 * Dizi için sezon/bölüm istenmişse onların da arşivde olması şart.
 */
function arsivDurumu(db, { tur, traktId, sezon, bolumler }) {
  const x = db.prepare(
    'SELECT kaymak_id FROM external_ids WHERE source = ? AND source_id = ? AND retired_at IS NULL'
  ).get(`trakt:${tur}`, String(traktId));
  if (!x) return { kok: null, yeterli: false };
  if (tur === 'movie' || sezon === null) return { kok: x.kaymak_id, yeterli: true };

  const s = db.prepare(
    "SELECT kaymak_id FROM entities WHERE parent_id = ? AND type = 'season' AND season_number = ?"
  ).get(x.kaymak_id, sezon);
  if (!s) return { kok: x.kaymak_id, yeterli: false };
  if (bolumler.length === 0) {
    const say = db.prepare("SELECT count(*) c FROM entities WHERE parent_id = ? AND type = 'episode'").get(s.kaymak_id).c;
    return { kok: x.kaymak_id, yeterli: say > 0 };
  }
  const var_ = new Set(db.prepare(
    "SELECT episode_number n FROM entities WHERE parent_id = ? AND type = 'episode'"
  ).all(s.kaymak_id).map((r) => r.n));
  return { kok: x.kaymak_id, yeterli: bolumler.every((b) => var_.has(b)) };
}

/** İstemcinin `services/api/{shows,movies}.ts` çağrılarıyla AYNI yol+sorgu. */
function cekilecekler({ tur, traktId }) {
  if (tur === 'movie') {
    return [{ path: `/movies/${traktId}`, query: { extended: 'full', translations: DIL } }];
  }
  return [
    { path: `/shows/${traktId}`, query: { extended: 'full', translations: DIL } },
    { path: `/shows/${traktId}/seasons`, query: { extended: 'full,episodes' } },
  ];
}

const zamanAsimi = (ms) => new Promise((r) => { const t = setTimeout(r, ms); if (t.unref) t.unref(); });

/**
 * @returns {Promise<{ok: boolean, durum: string, ms: number}>}
 *   durum: `arsivden_aktarildi` · `cekildi_aktarildi` · `traktta_yok` ·
 *   `cekildi_eksik` (Trakt'ta da o bölüm yok) · `saglayici_hatasi` ·
 *   `aktarim_hatasi` · `arsiv_kapali`
 */
async function eksikteCek(istek, { clientId = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID, fetcher = null } = {}) {
  const t0 = Date.now();
  // Adım süreleri (ms) — "neden yavaş" sorusu tahminle değil bununla cevaplanır.
  const adim = { cekim: 0, yazim: 0, aktarim: 0 };
  const bitir = (ok, durum, ek = {}) => ({ ok, durum, ms: Date.now() - t0, adim, ...ek });
  const olc = async (ad, is) => { const t = Date.now(); try { return await is(); } finally { adim[ad] += Date.now() - t; } };
  const db = getDb();
  if (!db) return bitir(false, 'arsiv_kapali');

  // 1) Arşivde zaten var mı?
  let d = arsivDurumu(db, istek);
  if (d.kok && d.yeterli) {
    const a = await olc('aktarim', () => anlikAktarim.hemen(d.kok));
    return a.ok ? bitir(true, 'arsivden_aktarildi') : bitir(false, 'aktarim_hatasi', { neden: a.reason });
  }

  // 2) Taze çek → arşive yazılmasını bekle
  // `fetcher` yalnızca testte verilir (ağ yok); canlıda Trakt katalog adaptörü.
  if (!fetcher && !clientId) return bitir(false, 'saglayici_hatasi', { neden: 'client_id_yok' });
  const cekici = fetcher || createTraktCatalogFetcher(clientId);
  let bulunamadi = false;
  try {
    for (const { path, query } of cekilecekler(istek)) {
      const r = await olc('cekim', () => resolveRequest({ provider: 'trakt', path, query, fetcher: cekici, maxEnvelopeAgeMs: ZORLA_YAS_MS }));
      if (r.status === 'not-found' || r.data === null) { bulunamadi = true; break; }
      // Sağlayıcı düştü, eski zarf/arşiv döndü → yeni yazım YOK. Bunu
      // «Trakt'ta yok» diye raporlamak yanlış teşhis olurdu.
      if (r.status === 'grace-fallback' || r.status === 'archive-fallback') {
        return bitir(false, 'saglayici_hatasi', { neden: r.status });
      }
      await olc('yazim', () => Promise.race([
        archiveQueue.bekle({ provider: 'trakt', family: path.endsWith('/seasons') ? 'show_seasons' : (istek.tur === 'movie' ? 'movie_detail' : 'show_detail'), path, query }),
        zamanAsimi(YAZIM_BEKLEME_MS),
      ]));
    }
  } catch (error) {
    return bitir(false, 'saglayici_hatasi', { neden: String(error?.message || error).slice(0, 120) });
  }
  if (bulunamadi) return bitir(false, 'traktta_yok');

  // 3) Yeniden bak, aktar
  d = arsivDurumu(db, istek);
  if (!d.kok) return bitir(false, 'traktta_yok');
  const a = await olc('aktarim', () => anlikAktarim.hemen(d.kok));
  if (!a.ok) return bitir(false, 'aktarim_hatasi', { neden: a.reason });
  // Kök aktarıldı ama istenen bölüm Trakt'ta da yok (henüz yayınlanmamış vb.)
  return d.yeterli ? bitir(true, 'cekildi_aktarildi') : bitir(false, 'cekildi_eksik');
}

module.exports = { eksikteCek, istegiDogrula, arsivDurumu, cekilecekler, ZORLA_YAS_MS };
