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

const { isArchiveEnabled, getDb } = require('./db');
const { logSync } = require('./store');
const {
  AYNALANAN_KAYNAKLAR, TIP_SIRASI, haritalariKur, varlikSatiri, disKimlikSatiri,
} = require('./aynaSatirlari');

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

// `AYNALANAN_KAYNAKLAR`, `TIP_SIRASI` ve satırın BİÇİMİ `aynaSatirlari.js`'te —
// §C30 tekil aktarımı AYNI tanımı kullanıyor (ıraksarlarsa PGRST102).

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

    const h = haritalariKur(db);

    // 1-3) Varlıklar — TİP SIRASINDA (FK zorunluluğu)
    for (const tipler of TIP_SIRASI) {
      const yer = tipler.map(() => '?').join(',');
      const satirlar = db.prepare(
        `SELECT kaymak_id, type, parent_id, season_number, episode_number, title, year, updated_at
           FROM entities WHERE type IN (${yer}) AND updated_at > ? ORDER BY updated_at`
      ).all(...tipler, imlec).map((e) => ({ ...varlikSatiri(e, h), _u: e.updated_at }));

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
      `SELECT source, source_id, kaymak_id, last_seen_at, retired_at
         FROM external_ids WHERE source IN (${yerK}) AND last_seen_at > ? ORDER BY last_seen_at`
    ).all(...AYNALANAN_KAYNAKLAR, imlec);

    if (disKimlikler.length > 0) {
      toplam += disKimlikler.length;
      for (const x of disKimlikler) if (x.last_seen_at > enYuksek) enYuksek = x.last_seen_at;
      const r = await akisiGonder(
        cfg, 'external_ids',
        // 🪦 `retired_at` DE İTİLİYOR (§C20). Emeklilik Supabase'e ancak
        // böyle ulaşır: sorgu artımlı (`last_seen_at > imlec`) ve emekli
        // etme `last_seen_at`i tazelediği için satır bu turda görünüyor.
        // Pi'de SİLSEYDİK satır hiç görünmez, iki kaynak sessizce ayrışırdı.
        disKimlikler.map(disKimlikSatiri),
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
  partiGonder,
  akisiGonder,
  imlecOku,
  imlecYaz,
  PARTI,
  TUR_TAVANI,
  TIP_SIRASI,
  AYNALANAN_KAYNAKLAR,
  IMLEC_ANAHTARI,
};
