const { GIDEN_KUTUSU_OMRU, GIDEN_KUTUSU_TAVANI, iso } = require('./ayar');

const BUDAMA_SAYACI = 'olayBudanan';

/** Gönderim kapalıyken, çağıranın SQLite işlemi içinde bakım yapar. */
function gidenKutusuBuda(db, simdi) {
  const eski = db.prepare(`DELETE FROM radar_giden WHERE CASE WHEN json_valid(olay)
    THEN julianday(json_extract(olay, '$.tespit_at')) < julianday(?) ELSE false END`)
    .run(iso(simdi - GIDEN_KUTUSU_OMRU)).changes;
  const fazla = db.prepare(`DELETE FROM radar_giden WHERE id IN (
    SELECT id FROM radar_giden ORDER BY id DESC LIMIT -1 OFFSET ?
  )`).run(GIDEN_KUTUSU_TAVANI).changes;
  const budanan = eski + fazla;
  if (budanan) db.prepare(`INSERT INTO radar_durum (anahtar,deger) VALUES (?,?)
    ON CONFLICT(anahtar) DO UPDATE SET deger=CAST(deger AS INTEGER)+CAST(excluded.deger AS INTEGER)`)
    .run(BUDAMA_SAYACI, String(budanan));
  return budanan;
}

module.exports = { gidenKutusuBuda, BUDAMA_SAYACI };
