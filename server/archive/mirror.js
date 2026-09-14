// ==========================================================================
// KATALOG AYNASI — Pi (SQLite) → Worker → Supabase   (Faz T · T0.3)
// ==========================================================================
// TEK İŞİ: arşivdeki kimlik omurgasını Postgres'e aynalamak. Kullanıcı
// verisi (T1) `kaymak_id` ile bağlanacak ve Supabase o kimliği ÇÖZEBİLMELİ.
//
// ⛔ TEK YÖNLÜ. Gerçeğin kaynağı BURASI (Pi'deki SQLite). Supabase yalnızca
// bir ayna; oradan buraya HİÇBİR ŞEY okunmaz. Ham payload'lar da GİTMEZ
// (plan §7-1: arşivi Postgres'e taşımak yasak) — yalnızca kimlik kolonları.
//
// ──────────────────────────────────────────────────────────────────────────
// 🔴 NEDEN WORKER ÜZERİNDEN
// ──────────────────────────────────────────────────────────────────────────
// `036`'nın RLS'i yazmaya kapalı; yalnızca `service_role` yazabilir. O
// anahtarı Pi'ye koymak TÜM veritabanını (users, feed_activities,
// push_tokens…) Pi'nin güvenliğine bağlardı. Bunun yerine Worker'ın
// `/catalog/sync` ucu kullanılıyor: sır sızarsa saldırgan YALNIZCA katalog
// yazabilir. (Kullanıcı kararı, 2026-09-06.)
//
// ──────────────────────────────────────────────────────────────────────────
// 🔴 SIRA ZORUNLU — `parent_id` kendine FK veriyor
// ──────────────────────────────────────────────────────────────────────────
// `show/movie` → `season` → `episode` → `external_ids`. Ters sırada FK
// ihlali alınır. Uç sırayı zorlamıyor (durum tutmuyor); zorlayan BURASI.
//
// ──────────────────────────────────────────────────────────────────────────
// 🔴 `runtime` KOPYALANAMAZ, ÇIKARILIR
// ──────────────────────────────────────────────────────────────────────────
// Arşivin `entities` tablosunda `runtime` KOLONU YOK — veri gzip'li
// payload'ın içinde. Dizi/film için `show_detail`/`movie_detail`'in kökünde,
// bölüm için `show_seasons` → `episodes[].runtime`. Doluluk ölçüldü
// (M311): dizi %98,9 · film %99,8 · bölüm %100.

const zlib = require('node:zlib');
const { isArchiveEnabled, getDb } = require('./db');
const { logSync } = require('./store');

/** Worker'ın kabul ettiği parti tavanı (`routes/catalogSync.js` ile AYNI). */
const PARTI = 500;

/**
 * Bir turda aynalanacak EN FAZLA satır — kaçak koruması, hız ayarı değil.
 * Bugünkü arşiv ~52 bin entity + ~53 bin trakt kimliği; ikisi de bu tavanın
 * çok altında ve tek turda bitiyor (~210 istek, ~40 sn).
 *
 * 🔴 TAVANA ÇARPILIRSA İMLEÇ İLERLETİLMEZ: yarım kalmış bir tur, bir sonraki
 * turda BAŞTAN koşar. Upsert idempotent olduğu için bu güvenli; imleci yarım
 * ilerletmek ise sessizce atlanan satırlar bırakırdı.
 */
const TUR_TAVANI = 200000;

/** Aynalanan kaynaklar — `036`'daki CHECK ile AYNI olmak ZORUNDA. */
const AYNALANAN_KAYNAKLAR = [
  'trakt:show', 'trakt:movie', 'trakt:season', 'trakt:episode', 'trakt:slug',
];

/** Ebeveyn önce: FK'nin dayattığı sıra. */
const TIP_SIRASI = [['show', 'movie'], ['season'], ['episode']];

const IMLEC_ANAHTARI = 'mirror_high_water';

// ── İmleç ─────────────────────────────────────────────────────────────────

function imlecOku(db) {
  try {
    const r = db.prepare('SELECT value FROM meta WHERE key = ?').get(IMLEC_ANAHTARI);
    const n = r ? Number(r.value) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (_) {
    return 0; // okunamıyorsa baştan aynala — upsert idempotent, zarar yok
  }
}

function imlecYaz(db, deger) {
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(IMLEC_ANAHTARI, String(deger));
}

// ── Zenginleştirme: runtime + tmdb_id ────────────────────────────────────

const ac = (body) => {
  try { return JSON.parse(zlib.gunzipSync(body).toString('utf8')); } catch (_) { return null; }
};

/**
 * `kaymak_id → runtime` haritası.
 *
 * Dizi/film doğrudan payload kökünden; bölüm ise `show_seasons` içindeki
 * `episodes[].runtime`'dan — ama orada yalnızca TRAKT id'si var, bu yüzden
 * `external_ids` üzerinden `kaymak_id`'ye bağlanıyor.
 */
function runtimeHaritasi(db) {
  const harita = new Map();

  for (const r of db.prepare(
    "SELECT kaymak_id, body FROM payloads WHERE endpoint IN ('show_detail','movie_detail')"
  ).iterate()) {
    const j = ac(r.body);
    const kok = Array.isArray(j) ? j[0] : j;
    if (kok && Number.isFinite(kok.runtime)) harita.set(r.kaymak_id, kok.runtime);
  }

  // Bölümler: trakt id → runtime, sonra kaymak_id'ye çevir.
  const traktRuntime = new Map();
  for (const r of db.prepare("SELECT body FROM payloads WHERE endpoint = 'show_seasons'").iterate()) {
    const j = ac(r.body);
    if (!j) continue;
    for (const sezon of (Array.isArray(j) ? j : [j])) {
      for (const b of (sezon?.episodes || [])) {
        const tid = b?.ids?.trakt;
        if (tid != null && Number.isFinite(b.runtime)) traktRuntime.set(String(tid), b.runtime);
      }
    }
  }
  if (traktRuntime.size > 0) {
    for (const r of db.prepare(
      "SELECT source_id, kaymak_id FROM external_ids WHERE source = 'trakt:episode' AND retired_at IS NULL"
    ).iterate()) {
      const rt = traktRuntime.get(String(r.source_id));
      if (rt !== undefined) harita.set(r.kaymak_id, rt);
    }
  }
  return harita;
}

/**
 * `kaymak_id → genres` haritası (dize dizisi) — §C18.
 *
 * 🔴 `runtime` İLE AYNI SINIF: arşivin `entities` tablosunda `genres` KOLONU
 * YOK, veri gzip'li payload'ın İÇİNDE (`show_detail`/`movie_detail` kökünde
 * `genres: ["drama","science-fiction"]`). Kopyalanamaz, ÇIKARILIR.
 *
 * 📏 ÖLÇÜLDÜ (2026-09-12): dizi 560 payload'ın 557'sinde (**%99,5**), film
 * 434'ün 433'ünde (**%99,8**). 28 tekil tür; birleşik en uzun değer 74
 * karakter. Supabase maliyeti ≈ **0,03 MB**.
 *
 * ⚠️ Yalnızca DİZİ ve FİLM. Sezon/bölüm payload'ında tür yok ve zaten
 * istatistik onları kullanmıyor.
 */
function genresHaritasi(db) {
  const harita = new Map();
  for (const r of db.prepare(
    "SELECT kaymak_id, body FROM payloads WHERE endpoint IN ('show_detail','movie_detail')"
  ).iterate()) {
    const j = ac(r.body);
    const kok = Array.isArray(j) ? j[0] : j;
    const g = kok?.genres;
    if (!Array.isArray(g)) continue;
    // Worker (`catalogSync.js` → `temizGenres`) ve `047`'nin CHECK'i son
    // savunma hatları; burası ilk hat. Üçü de aynı tavanları uyguluyor.
    const temiz = [];
    for (const t of g) {
      if (typeof t !== 'string') continue;
      const s = t.trim().slice(0, 40);
      if (s && !temiz.includes(s)) temiz.push(s);
      if (temiz.length >= 30) break;
    }
    if (temiz.length > 0) harita.set(r.kaymak_id, temiz);
  }
  return harita;
}

/**
 * `kaymak_id → first_aired` haritası (ISO dize).
 *
 * 🔴 NEDEN VAR: ilerleme hesabındaki `aired`, YAYINLANMIŞ bölüm sayısıdır.
 * Katalogdaki tüm bölümleri saymak, devam eden bir diziyi hiçbir zaman
 * "Güncel" kovasına düşürmez — kullanıcı her bölümü izlemiş olsa bile
 * (bkz. migration 039).
 *
 * ⚠️ `runtimeHaritasi` ile AYNI ŞEKİLDE: arşivin `entities` tablosunda
 * `first_aired` KOLONU YOK, veri gzip'li payload'ın içinde. Kopyalanamaz,
 * ÇIKARILIR.
 *
 * Dizi/film kökten (`show_detail`/`movie_detail` → `first_aired`); bölüm
 * ise `show_seasons` → `episodes[].first_aired`'dan — orada yalnızca Trakt
 * id'si var, bu yüzden `external_ids` üzerinden `kaymak_id`'ye bağlanıyor.
 */
function firstAiredHaritasi(db) {
  const harita = new Map();

  // Trakt tarihleri zaten ISO-8601 UTC ("2026-05-11T01:00:00.000Z").
  // Ayrıştırılabilirliği DOĞRULUYORUZ: bozuk bir dize Postgres tarafında
  // tüm partiyi reddettirirdi (400) ve tur sessizce yarım kalırdı.
  const gecerliTarih = (d) => {
    if (typeof d !== 'string' || d.length < 4) return null;
    const t = Date.parse(d);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  };

  for (const r of db.prepare(
    "SELECT kaymak_id, body FROM payloads WHERE endpoint IN ('show_detail','movie_detail')"
  ).iterate()) {
    const j = ac(r.body);
    const kok = Array.isArray(j) ? j[0] : j;
    const d = gecerliTarih(kok?.first_aired || kok?.released);
    if (d) harita.set(r.kaymak_id, d);
  }

  // Bölümler: trakt id → tarih, sonra kaymak_id'ye çevir.
  const traktTarih = new Map();
  for (const r of db.prepare("SELECT body FROM payloads WHERE endpoint = 'show_seasons'").iterate()) {
    const j = ac(r.body);
    if (!j) continue;
    for (const sezon of (Array.isArray(j) ? j : [j])) {
      for (const b of (sezon?.episodes || [])) {
        const tid = b?.ids?.trakt;
        const d = gecerliTarih(b?.first_aired);
        if (tid != null && d) traktTarih.set(String(tid), d);
      }
    }
  }
  if (traktTarih.size > 0) {
    for (const r of db.prepare(
      // 🪦 Emekli kimlik tarih türetmez (v2): sağlayıcının sildiği bölüm
      // kimliğinden tarih iliştirmek bayat veriyi canlı tutardı.
      "SELECT source_id, kaymak_id FROM external_ids WHERE source = 'trakt:episode' AND retired_at IS NULL"
    ).iterate()) {
      const d = traktTarih.get(String(r.source_id));
      if (d !== undefined) harita.set(r.kaymak_id, d);
    }
  }
  return harita;
}

/**
 * `kaymak_id → tmdb_id` haritası.
 *
 * 🔑 Bu kolon, `catalog_external_ids` üzerinde 15,14 MB'lık bir ters
 * indeksin YERİNE geçiyor (ölçüm M311) — poster yolunun tamamı bu.
 * TMDB kimlikleri Supabase'e AYNALANMIYOR; yalnızca bu kolona giriyor.
 */
function tmdbHaritasi(db) {
  const harita = new Map();
  for (const r of db.prepare(
    // 🪦 Emekli kimlik elenir (v2) — aksi hâlde aynı kayda bağlı İKİ
    // tmdb kimliği olur ve `harita.set` satır sırasına göre BELİRSİZ bir
    // değer yazar (bağımsız inceleme, 2026-09-14).
    "SELECT source_id, kaymak_id FROM external_ids WHERE source IN ('tmdb:show','tmdb:movie','tmdb:episode') AND retired_at IS NULL"
  ).iterate()) {
    const n = Number(r.source_id);
    if (Number.isInteger(n)) harita.set(r.kaymak_id, n);
  }
  return harita;
}

// ── Gönderim ──────────────────────────────────────────────────────────────

/**
 * Worker'a bir parti gönderir. ASLA throw etmez — `{ok, ...}` döner.
 *
 * ⚠️ FK hatası (`23503`) burada görünür ve turu DURDURUR: sıra bozulmuşsa
 * devam etmek yalnızca daha çok hata üretirdi.
 */
async function partiGonder(cfg, faz, satirlar) {
  try {
    const res = await fetch(`${cfg.workerUrl}/catalog/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kaymak-sync-secret': cfg.secret,
      },
      body: JSON.stringify({ faz, satirlar }),
    });
    if (!res.ok) {
      const govde = await res.text().catch(() => '');
      return { ok: false, reason: `http_${res.status}`, detay: govde.slice(0, 300) };
    }
    const j = await res.json().catch(() => ({}));
    return { ok: true, yazilan: j.yazilan || 0, atlanan: j.atlanan || 0 };
  } catch (error) {
    return { ok: false, reason: 'network', detay: String(error?.message || error).slice(0, 200) };
  }
}

async function akisiGonder(cfg, faz, satirlar, sayac) {
  for (let i = 0; i < satirlar.length; i += PARTI) {
    const r = await partiGonder(cfg, faz, satirlar.slice(i, i + PARTI));
    if (!r.ok) return r;
    sayac.yazilan += r.yazilan;
    sayac.atlanan += r.atlanan;
  }
  return { ok: true };
}

// ── Ana tur ───────────────────────────────────────────────────────────────

/**
 * Bir aynalama turu. 🔴 ASLA THROW ETMEZ (zamanlayıcıdan çağrılıyor —
 * `backfillSchedule.js` ile aynı sözleşme).
 */
async function runMirror({ tamAyna = false, tavan = TUR_TAVANI } = {}) {
  try {
    if (!isArchiveEnabled()) return { ok: false, reason: 'arsiv_kapali' };
    const db = getDb();
    if (!db) return { ok: false, reason: 'db_yok' };

    const cfg = {
      workerUrl: (process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '').replace(/\/$/, ''),
      secret: process.env.PI_SYNC_SECRET || '',
    };
    if (!cfg.workerUrl) return { ok: false, reason: 'worker_url_yok' };
    if (cfg.secret.length < 32) return { ok: false, reason: 'sir_yok' };

    const imlec = tamAyna ? 0 : imlecOku(db);
    const sayac = { yazilan: 0, atlanan: 0 };
    let enYuksek = imlec;
    let toplam = 0;

    const runtime = runtimeHaritasi(db);
    const tmdb = tmdbHaritasi(db);
    const genres = genresHaritasi(db);
    const firstAired = firstAiredHaritasi(db);

    // 1-3) Varlıklar — TİP SIRASINDA (FK zorunluluğu)
    for (const tipler of TIP_SIRASI) {
      const yer = tipler.map(() => '?').join(',');
      const satirlar = db.prepare(
        `SELECT kaymak_id, type, parent_id, season_number, episode_number, title, year, updated_at
           FROM entities WHERE type IN (${yer}) AND updated_at > ? ORDER BY updated_at`
      ).all(...tipler, imlec).map((e) => ({
        kaymak_id: e.kaymak_id,
        type: e.type,
        parent_id: e.parent_id,
        season_number: e.season_number,
        episode_number: e.episode_number,
        title: e.title,
        year: e.year,
        runtime: runtime.get(e.kaymak_id) ?? null,
        tmdb_id: tmdb.get(e.kaymak_id) ?? null,
        // 🔴 §C18 — `?? null` ŞART. `undefined` bırakılırsa `JSON.stringify`
        // anahtarı DÜŞÜRÜR ve partideki nesneler farklı anahtar kümesine
        // sahip olur → PostgREST `PGRST102 "All object keys must match"` ile
        // partinin TAMAMINI reddeder (canlıda görüldü, tam ayna 0 satır yazdı).
        genres: genres.get(e.kaymak_id) ?? null,
        // ⚠️ NULL = "bilinmiyor", "yayınlanmadı" DEĞİL (bkz. 039).
        first_aired: firstAired.get(e.kaymak_id) ?? null,
        _u: e.updated_at,
      }));

      if (satirlar.length === 0) continue;
      toplam += satirlar.length;
      for (const s of satirlar) { if (s._u > enYuksek) enYuksek = s._u; delete s._u; }

      const r = await akisiGonder(cfg, 'entities', satirlar, sayac);
      if (!r.ok) {
        logSync({ event: 'mirror', provider: 'supabase', detail: `entities ${tipler.join('/')} basarisiz: ${r.reason} ${r.detay || ''}` });
        return { ok: false, reason: r.reason, detay: r.detay, ...sayac };
      }
    }

    // 4) Dış kimlikler — YALNIZCA trakt:* (kapsam kararı, M311)
    const yerK = AYNALANAN_KAYNAKLAR.map(() => '?').join(',');
    const disKimlikler = db.prepare(
      `SELECT source, source_id, kaymak_id, last_seen_at
         FROM external_ids WHERE source IN (${yerK}) AND last_seen_at > ? ORDER BY last_seen_at`
    ).all(...AYNALANAN_KAYNAKLAR, imlec);

    if (disKimlikler.length > 0) {
      toplam += disKimlikler.length;
      for (const x of disKimlikler) if (x.last_seen_at > enYuksek) enYuksek = x.last_seen_at;
      const r = await akisiGonder(
        cfg, 'external_ids',
        disKimlikler.map((x) => ({ source: x.source, source_id: x.source_id, kaymak_id: x.kaymak_id })),
        sayac
      );
      if (!r.ok) {
        logSync({ event: 'mirror', provider: 'supabase', detail: `external_ids basarisiz: ${r.reason} ${r.detay || ''}` });
        return { ok: false, reason: r.reason, detay: r.detay, ...sayac };
      }
    }

    // 🔴 İmleç YALNIZCA tur eksiksiz bittiyse ilerler.
    const tamamlandi = toplam <= tavan;
    if (tamamlandi && enYuksek > imlec) imlecYaz(db, enYuksek);

    // "Sessizce hiçbir şey yapmadı" ile "çalışmadı" ayırt edilebilmeli
    // (Madde 284/286'nın dersi) — eksik olmasa BİLE logla.
    logSync({
      event: 'mirror',
      provider: 'supabase',
      detail: `yazilan=${sayac.yazilan} atlanan=${sayac.atlanan} imlec=${tamamlandi ? enYuksek : imlec}${tamamlandi ? '' : ' TAVAN_ASILDI'}`,
    });

    return { ok: true, ...sayac, toplam, imlec: tamamlandi ? enYuksek : imlec, tamamlandi };
  } catch (error) {
    console.error('[Ayna] beklenmeyen hata:', error?.message || error);
    try { logSync({ event: 'mirror', provider: 'supabase', detail: `exception: ${error?.message}` }); } catch (_) {}
    return { ok: false, reason: 'exception', detay: String(error?.message || error) };
  }
}

module.exports = {
  runMirror,
  runtimeHaritasi,
  tmdbHaritasi,
  firstAiredHaritasi,
  imlecOku,
  imlecYaz,
  PARTI,
  TUR_TAVANI,
  TIP_SIRASI,
  AYNALANAN_KAYNAKLAR,
  IMLEC_ANAHTARI,
};
