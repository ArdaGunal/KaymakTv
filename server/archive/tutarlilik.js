// ==========================================================================
// TUTARLILIK KİLİDİ — dizi özeti ↔ sezon listesi  (Parça A, 2026-10-29)
// ==========================================================================
// TEK İŞİ: Trakt'ın dizi özeti (`show_detail.aired_episodes`) arşivdeki sezon
// listesinden (`show_seasons`) DAHA FAZLA yayınlanmış bölüm biliyorsa, sezon
// listesini önbellek süresini beklemeden tazelemek.
//
// 🔬 ÖLÇÜLDÜ (2026-10-29, Pi arşivi): «Çekiç ve Gül» (Trakt 199742) 4. sezonun
// 8 bölümünü 10-23'te tek seferde yayınladı. Özet (10-25) 30 bölüm diyordu,
// sezon listesi (10-18) 22 — ve önbellek kuralı listeyi 11-17'ye kadar «taze»
// sayıyordu (son bölüm 90 günden eski → 30 gün). Kullanıcı yeni sezonu göremedi.
//
// 🔴 ÜÇ KORUMA — üçü de ölçümden çıktı (1.100 dizide ham kural 6 kez tetiklendi,
// yalnız 1'i gerçekti):
//  1. Sezon listesinde TARİHE GÖRE say (S0 hariç, `first_aired <= şimdi`).
//     Sezonların kendi `aired_episodes` alanı ÇEKİLDİĞİ GÜNÜN sayısı; liste
//     sonradan yayınlanan bölümleri zaten taşıyor olabilir (Love is Blind 141
//     alan / 147 tarih, Bleach, NCIS → yanlış alarm).
//  2. Yalnız özet sezon listesinden DAHA YENİYSE. Trakt'ın iki sayısı kendi
//     içinde 1 bölüm tutmayabiliyor (Big Brother, Das Traumschiff: liste daha
//     yeni, fark sürüyor) — bu koruma olmasa her istekte sonsuz tazeleme.
//  3. Sezon listesi en az `BEKLEME_MS` yaşında + aynı dizi son `BEKLEME_MS`
//     içinde tetiklenmemiş.
// Tazelemeden sonra liste özetten yeni olur → kural kendiliğinden kapanır.
//
// 🛡️ Tazeleme `resolveRequest` üzerinden gider (devre kesici, token kovası,
// singleFlight aynen geçerli); ağdan gelen yanıtı `fetchAndStore` arşiv
// kuyruğuna koyar, oradan anlık aktarım Supabase'e taşır.
const zlib = require('zlib');
const { getDb } = require('./db');
const { logSync } = require('./store');
const { hedefleriUret } = require('./backfillSource');
const { zamaniSinifla } = require('../radar/takvim');

const BEKLEME_MS = 6 * 60 * 60 * 1000;
const SEZON_SORGUSU = { extended: 'full,episodes' };

// kaymakId -> son tetik zamanı. Yeniden başlatmada sıfırlanması sorun değil:
// 2. koruma döngüyü zaten engelliyor, bu yalnızca aynı saatteki tekrarları keser.
const sonTetik = new Map();

function yukuCoz(body) {
  const buf = Buffer.from(body);
  try { return JSON.parse(zlib.gunzipSync(buf).toString()); } catch (_) { /* gzip değil */ }
  return JSON.parse(buf.toString());
}

/** SAF — S0 hariç, yayın tarihi geçmiş bölüm sayısı. */
function yayinlanmisBolumSayisi(sezonlar, simdi = Date.now()) {
  let n = 0;
  for (const s of sezonlar || []) {
    if (!s || !(s.number > 0)) continue;
    for (const b of s.episodes || []) {
      const t = b && b.first_aired ? Date.parse(b.first_aired) : NaN;
      if (Number.isFinite(t) && t <= simdi) n++;
    }
  }
  return n;
}

/** SAF — üç korumalı karar. */
function celiskiVarMi({ ozet, ozetAt, sezonlar, sezonlarAt, simdi = Date.now(), takvimBakimi = false, yayinDilimi = null }) {
  if (!ozet || !Array.isArray(sezonlar) || (!takvimBakimi && typeof ozet.aired_episodes !== 'number')) {
    return { celiski: false, neden: 'veri_yok' };
  }
  const ozetSayi = ozet.aired_episodes;
  const sezonSayi = yayinlanmisBolumSayisi(sezonlar, simdi);
  const sonuc = (celiski, neden) => ({ celiski, neden, ozetSayi, sezonSayi });
  const takvimNedeni = takvimBakimi ? takvimCeliskisi(ozet, sezonlar, simdi, yayinDilimi) : null;
  if (!(ozetSayi > sezonSayi) && !takvimNedeni) return sonuc(false, 'tutarli');
  if (!(Number(ozetAt) > Number(sezonlarAt))) return sonuc(false, 'ozet_daha_eski');
  if (simdi - Number(sezonlarAt) < BEKLEME_MS) return sonuc(false, 'liste_cok_yeni');
  return sonuc(true, takvimNedeni || 'ozet_buyuk');
}

function takvimCeliskisi(ozet, sezonlar, simdi, yayinDilimi) {
  const dilim = ozet.airs?.timezone ?? yayinDilimi;
  const liste = new Map(sezonlar.filter((s) => s?.number > 0).map((s) => [s.number, s]));
  const enYeni = Math.max(0, ...liste.keys());
  if (Number.isSafeInteger(ozet.number_of_seasons) && ozet.number_of_seasons > enYeni) return 'yeni_sezon';

  const sonraki = ozet.next_episode_to_air || ozet.next_episode;
  const sezon = sonraki?.season_number ?? sonraki?.season;
  const no = sonraki?.episode_number ?? sonraki?.number;
  if (sezon > 0 && !liste.has(sezon)) return 'yeni_sezon';
  if (sezon > 0 && no > 0) {
    const tarih = sonraki.air_date ?? sonraki.first_aired;
    const kayit = liste.get(sezon)?.episodes?.find((b) => b?.number === no);
    if (gelecekTarihFarki(tarih, kayit?.first_aired, simdi, dilim)) {
      return 'gelecek_tarih';
    }
  }

  for (const s of Array.isArray(ozet.seasons) ? ozet.seasons : []) {
    if (!(s?.season_number > 0)) continue;
    const kayit = liste.get(s.season_number);
    if (!kayit) return 'yeni_sezon';
    if (gelecekTarihFarki(s.air_date, null, simdi) &&
        ![kayit.first_aired, ...(kayit.episodes || []).map((b) => b?.first_aired)]
          .some((t) => !gelecekTarihFarki(s.air_date, t, simdi, dilim))) return 'gelecek_tarih';
  }
  return null;
}

function gelecekTarihFarki(tarih, onceki, simdi, yayinDilimi) {
  const yeni = zamaniSinifla(tarih, 'trakt');
  if (!yeni.tarih) return false;
  const eski = zamaniSinifla(onceki, 'trakt');
  if (yeni.an_turu === 'kesin') return Date.parse(yeni.tarih) >= simdi && yeni.tarih !== eski.tarih;
  const gun = (an) => {
    if (!yayinDilimi) return null;
    try {
      const parcalar = new Intl.DateTimeFormat('en', { timeZone: yayinDilimi, year: 'numeric',
        month: '2-digit', day: '2-digit' }).formatToParts(new Date(an));
      const p = Object.fromEntries(parcalar.map(({ type, value }) => [type, value]));
      return `${p.year}-${p.month}-${p.day}`;
    } catch (_) { return null; }
  };
  if (yeni.tarih < (gun(simdi) ?? new Date(simdi).toISOString().slice(0, 10))) return false;
  if (eski.an_turu !== 'kesin') return yeni.tarih !== eski.tarih;
  const yerel = gun(eski.tarih);
  if (yerel) return yeni.tarih !== yerel;
  // Saat dilimi bilinmiyorsa UTC gün sınırındaki bir günlük fark tek başına tetik değildir.
  return Math.abs(Date.parse(yeni.tarih) - Date.parse(eski.tarih.slice(0, 10))) > 86_400_000;
}

function takvimBakimiAcik() {
  return require('../radar/ayar').radarKapilari(process.env).yaz;
}

function traktKimligi(db, kaymakId) {
  const r = db.prepare(
    "SELECT source_id FROM external_ids WHERE kaymak_id = ? AND source = 'trakt:show' AND retired_at IS NULL"
  ).get(kaymakId);
  return r ? String(r.source_id) : null;
}

/** Tek dizinin arşivdeki iki yükünü karşılaştırır. Özet dilden bağımsız → en yenisi. */
function diziDurumu(db, kaymakId, simdi = Date.now()) {
  const takvimBakimi = takvimBakimiAcik();
  const ozetler = db.prepare(
    "SELECT body, fetched_at, provider FROM payloads WHERE kaymak_id = ? AND ((provider = 'trakt' AND endpoint = 'show_detail') OR (? = 1 AND provider = 'tmdb' AND endpoint = 'tv_detail')) ORDER BY fetched_at DESC"
  ).all(kaymakId, Number(takvimBakimi));
  const sezon = db.prepare(
    "SELECT body, fetched_at FROM payloads WHERE kaymak_id = ? AND provider = 'trakt' AND endpoint = 'show_seasons' AND lang = '-'"
  ).get(kaymakId);
  if (!ozetler.length || !sezon) return { celiski: false, neden: 'yuk_yok' };

  try {
    const sezonlar = yukuCoz(sezon.body);
    const trakt = takvimBakimi ? ozetler.find((r) => r.provider === 'trakt') : null;
    const yayinDilimi = trakt ? yukuCoz(trakt.body)?.airs?.timezone : null;
    const gorulen = new Set();
    let sonuc;
    for (const ozet of ozetler) {
      if (gorulen.has(ozet.provider)) continue;
      gorulen.add(ozet.provider);
      const r = celiskiVarMi({ ozet: yukuCoz(ozet.body), ozetAt: ozet.fetched_at, sezonlar, sezonlarAt: sezon.fetched_at, simdi, takvimBakimi, yayinDilimi });
      if (r.celiski) return r;
      sonuc ??= r;
    }
    return sonuc;
  } catch (_) { return { celiski: false, neden: 'cozulemedi' }; }
}

/** Arşivin tamamı — gece turunun BİRİNCİ önceliği (Parça E). */
function celiskiliDiziler({ simdi = Date.now() } = {}) {
  const db = getDb();
  if (!db) return [];
  const cikti = [];
  try {
    const idler = db.prepare(
      "SELECT kaymak_id FROM payloads WHERE provider = 'trakt' AND endpoint = 'show_seasons' AND lang = '-'"
    ).all();
    for (const { kaymak_id: kaymakId } of idler) {
      const d = diziDurumu(db, kaymakId, simdi);
      if (!d.celiski) continue;
      const traktId = traktKimligi(db, kaymakId);
      if (traktId) cikti.push({ kaymakId, traktId, ozetSayi: d.ozetSayi, sezonSayi: d.sezonSayi });
    }
  } catch (error) {
    console.error('[tutarlilik] tarama basarisiz:', error?.message || error);
  }
  return cikti;
}

/**
 * Gece hedefleri: `zorla` → arşivde «var» sayılıp atlanmaz; `tutarlilikBakimi` →
 * `tamamla` LazyFetch'e `BEKLEME_MS` yaş sınırı geçer (önbellek «taze» olsa da ağa gider).
 */
function celiskiHedefleri(dil, { simdi = Date.now() } = {}) {
  const hedefler = [];
  for (const d of celiskiliDiziler({ simdi })) {
    for (const h of hedefleriUret({ traktId: d.traktId, type: 'show' }, dil)) {
      if (h.endpoint === 'show_seasons') hedefler.push({ ...h, zorla: true, tutarlilikBakimi: true });
    }
  }
  return hedefler;
}

/**
 * Arşiv kuyruğunun `sonrasi` kancası: dizi özeti yazıldıktan HEMEN sonra.
 * 🔴 ASLA THROW ETMEZ ve yazımı beklemez — tazeleme bir sonraki tikte başlar.
 * @returns {null | {traktId: string, bekle: Promise}} (test/teşhis için)
 */
function yazimSonrasiKontrol(is, sonuc, { resolve = null, fetcher = null, simdi = Date.now() } = {}) {
  try {
    if (!is || !sonuc) return null;
    const trakt = is.provider === 'trakt' && is.family === 'show_detail';
    const tmdb = takvimBakimiAcik() && is.provider === 'tmdb' && is.family === 'tv_detail';
    const kaymakId = trakt ? sonuc.kaymakId : tmdb ? sonuc.arsivId : null;
    if (!kaymakId) return null;
    const db = getDb();
    if (!db) return null;
    const onceki = sonTetik.get(kaymakId);
    if (onceki && simdi - onceki < BEKLEME_MS) return null;
    const d = diziDurumu(db, kaymakId, simdi);
    if (!d.celiski) return null;
    const traktId = traktKimligi(db, kaymakId);
    if (!traktId) return null;

    const clientId = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID;
    if (!fetcher && !clientId) return null;
    sonTetik.set(kaymakId, simdi);
    logSync({
      event: 'tutarlilik', provider: 'trakt', endpoint: 'show_seasons', kaymakId,
      detail: d.neden === 'ozet_buyuk'
        ? `ozet ${d.ozetSayi} > sezon listesi ${d.sezonSayi} (trakt ${traktId}) — sezon listesi tazeleniyor`
        : `${d.neden} (trakt ${traktId}) — sezon listesi tazeleniyor`,
    });

    const cagir = resolve || require('../lazyfetch/orchestrator').resolveRequest;
    const cekici = fetcher || require('../lazyfetch/providers/trakt').createTraktCatalogFetcher(clientId);
    const bekle = new Promise((r) => setImmediate(r))
      .then(() => cagir({
        provider: 'trakt', path: `/shows/${traktId}/seasons`, query: SEZON_SORGUSU, fetcher: cekici, maxEnvelopeAgeMs: BEKLEME_MS,
      }))
      .catch((error) => {
        logSync({ event: 'error', provider: 'trakt', endpoint: 'show_seasons', kaymakId, detail: `tutarlilik tazelemesi: ${error?.message || error}` });
      });
    return { traktId, bekle };
  } catch (_) {
    return null;
  }
}

/** Yalnız test için — süreç içi bekleme defterini sıfırlar. */
function _sifirla() { sonTetik.clear(); }

module.exports = {
  BEKLEME_MS,
  yayinlanmisBolumSayisi,
  celiskiVarMi,
  diziDurumu,
  celiskiliDiziler,
  celiskiHedefleri,
  yazimSonrasiKontrol,
  _sifirla,
};
