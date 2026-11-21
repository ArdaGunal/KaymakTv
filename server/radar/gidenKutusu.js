const { GIDEN_KUTUSU_OMRU, GIDEN_KUTUSU_TAVANI, iso } = require('./ayar');

const BUDAMA_SAYACI = 'olayBudanan';

/** Çağıranın SQLite işlemi içinde bakım yapar. */
function gidenKutusuBuda(db, simdi, olayAcik = false) {
  const eski = db.prepare(`DELETE FROM radar_giden AS g WHERE (NOT ? OR g.terk=1 OR NOT EXISTS (
    SELECT 1 FROM radar_takvim t JOIN radar_takip a USING(tur,trakt_id)
    WHERE t.tur=g.icerik_tur AND t.trakt_id=g.trakt_id
      AND (t.aynalanan_rev>=g.takvim_rev OR (t.ayna_bekliyor<>2 AND NOT EXISTS (
        SELECT 1 FROM radar_is i WHERE i.tur=t.tur AND i.trakt_id=t.trakt_id AND i.terk=1
      )))
  )) AND CASE WHEN json_valid(olay)
    THEN julianday(json_extract(olay, '$.tespit_at')) < julianday(?) ELSE g.terk=1 END`)
    .run(Number(olayAcik), iso(simdi - GIDEN_KUTUSU_OMRU)).changes;
  db.prepare(`DELETE FROM radar_takvim WHERE takipsiz_at<=? AND NOT EXISTS (
    SELECT 1 FROM radar_takip t WHERE t.tur=radar_takvim.tur AND t.trakt_id=radar_takvim.trakt_id
  )`).run(simdi - GIDEN_KUTUSU_OMRU);
  const fazla = olayAcik ? 0 : db.prepare(`DELETE FROM radar_giden WHERE id IN (
    SELECT id FROM radar_giden ORDER BY id DESC LIMIT -1 OFFSET ?
  )`).run(GIDEN_KUTUSU_TAVANI).changes;
  const budanan = eski + fazla;
  if (budanan) db.prepare(`INSERT INTO radar_durum (anahtar,deger) VALUES (?,?)
    ON CONFLICT(anahtar) DO UPDATE SET deger=CAST(deger AS INTEGER)+CAST(excluded.deger AS INTEGER)`)
    .run(BUDAMA_SAYACI, String(budanan));
  return budanan;
}

module.exports = { gidenKutusuBuda, BUDAMA_SAYACI };
