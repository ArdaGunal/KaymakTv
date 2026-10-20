// ==========================================================================
// A3 KİMLİK ONARIMI — Eylem defteri + ortak yardımcılar (M552)
// ==========================================================================
// Plan, veritabanına dokunmadan EYLEM listesi üretir; yazım yolu (`uygula.js`) bu listeyi aynen
// uygular. Defter, planın kendi içinde çelişmesini engeller: aynı kimliğe iki eylem, aynı yuvaya
// iki varlık, var olmayan satıra işlem → eylem YAZILMAZ, uyarı düşer (insan bakar).
//
// 🔴 SİLME EYLEMİ YOK. Arşiv silmez (K1 istisnası yalnız bağı TAŞIMAYA izin verir). Eylem türleri:
//   varlikEkle · varlikGuncelle · kimlikTasi · kimlikEmekli · kimlikEtkin · kimlikEkle · yukTasi · yukEkle

const crypto = require('crypto');
const zlib = require('zlib');

const ac = (body) => JSON.parse(zlib.gunzipSync(body).toString('utf8'));

/** Trakt kimliği geçerli mi? (identity.js `traktIdsToExternal` ile aynı kural: 0/boş/nesne değil) */
const gecerli = (v) => v !== null && v !== undefined && v !== '' && v !== 0 && typeof v !== 'object';

/**
 * Deterministik `kaymak_id`: kuru çalıştırma ile uygulama AYNI kimliği üretir, yani onaylanan
 * rapordaki kimlik yazılanla birebir aynıdır (Supabase'te S3 için önceden SQL yazılabilir).
 */
function onarimKimligi(tip, capa) {
  const h = crypto.createHash('sha256').update(`kimlik-onarim/a3:${capa}`).digest('hex');
  return `${tip}_${h.slice(0, 32)}`;
}

/** Trakt `ids` → `external_ids` satırları (identity.js `traktIdsToExternal` ile aynı adlar). */
function payloadKimlikleri(tip, ids) {
  if (!ids || typeof ids !== 'object') return [];
  const c = [];
  const ekle = (s, v) => { if (gecerli(v)) c.push(`${s}=${String(v)}`); };
  ekle(`trakt:${tip}`, ids.trakt);
  if (tip === 'show' || tip === 'movie') ekle('trakt:slug', ids.slug);
  ekle('imdb', ids.imdb);
  ekle(`tvdb:${tip}`, ids.tvdb);
  ekle(`tmdb:${tip}`, ids.tmdb);
  return c;
}

function sorgular(db) {
  return {
    varlik: db.prepare('SELECT * FROM entities WHERE kaymak_id = ?'),
    cocuk: db.prepare(`SELECT * FROM entities WHERE parent_id = ? AND type = ? AND season_number = ?
                         AND COALESCE(episode_number, -1) = ?`),
    cocuklar: db.prepare('SELECT * FROM entities WHERE parent_id = ? ORDER BY season_number, episode_number'),
    kimlikleri: db.prepare(`SELECT source, source_id, kaymak_id, first_seen_at, retired_at FROM external_ids
                              WHERE kaymak_id = ? ORDER BY source, source_id`),
    kimlik: db.prepare('SELECT source, source_id, kaymak_id, retired_at FROM external_ids WHERE source = ? AND source_id = ?'),
    yuk: db.prepare('SELECT body, fetched_at FROM payloads WHERE kaymak_id = ? AND provider = ? AND endpoint = ? AND lang = ?'),
    yukler: db.prepare('SELECT provider, endpoint, lang, body, fetched_at FROM payloads WHERE kaymak_id = ? ORDER BY provider, endpoint, lang'),
  };
}

/** Dizinin arşivdeki sezon listesi yükü (kanonik '-' önce; eski 'tr'/'en' yuvaları da okunur). */
function sezonYuku(q, diziId) {
  for (const lang of ['-', 'tr', 'en']) {
    const r = q.yuk.get(diziId, 'trakt', 'show_seasons', lang);
    if (!r) continue;
    try {
      const j = ac(r.body);
      if (Array.isArray(j)) return { lang, sezonlar: j };
    } catch (_) { /* bozuk yük — sonraki dil */ }
  }
  return null;
}

/** Sezon listesi → trakt bölüm kimliği / yuva / sezon haritaları. */
function indeksle(sezonlar) {
  const bolum = new Map();
  const yuva = new Map();
  const sezon = new Map();
  for (const s of sezonlar || []) {
    if (!s || typeof s.number !== 'number') continue;
    sezon.set(s.number, s);
    for (const ep of s.episodes || []) {
      if (!ep || !ep.ids || !gecerli(ep.ids.trakt)) continue;
      const kayit = { season: typeof ep.season === 'number' ? ep.season : s.number, number: ep.number, title: ep.title ?? null, ids: ep.ids };
      bolum.set(String(ep.ids.trakt), kayit);
      yuva.set(`${kayit.season}x${kayit.number}`, kayit);
    }
  }
  return { bolum, yuva, sezon };
}

function defterOlustur(q) {
  const eylemler = [];
  const uyarilar = [];
  const planliVarlik = new Map();
  const planliYuva = new Map();
  const dokunulanKimlik = new Set();
  const kimlikHedef = new Map(); // 'kaynak=değer' → planın bu kimliği bağladığı kayıt
  const yukDurumu = new Map();
  const yA = (p, t, s, e) => `${p}|${t}|${s}|${e == null ? -1 : e}`;

  // `planli`: yuva plan içinde dolduruldu · `yeni`: dolduran kayıt planın AÇTIĞI kayıt (taşınan eski kayıt değil)
  function yuvadaki(parentId, type, s, e) {
    const k = planliYuva.get(yA(parentId, type, s, e));
    if (k) return { kaymak_id: k, planli: true, yeni: planliVarlik.has(k) };
    if (planliVarlik.has(parentId)) return null; // yeni ebeveynin veritabanında çocuğu yok
    const r = q.cocuk.get(parentId, type, s, e == null ? -1 : e);
    return r ? { kaymak_id: r.kaymak_id, planli: false } : null;
  }

  function varlikEkle(satir) {
    if (q.varlik.get(satir.kaymak_id) || planliVarlik.has(satir.kaymak_id)) {
      uyarilar.push(`varlık zaten var/planlı: ${satir.kaymak_id}`); return false;
    }
    if (satir.parent_id && yuvadaki(satir.parent_id, satir.type, satir.season_number, satir.episode_number)) {
      uyarilar.push(`yuva dolu: ${satir.parent_id} ${satir.type} S${satir.season_number}E${satir.episode_number}`); return false;
    }
    const tam = { parent_id: null, season_number: null, episode_number: null, title: null, year: null, status: null, ...satir };
    planliVarlik.set(tam.kaymak_id, tam);
    if (tam.parent_id) planliYuva.set(yA(tam.parent_id, tam.type, tam.season_number, tam.episode_number), tam.kaymak_id);
    eylemler.push({ tur: 'varlikEkle', ...tam });
    return true;
  }

  function varlikGuncelle(kid, alanlar, neden) {
    const r = q.varlik.get(kid);
    if (!r) { uyarilar.push(`güncellenecek varlık yok: ${kid}`); return false; }
    const degisen = {};
    const once = {};
    for (const [a, v] of Object.entries(alanlar)) {
      if (v !== undefined && r[a] !== v) { degisen[a] = v; once[a] = r[a]; }
    }
    if (!Object.keys(degisen).length) return false;
    if ('parent_id' in degisen) {
      if (yuvadaki(degisen.parent_id, r.type, r.season_number, r.episode_number)) {
        uyarilar.push(`taşıma hedef yuvası dolu: ${kid} → ${degisen.parent_id}`); return false;
      }
      planliYuva.set(yA(degisen.parent_id, r.type, r.season_number, r.episode_number), kid);
    }
    eylemler.push({ tur: 'varlikGuncelle', kaymak_id: kid, alanlar: degisen, once, neden });
    return true;
  }

  function kimlik(tur, kaynakDeger, kid, hedef) {
    const ayir = kaynakDeger.indexOf('=');
    const source = kaynakDeger.slice(0, ayir);
    const sourceId = kaynakDeger.slice(ayir + 1);
    if (dokunulanKimlik.has(kaynakDeger)) { uyarilar.push(`${kaynakDeger} planda ikinci kez (${tur}) — atlandı`); return false; }
    const s = q.kimlik.get(source, sourceId);
    if (tur === 'kimlikEkle') {
      if (s) { uyarilar.push(`${kaynakDeger} zaten ${s.kaymak_id} kaydında — eklenmedi`); return false; }
    } else {
      if (!s || s.kaymak_id !== kid) { uyarilar.push(`${kaynakDeger} ${kid} kaydında değil (${s ? s.kaymak_id : 'yok'}) — ${tur} atlandı`); return false; }
      const emekli = s.retired_at != null;
      if ((tur === 'kimlikTasi' || tur === 'kimlikEmekli') && emekli) { uyarilar.push(`${kaynakDeger} zaten emekli — ${tur} atlandı`); return false; }
      if (tur === 'kimlikEtkin' && !emekli) return false;
    }
    dokunulanKimlik.add(kaynakDeger);
    if (tur === 'kimlikTasi') kimlikHedef.set(kaynakDeger, hedef);
    if (tur === 'kimlikEkle') kimlikHedef.set(kaynakDeger, kid);
    eylemler.push({ tur, source, source_id: sourceId, kaymak_id: kid, ...(hedef ? { hedef } : {}) });
    return true;
  }

  // Yük yuvasının PLAN İÇİNDEKİ durumu: taşınan yükün eski yuvası boşalır, yeni yuvası dolar.
  function yukDolu(kid, provider, endpoint, lang) {
    const k = `${kid}|${provider}/${endpoint}/${lang}`;
    if (yukDurumu.has(k)) return yukDurumu.get(k);
    return !!q.yuk.get(kid, provider, endpoint, lang);
  }

  function yuk(tur, provider, endpoint, lang, kid, ek) {
    const anahtar = `${provider}/${endpoint}/${lang}`;
    const hedefKid = tur === 'yukTasi' ? ek.hedef : kid;
    if (yukDolu(hedefKid, provider, endpoint, lang)) { uyarilar.push(`yük yuvası dolu: ${hedefKid} ${anahtar} — ${tur} atlandı`); return false; }
    if (tur === 'yukTasi' && !yukDolu(kid, provider, endpoint, lang)) { uyarilar.push(`taşınacak yük yok: ${kid} ${anahtar}`); return false; }
    yukDurumu.set(`${hedefKid}|${anahtar}`, true);
    if (tur === 'yukTasi') yukDurumu.set(`${kid}|${anahtar}`, false);
    eylemler.push({ tur, provider, endpoint, lang, kaymak_id: kid, ...ek });
    return true;
  }

  return {
    eylemler, uyarilar, yuvadaki, varlikEkle, varlikGuncelle,
    kimlikTasi: (kd, kid, hedef) => kimlik('kimlikTasi', kd, kid, hedef),
    kimlikEmekli: (kd, kid) => kimlik('kimlikEmekli', kd, kid),
    kimlikEtkin: (kd, kid) => kimlik('kimlikEtkin', kd, kid),
    kimlikEkle: (kd, kid) => kimlik('kimlikEkle', kd, kid),
    yukTasi: (p, e, l, kid, hedef) => yuk('yukTasi', p, e, l, kid, { hedef }),
    yukEkle: (p, e, l, kid, istek) => yuk('yukEkle', p, e, l, kid, { istek }),
    planliMi: (kid) => planliVarlik.has(kid),
    kimlikHedefi: (kd) => kimlikHedef.get(kd) || null,
  };
}

module.exports = { ac, gecerli, onarimKimligi, payloadKimlikleri, sorgular, sezonYuku, indeksle, defterOlustur };
