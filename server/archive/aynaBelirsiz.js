const { islemDisiYaz } = require('./db');
const { AYNA_BELIRSIZ_BEKLEME_MS } = require('../radar/ayar');

const ONEK = 'ayna_belirsiz:';
const sqliteYazilamayan = new Map();

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
  const atlar = new Map(kayitlar.map(({ kok, at }) => [kok, at]));
  for (const [kok, at] of sqliteYazilamayan) if (at <= simdi) sqliteYazilamayan.delete(kok);
  for (const kok of kokler) {
    const at = sqliteYazilamayan.get(kok);
    if (at) atlar.set(kok, Math.max(atlar.get(kok) || 0, at));
  }
  return Array.from(atlar, ([kok, at]) => ({ kok, at }));
}

async function belirsizUcusYaz(kokler, simdi) {
  const yenidenAt = simdi + AYNA_BELIRSIZ_BEKLEME_MS;
  try {
    await islemDisiYaz((db) => {
      db.prepare("DELETE FROM meta WHERE key GLOB 'ayna_belirsiz:*' AND CAST(value AS INTEGER)<=?").run(simdi);
      db.prepare(`INSERT INTO meta (key,value) SELECT ? || value, ? FROM json_each(?) WHERE true
      ON CONFLICT(key) DO UPDATE SET value=CAST(max(CAST(meta.value AS INTEGER),CAST(excluded.value AS INTEGER)) AS TEXT)`)
        .run(ONEK, String(yenidenAt), JSON.stringify(kokler));
    });
  } catch (_) {
    for (const kok of kokler) sqliteYazilamayan.set(kok, yenidenAt);
    console.warn('[Ayna] Belirsiz ucus SQLite yazimi basarisiz; surec ici bekleme etkin.');
  }
  return { ok: false, reason: 'ayna_belirsiz', yenidenAt, belirsizKokler: kokler };
}

module.exports = { partiKokleri, belirsizKokler, belirsizUcusYaz };
