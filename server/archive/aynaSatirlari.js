// ==========================================================================
// KATALOG AYNASI — SATIR KURUCU (ortak) · §C30
// ==========================================================================
// TEK İŞİ: arşivdeki varlıkları Worker'ın `/catalog/sync` ucunun beklediği
// satırlara çevirmek. İKİ çağıranı var:
//   • `mirror.js`      — gece aynası, TÜM arşiv (`kapsam = null`)
//   • `anlikAktarim.js` — §C30 anlık aktarım, yalnızca verilen KÖK(ler)in
//                          alt ağacı (dizi → sezonlar → bölümler)
//
// 🔴 NEDEN TEK DOSYA: iki yol satırı AYRI kursaydı er ya da geç ıraksardı.
// Partideki nesnelerin anahtar kümeleri farklılaşınca PostgREST partinin
// TAMAMINI `PGRST102` ile reddediyor (canlıda görüldü, §C18). Satırın biçimi
// yalnızca burada tanımlı: `varlikSatiri` ve `disKimlikSatiri`.
//
// 📏 Davranış `tests/arsiv/ayna.test.js` ile SABİTLENDİ — bu dosya
// `mirror.js`'ten taşınmadan ÖNCE yazılmış karakterizasyon testi.
//
// ⚠️ ZENGİNLEŞTİRME ÇIKARILIR, KOPYALANMAZ: arşivin `entities` tablosunda
// `runtime`/`genres`/`first_aired` kolonu YOK; veri gzip'li payload'ların
// içinde. `tmdb_id` ise `external_ids`'ten (M311: 15 MB'lık ters indeksin
// yerine geçen kolon).

const zlib = require('node:zlib');

/** Aynalanan kaynaklar — `036`'daki CHECK ile AYNI olmak ZORUNDA. */
const AYNALANAN_KAYNAKLAR = [
  'trakt:show', 'trakt:movie', 'trakt:season', 'trakt:episode', 'trakt:slug',
];

/** Ebeveyn önce: FK'nin dayattığı sıra. */
const TIP_SIRASI = [['show', 'movie'], ['season'], ['episode']];

const ac = (body) => {
  try { return JSON.parse(zlib.gunzipSync(body).toString('utf8')); } catch (_) { return null; }
};

/**
 * Trakt tarihleri zaten ISO-8601 UTC. Ayrıştırılabilirliği DOĞRULUYORUZ:
 * bozuk bir dize Postgres tarafında tüm partiyi reddettirirdi (400).
 */
function gecerliTarih(d) {
  if (typeof d !== 'string' || d.length < 4) return null;
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/**
 * Worker (`catalogSync.js` → `temizGenres`) ve `047`'nin CHECK'i son
 * savunma hatları; burası ilk hat. Üçü de aynı tavanları uyguluyor.
 */
function temizGenres(g) {
  if (!Array.isArray(g)) return null;
  const temiz = [];
  for (const t of g) {
    if (typeof t !== 'string') continue;
    const s = t.trim().slice(0, 40);
    if (s && !temiz.includes(s)) temiz.push(s);
    if (temiz.length >= 30) break;
  }
  return temiz.length > 0 ? temiz : null;
}

// ── Kapsam ────────────────────────────────────────────────────────────────
// `kapsam` null → tüm arşiv. Dizi → verilen köklerin alt ağacı. Kimlik
// listesi SQL'e `json_each` ile TEK parametre olarak gider (yer tutucu
// sayısı kök sayısıyla büyümesin).

const ALT_AGAC_SQL = `
  SELECT kaymak_id FROM entities WHERE kaymak_id IN (SELECT value FROM json_each(?))
  UNION SELECT kaymak_id FROM entities WHERE parent_id IN (SELECT value FROM json_each(?))
  UNION SELECT kaymak_id FROM entities WHERE parent_id IN (
    SELECT kaymak_id FROM entities WHERE parent_id IN (SELECT value FROM json_each(?)))`;

/** Köklerin alt ağacındaki TÜM kaymak_id'ler (kökler dahil). */
function altAgacKimlikleri(db, kokler) {
  const j = JSON.stringify(kokler);
  return db.prepare(ALT_AGAC_SQL).all(j, j, j).map((r) => r.kaymak_id);
}

/** Kapsama göre `AND kaymak_id IN (...)` eki ve parametresi. */
function kapsamEki(kimlikler) {
  return kimlikler ? { sql: ' AND kaymak_id IN (SELECT value FROM json_each(?))', p: [JSON.stringify(kimlikler)] }
    : { sql: '', p: [] };
}

// ── Zenginleştirme haritaları ────────────────────────────────────────────

/**
 * `{runtime, tmdb, genres, firstAired}` — dördü de `kaymak_id → değer`.
 *
 * @param {Object} db
 * @param {{kokler: string[], altAgac: string[]} | null} kapsam
 */
function haritalariKur(db, kapsam = null) {
  const runtime = new Map();
  const genres = new Map();
  const firstAired = new Map();
  const tmdb = new Map();

  const kok = kapsamEki(kapsam && kapsam.kokler);
  const alt = kapsamEki(kapsam && kapsam.altAgac);
  // 📏 ÖLÇÜLDÜ (Pi, 2026-09-19): `source = ? AND kaymak_id IN (json_each)`
  // planlayıcıyı `(source, source_id)` PK'sine yönlendiriyor → 55 bin
  // `trakt:episode` satırı taranıyor (~250 ms/çağrı). Kapsamlı sorguda
  // `+source` ile o indeks devre dışı, `idx_external_kaymak` kullanılıyor.
  const kaynak = kapsam ? '+source' : 'source';

  // Dizi/film KÖKÜ: runtime · genres · first_aired (film: released)
  for (const r of db.prepare(
    "SELECT kaymak_id, body FROM payloads WHERE endpoint IN ('show_detail','movie_detail')" + kok.sql
  ).iterate(...kok.p)) {
    const j = ac(r.body);
    const k = Array.isArray(j) ? j[0] : j;
    if (!k) continue;
    if (Number.isFinite(k.runtime)) runtime.set(r.kaymak_id, k.runtime);
    const g = temizGenres(k.genres);
    if (g) genres.set(r.kaymak_id, g);
    const d = gecerliTarih(k.first_aired || k.released);
    if (d) firstAired.set(r.kaymak_id, d);
  }

  // Bölümler: `show_seasons` içinde yalnızca TRAKT id'si var → trakt id →
  // değer, sonra `external_ids` üzerinden kaymak_id'ye.
  const traktRuntime = new Map();
  const traktTarih = new Map();
  for (const r of db.prepare(
    "SELECT body FROM payloads WHERE endpoint = 'show_seasons'" + kok.sql
  ).iterate(...kok.p)) {
    const j = ac(r.body);
    if (!j) continue;
    for (const sezon of (Array.isArray(j) ? j : [j])) {
      for (const b of (sezon?.episodes || [])) {
        const tid = b?.ids?.trakt;
        if (tid == null) continue;
        if (Number.isFinite(b.runtime)) traktRuntime.set(String(tid), b.runtime);
        const d = gecerliTarih(b?.first_aired);
        if (d) traktTarih.set(String(tid), d);
      }
    }
  }
  if (traktRuntime.size > 0 || traktTarih.size > 0) {
    // 🪦 Emekli kimlik türetmez (v2): sağlayıcının sildiği bölüm kimliğinden
    // değer iliştirmek bayat veriyi canlı tutardı.
    for (const r of db.prepare(
      `SELECT source_id, kaymak_id FROM external_ids WHERE ${kaynak} = 'trakt:episode' AND retired_at IS NULL` + alt.sql
    ).iterate(...alt.p)) {
      const rt = traktRuntime.get(String(r.source_id));
      if (rt !== undefined) runtime.set(r.kaymak_id, rt);
      const d = traktTarih.get(String(r.source_id));
      if (d !== undefined) firstAired.set(r.kaymak_id, d);
    }
  }

  // 🪦 Emekli kimlik elenir — aksi hâlde aynı kayda bağlı İKİ tmdb kimliği
  // olur ve değer satır sırasına göre BELİRSİZ olur.
  for (const r of db.prepare(
    `SELECT source_id, kaymak_id FROM external_ids WHERE ${kaynak} IN ('tmdb:show','tmdb:movie','tmdb:episode') AND retired_at IS NULL` + alt.sql
  ).iterate(...alt.p)) {
    const n = Number(r.source_id);
    if (Number.isInteger(n)) tmdb.set(r.kaymak_id, n);
  }

  return { runtime, tmdb, genres, firstAired };
}

// ── Satırlar ──────────────────────────────────────────────────────────────

/** `entities` satırı → Worker satırı. Biçimin TEK tanımı. */
function varlikSatiri(e, h) {
  return {
    kaymak_id: e.kaymak_id,
    type: e.type,
    parent_id: e.parent_id,
    season_number: e.season_number,
    episode_number: e.episode_number,
    title: e.title,
    year: e.year,
    // 🔴 `?? null` ŞART. `undefined` kalırsa `JSON.stringify` anahtarı
    // DÜŞÜRÜR → partide farklı anahtar kümeleri → `PGRST102` (§C18).
    runtime: h.runtime.get(e.kaymak_id) ?? null,
    tmdb_id: h.tmdb.get(e.kaymak_id) ?? null,
    genres: h.genres.get(e.kaymak_id) ?? null,
    // ⚠️ NULL = "bilinmiyor", "yayınlanmadı" DEĞİL (bkz. 039).
    first_aired: h.firstAired.get(e.kaymak_id) ?? null,
  };
}

/**
 * 🪦 `retired_at` DE İTİLİYOR (§C20): emeklilik Supabase'e ancak böyle
 * ulaşır. Pi'de SİLSEYDİK iki kaynak sessizce ayrışırdı.
 */
function disKimlikSatiri(x) {
  return { source: x.source, source_id: x.source_id, kaymak_id: x.kaymak_id, retired_at: x.retired_at ?? null };
}

/**
 * Köklerin alt ağacı için gönderime hazır fazlar — `mirror.js`'in turuyla
 * AYNI sıra (show/movie → season → episode → external_ids).
 *
 * @param {Object} db
 * @param {string[]} kokler dizi/film kaymak_id'leri
 * @returns {{faz: string, satirlar: Object[]}[]} boş fazlar ATLANIR
 */
function altAgacFazlari(db, kokler) {
  if (!Array.isArray(kokler) || kokler.length === 0) return [];
  const altAgac = altAgacKimlikleri(db, kokler);
  if (altAgac.length === 0) return [];
  const h = haritalariKur(db, { kokler, altAgac });
  const kimlikJ = JSON.stringify(altAgac);

  const fazlar = [];
  for (const tipler of TIP_SIRASI) {
    const yer = tipler.map(() => '?').join(',');
    const satirlar = db.prepare(
      `SELECT kaymak_id, type, parent_id, season_number, episode_number, title, year
         FROM entities WHERE type IN (${yer}) AND kaymak_id IN (SELECT value FROM json_each(?))
        ORDER BY updated_at`
    ).all(...tipler, kimlikJ).map((e) => varlikSatiri(e, h));
    if (satirlar.length) fazlar.push({ faz: 'entities', satirlar });
  }

  const yerK = AYNALANAN_KAYNAKLAR.map(() => '?').join(',');
  const kimlikler = db.prepare(
    `SELECT source, source_id, kaymak_id, retired_at FROM external_ids
      WHERE +source IN (${yerK}) AND kaymak_id IN (SELECT value FROM json_each(?))
      ORDER BY last_seen_at`
  ).all(...AYNALANAN_KAYNAKLAR, kimlikJ).map(disKimlikSatiri);
  if (kimlikler.length) fazlar.push({ faz: 'external_ids', satirlar: kimlikler });

  return fazlar;
}

/**
 * Herhangi bir varlığın KÖKÜ (dizi/film). Bölüm → sezon → dizi.
 * Bulunamazsa null (ör. yarım hiyerarşi).
 */
function kokBul(db, kaymakId) {
  let id = kaymakId;
  for (let i = 0; i < 3 && id; i++) {
    const e = db.prepare('SELECT kaymak_id, type, parent_id FROM entities WHERE kaymak_id = ?').get(id);
    if (!e) return null;
    if (e.type === 'show' || e.type === 'movie') return e.kaymak_id;
    id = e.parent_id;
  }
  return null;
}

module.exports = {
  AYNALANAN_KAYNAKLAR,
  TIP_SIRASI,
  haritalariKur,
  varlikSatiri,
  disKimlikSatiri,
  altAgacFazlari,
  altAgacKimlikleri,
  kokBul,
  gecerliTarih,
  temizGenres,
};
