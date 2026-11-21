const { islemDisiYaz } = require('./db');
const { AYNA_BELIRSIZ_BEKLEME_MS } = require('../radar/ayar');

const ONEK = 'ayna_belirsiz:';

function partiKokleri(db, satirlar) {
  return db.prepare(`SELECT DISTINCT coalesce(ust.parent_id,e.parent_id,e.kaymak_id,j.value) AS kok
    FROM json_each(?) j LEFT JOIN entities e ON e.kaymak_id=j.value
    LEFT JOIN entities ust ON ust.kaymak_id=e.parent_id`)
    .all(JSON.stringify(satirlar.map((s) => s.kaymak_id))).map((r) => r.kok);
}

function belirsizKokler(db, kokler, simdi) {
  const kayitlar = db.prepare(`SELECT j.value AS kok, CAST(m.value AS INTEGER) AS at
    FROM json_each(?) j JOIN meta m ON m.key=? || j.value WHERE CAST(m.value AS INTEGER)>?`)
    .all(JSON.stringify(kokler), ONEK, simdi);
  return kayitlar;
}

async function ucusuKaydet(kokler, saat, istekMs) {
  const sonuc = await islemDisiYaz((db) => {
    const simdi = saat();
    const at = simdi + istekMs + AYNA_BELIRSIZ_BEKLEME_MS;
    const liste = JSON.stringify(kokler);
    const senkron = db.prepare('PRAGMA synchronous').get().synchronous;
    // Arşivin NORMAL ayarında güç kesintisi son WAL kaydını kaybettirebilir.
    db.exec('PRAGMA synchronous=FULL');
    try {
      const r = db.prepare(`INSERT INTO meta (key,value) SELECT ? || value, ? FROM json_each(?)
        WHERE NOT EXISTS (SELECT 1 FROM json_each(?) j JOIN meta m ON m.key=? || j.value
          WHERE CAST(m.value AS INTEGER)>?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(ONEK, String(at), liste, liste, ONEK, simdi);
      return r.changes ? { at } : { ret: belirsizSonuc(belirsizKokler(db, kokler, simdi)) };
    } finally { db.exec(`PRAGMA synchronous=${senkron}`); }
  });
  if (!sonuc) throw new Error('ayna_kilit_yazilamadi');
  return sonuc;
}

function belirsizSonuc(bekleyen) {
  return { ok: false, reason: 'ayna_belirsiz', yenidenAt: Math.max(...bekleyen.map((r) => r.at)),
    belirsizKokler: bekleyen.map((r) => r.kok) };
}

async function ucusuBitir(kokler, at, belirsizAt = null) {
  if (at == null) return null;
  const koklerJson = JSON.stringify(kokler);
  const yeniAt = belirsizAt === null ? null : belirsizAt + AYNA_BELIRSIZ_BEKLEME_MS;
  try {
    await islemDisiYaz((db) => {
      const filtre = 'WHERE value=? AND key IN (SELECT ? || value FROM json_each(?))';
      if (yeniAt === null) db.prepare('DELETE FROM meta ' + filtre).run(String(at), ONEK, koklerJson);
      else db.prepare('UPDATE meta SET value=? ' + filtre).run(String(yeniAt), String(at), ONEK, koklerJson);
    });
  } catch (_) {
    console.warn('[Ayna] Ucus durumu guncellenemedi; kalici on-kilit korundu.');
    return belirsizSonuc(kokler.map((kok) => ({ kok, at })));
  }
  return yeniAt === null ? null : belirsizSonuc(kokler.map((kok) => ({ kok, at: yeniAt })));
}

module.exports = { partiKokleri, ucusuKaydet, ucusuBitir };
