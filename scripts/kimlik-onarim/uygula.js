// ==========================================================================
// A3 KİMLİK ONARIMI — Yazım yolu (M552) · YALNIZ `--uygula` + onaylı plan ile
// ==========================================================================
// 🔴 VERİ KAYBI GÜVENCESİ (kullanıcı, 2026-10-20: «verilerin kaybolmadığından emin ol»):
//   1. Çağıran önce `VACUUM INTO` yedeği alır ve bütünlüğünü doğrular (`kimlik-onarim.js`).
//   2. Bütün eylemler TEK işlemde (`BEGIN IMMEDIATE`). Her eylem satırın BEKLENEN durumda olduğunu
//      WHERE ile doğrular (`changes === 1`); planla canlı arasında fark varsa → ROLLBACK.
//   3. COMMIT'ten ÖNCE değişmezler sınanır: hiçbir varlık/kimlik/yük satırı EKSİLMEDİ, sayılar
//      tam olarak planın eklediği kadar arttı, yabancı anahtarlar tutarlı, birleşmeler sıfırlandı.
//      Biri tutmazsa → ROLLBACK, veritabanı hiç değişmemiş olur.
//   4. Silme eylemi YOK. Taşınan/emekli kimlik satırı yerinde kalır (yalnız `kaymak_id`/`retired_at`).
//
// Ayna (Supabase) artımlı: `entities.updated_at` ve `external_ids.last_seen_at` > imleç. Bu yüzden
// dokunulan her satırın damgası tazelenir — yoksa düzeltme Supabase'e hiç ulaşmaz.

const zlib = require('zlib');

function sayim(db) {
  const g = (s) => db.prepare(s).get().n;
  return {
    varlik: g('SELECT COUNT(*) n FROM entities'),
    kimlik: g('SELECT COUNT(*) n FROM external_ids'),
    yuk: g('SELECT COUNT(*) n FROM payloads'),
    cokluTraktBolum: g(`SELECT COUNT(*) n FROM (SELECT kaymak_id FROM external_ids WHERE source='trakt:episode' AND retired_at IS NULL GROUP BY kaymak_id HAVING COUNT(*)>1)`),
    cokluTraktDizi: g(`SELECT COUNT(*) n FROM (SELECT kaymak_id FROM external_ids WHERE source='trakt:show' AND retired_at IS NULL GROUP BY kaymak_id HAVING COUNT(*)>1)`),
    cokluTraktSezon: g(`SELECT COUNT(*) n FROM (SELECT kaymak_id FROM external_ids WHERE source='trakt:season' AND retired_at IS NULL GROUP BY kaymak_id HAVING COUNT(*)>1)`),
    cokluTmdbBolum: g(`SELECT COUNT(*) n FROM (SELECT kaymak_id FROM external_ids WHERE source='tmdb:episode' AND retired_at IS NULL GROUP BY kaymak_id HAVING COUNT(*)>1)`),
  };
}

function birEylem(db, e, simdi, traktYanitlari) {
  let r;
  switch (e.tur) {
    case 'varlikEkle':
      r = db.prepare(`INSERT INTO entities (kaymak_id, type, parent_id, season_number, episode_number, title, year, status, created_at, updated_at)
                      VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(e.kaymak_id, e.type, e.parent_id, e.season_number, e.episode_number, e.title, e.year, e.status, simdi, simdi);
      break;
    case 'varlikGuncelle': {
      const alan = Object.keys(e.alanlar);
      const set = alan.map((a) => `${a} = ?`).join(', ');
      const kosul = alan.map((a) => `${a} IS ?`).join(' AND ');
      r = db.prepare(`UPDATE entities SET ${set}, updated_at = ? WHERE kaymak_id = ? AND ${kosul}`)
        .run(...alan.map((a) => e.alanlar[a]), simdi, e.kaymak_id, ...alan.map((a) => e.once[a]));
      break;
    }
    case 'varlikDokun':
      r = db.prepare('UPDATE entities SET updated_at = ? WHERE kaymak_id = ?').run(simdi, e.kaymak_id);
      break;
    case 'kimlikTasi':
      r = db.prepare(`UPDATE external_ids SET kaymak_id = ?, last_seen_at = ? WHERE source = ? AND source_id = ? AND kaymak_id = ? AND retired_at IS NULL`)
        .run(e.hedef, simdi, e.source, e.source_id, e.kaymak_id);
      break;
    case 'kimlikEmekli':
      r = db.prepare(`UPDATE external_ids SET retired_at = ?, last_seen_at = ? WHERE source = ? AND source_id = ? AND kaymak_id = ? AND retired_at IS NULL`)
        .run(simdi, simdi, e.source, e.source_id, e.kaymak_id);
      break;
    case 'kimlikEtkin':
      r = db.prepare(`UPDATE external_ids SET retired_at = NULL, last_seen_at = ? WHERE source = ? AND source_id = ? AND kaymak_id = ? AND retired_at IS NOT NULL`)
        .run(simdi, e.source, e.source_id, e.kaymak_id);
      break;
    case 'kimlikEkle':
      r = db.prepare('INSERT INTO external_ids (source, source_id, kaymak_id, first_seen_at, last_seen_at) VALUES (?,?,?,?,?)')
        .run(e.source, e.source_id, e.kaymak_id, simdi, simdi);
      break;
    case 'yukTasi':
      r = db.prepare('UPDATE payloads SET kaymak_id = ?, updated_at = ? WHERE kaymak_id = ? AND provider = ? AND endpoint = ? AND lang = ?')
        .run(e.hedef, simdi, e.kaymak_id, e.provider, e.endpoint, e.lang);
      break;
    case 'yukEkle': {
      const y = traktYanitlari[e.istek];
      if (!y || y.govde == null) throw new Error(`yukEkle: plan dosyasında yanıt yok (${e.istek})`);
      const ham = Buffer.from(JSON.stringify(y.govde));
      const gz = zlib.gzipSync(ham);
      r = db.prepare(`INSERT INTO payloads (kaymak_id, provider, endpoint, lang, body, bytes_raw, bytes_gz, fetched_at, updated_at)
                      VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(e.kaymak_id, e.provider, e.endpoint, e.lang, gz, ham.length, gz.length, y.fetched_at, simdi);
      break;
    }
    default:
      throw new Error(`bilinmeyen eylem: ${e.tur}`);
  }
  if (!r || r.changes !== 1) throw new Error(`eylem beklenen satırı bulamadı (canlı plandan farklı): ${JSON.stringify(e)}`);
}

/** Planın eylemlerinden beklenen sayım farkı. */
function beklenenFark(eylemler) {
  const say = (t) => eylemler.filter((e) => e.tur === t).length;
  return { varlik: say('varlikEkle'), kimlik: say('kimlikEkle'), yuk: say('yukEkle') };
}

function denetle(db, once, plan) {
  const sonra = sayim(db);
  const fark = beklenenFark(plan.eylemler);
  const hatalar = [];
  for (const k of ['varlik', 'kimlik', 'yuk']) {
    if (sonra[k] !== once[k] + fark[k]) hatalar.push(`${k}: ${once[k]} + ${fark[k]} beklenirdi, ${sonra[k]} oldu`);
  }
  if (sonra.cokluTraktBolum !== plan.beklenen.cokluTraktBolum) hatalar.push(`çoklu-aktif trakt:episode ${plan.beklenen.cokluTraktBolum} beklenirdi, ${sonra.cokluTraktBolum}`);
  if (plan.beklenen.cokluTmdbBolum != null && sonra.cokluTmdbBolum !== plan.beklenen.cokluTmdbBolum) hatalar.push(`çoklu-aktif tmdb:episode ${plan.beklenen.cokluTmdbBolum} beklenirdi, ${sonra.cokluTmdbBolum}`);
  if (sonra.cokluTraktSezon !== plan.beklenen.cokluTraktSezon) hatalar.push(`çoklu-aktif trakt:season ${plan.beklenen.cokluTraktSezon} beklenirdi, ${sonra.cokluTraktSezon}`);
  if (sonra.cokluTraktDizi !== plan.beklenen.cokluTraktDizi) hatalar.push(`çoklu-aktif trakt:show ${plan.beklenen.cokluTraktDizi} beklenirdi, ${sonra.cokluTraktDizi}`);
  const fk = db.prepare('PRAGMA foreign_key_check').all();
  if (fk.length) hatalar.push(`yabancı anahtar ihlali: ${fk.length}`);
  const kimlikSorgu = db.prepare('SELECT kaymak_id, retired_at FROM external_ids WHERE source = ? AND source_id = ?');
  for (const e of plan.eylemler) {
    if (e.tur !== 'kimlikTasi' && e.tur !== 'kimlikEkle') continue;
    const s = kimlikSorgu.get(e.source, e.source_id);
    const hedef = e.tur === 'kimlikTasi' ? e.hedef : e.kaymak_id;
    if (!s || s.kaymak_id !== hedef || s.retired_at != null) hatalar.push(`${e.source}=${e.source_id} hedefte değil`);
  }
  return { sonra, hatalar };
}

/**
 * Planı tek işlemde uygular. Değişmezlerden biri tutmazsa ROLLBACK ve hata fırlatır.
 * @returns {{once, sonra}}
 */
function uygula(db, plan, { simdi = Date.now() } = {}) {
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 10000');
  const once = sayim(db);
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const e of plan.eylemler) birEylem(db, e, simdi, plan.trakt || {});
    const { sonra, hatalar } = denetle(db, once, plan);
    if (hatalar.length) throw new Error(`değişmez denetimi geçmedi:\n  - ${hatalar.join('\n  - ')}`);
    db.prepare('INSERT INTO sync_log (at, event, provider, endpoint, kaymak_id, detail) VALUES (?,?,?,?,?,?)')
      .run(simdi, 'onarim', null, 'a3_kimlik', null, `plan=${plan.parmakIzi} eylem=${plan.eylemler.length} varlik+${sonra.varlik - once.varlik} kimlik+${sonra.kimlik - once.kimlik} yuk+${sonra.yuk - once.yuk}`);
    db.exec('COMMIT');
    return { once, sonra };
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_) { /* işlem zaten kapandıysa */ }
    throw err;
  }
}

module.exports = { uygula, sayim, beklenenFark };
