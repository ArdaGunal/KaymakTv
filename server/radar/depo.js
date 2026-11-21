const { getDb, transactionAsync } = require('../archive/db');
const { gecikme, RadarHatasi, DENEME_TAVANI, YENI_IS_PARTISI, YENI_IS_ARALIGI, SAAT } = require('./ayar');

const SEMA = require('./sema');
const { gidenKutusuBuda, BUDAMA_SAYACI } = require('./gidenKutusu');

function tablolarVar(db) {
  return !!db?.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='radar_takvim'").get();
}

function saglikOku(db, simdi = Date.now()) {
  const bos = { sonTur: null, imlecler: {}, kuyruk: { tazeleme: 0, ayna: 0, olay: 0, terkIs: 0, terkOlay: 0, olayBudanan: 0 }, hataSayilari: {}, sonHata: null };
  if (!tablolarVar(db)) return bos;
  const durum = db.prepare('SELECT deger FROM radar_durum WHERE anahtar = ?');
  const say = (sql) => db.prepare(sql).get().n;
  return {
    hataSayilari: Object.fromEntries(db.prepare("SELECT substr(anahtar,6) AS kod,deger FROM radar_durum WHERE anahtar LIKE 'hata:%'").all()
      .map(({ kod, deger }) => [kod, Number(deger)])),
    sonTur: durum.get('sonTur')?.deger ?? null,
    sonHata: durum.get('sonHata')?.deger ?? null,
    imlecler: Object.fromEntries(db.prepare('SELECT akis, at, telafi_son_id FROM radar_imlec').all()
      .map(({ akis, at, telafi_son_id }) => [akis, { at: new Date(at).toISOString(), telafi: telafi_son_id !== null, gecikti: simdi - at > 2 * SAAT }])),
    kuyruk: {
      tazeleme: say('SELECT count(*) n FROM radar_is WHERE terk=0'),
      ayna: say(`SELECT count(*) n FROM radar_takvim JOIN radar_takip USING(tur,trakt_id)
        LEFT JOIN radar_is USING(tur,trakt_id) WHERE ayna_bekliyor=1 AND coalesce(radar_is.terk,0)=0`),
      olay: say('SELECT count(*) n FROM radar_giden WHERE terk=0'),
      terkIs: say('SELECT count(*) n FROM radar_is WHERE terk=1'),
      terkOlay: say('SELECT count(*) n FROM radar_giden WHERE terk=1'),
      olayBudanan: Number(durum.get(BUDAMA_SAYACI)?.deger ?? 0),
    },
  };
}

async function semayiKur() {
  await transactionAsync((h) => {
    h.exec(SEMA);
    for (const [tablo, kolon] of [['radar_takvim','kaynak_at'], ['radar_is','terk'], ['radar_giden','terk']]) {
      if (!h.prepare(`PRAGMA table_info(${tablo})`).all().some((r) => r.name === kolon)) {
        h.exec(`ALTER TABLE ${tablo} ADD COLUMN ${kolon} INTEGER NOT NULL DEFAULT 0`);
      }
    }
  });
}

async function depoAc({ yaz, olay }) {
  if (yaz) {
    const db = getDb();
    if (!db) throw new RadarHatasi('arsiv_kapali');
    await semayiKur();
    return depoKur(db, transactionAsync, true);
  }

  const { DatabaseSync } = require('node:sqlite');
  const bellek = new DatabaseSync(':memory:');
  bellek.exec(SEMA);
  const atomik = (fn) => {
    bellek.exec('BEGIN');
    try {
      const sonuc = fn(bellek);
      bellek.exec('COMMIT');
      return sonuc;
    } catch (error) {
      bellek.exec('ROLLBACK');
      throw error;
    }
  };
  const depo = depoKur(bellek, atomik, false);
  const arsiv = olay ? getDb() : null;
  if (tablolarVar(arsiv)) {
    await semayiKur();
    const giden = depoKur(arsiv, transactionAsync, false);
    depo.bekleyenOlaylar = giden.bekleyenOlaylar;
    depo.olayOnayla = giden.olayOnayla;
    depo.olayTerk = giden.olayTerk;
    depo.saglik = () => {
      const ozet = saglikOku(bellek);
      return { ...ozet, kuyruk: saglikOku(arsiv).kuyruk };
    };
  }
  return depo;
}

function depoKur(db, islem, yaz) {
  const sql = (metin) => db.prepare(metin);
  const kuyrugaAl = sql(`INSERT INTO radar_is (tur,trakt_id,oncelik,hazir_at)
    VALUES (?,?,?,?) ON CONFLICT(tur,trakt_id) DO UPDATE
    SET oncelik=max(radar_is.oncelik,excluded.oncelik)`);
  const imlecYaz = sql(`INSERT INTO radar_imlec VALUES (?,?,?)
    ON CONFLICT(akis) DO UPDATE SET at=excluded.at,telafi_son_id=excluded.telafi_son_id`);
  const imlec = (akis) => sql('SELECT at, telafi_son_id FROM radar_imlec WHERE akis=?').get(akis);

  return {
    db, islem, imlec,
    saglik: () => saglikOku(db),
    durumYaz: (anahtar, deger) => islem(() => deger === null
      ? sql('DELETE FROM radar_durum WHERE anahtar=?').run(anahtar)
      : sql('INSERT OR REPLACE INTO radar_durum VALUES (?,?)').run(anahtar, deger)),
    hataSay: (kod) => islem(() => sql(`INSERT INTO radar_durum VALUES (?, '1')
      ON CONFLICT(anahtar) DO UPDATE SET deger=CAST(deger AS INTEGER)+1`).run('hata:' + kod)),
    takipDegistir: (satirlar, simdi) => islem(() => {
      // Geçersiz/tekrarlı görüntüde PRIMARY KEY işlemin tamamını geri alır.
      db.exec(`CREATE TEMP TABLE IF NOT EXISTS radar_yeni_takip AS SELECT * FROM radar_takip WHERE 0;
        DELETE FROM radar_yeni_takip`);
      const ekle = sql('INSERT INTO radar_yeni_takip VALUES (?,?,?,?)');
      for (const r of satirlar) ekle.run(r.tur, r.trakt_id, r.tmdb_id, r.takipci);
      const yeni = sql(`SELECT n.tur,n.trakt_id FROM radar_yeni_takip n LEFT JOIN radar_takip t
        USING(tur,trakt_id) WHERE t.trakt_id IS NULL OR t.tmdb_id IS NOT n.tmdb_id`).all();
      db.exec(`DELETE FROM radar_takip; INSERT INTO radar_takip SELECT * FROM radar_yeni_takip;
        DELETE FROM radar_yeni_takip;
        DELETE FROM radar_is WHERE NOT EXISTS (
          SELECT 1 FROM radar_takip t WHERE t.tur=radar_is.tur AND t.trakt_id=radar_is.trakt_id
        )`);
      if (yaz) for (const [i, r] of yeni.entries()) {
        kuyrugaAl.run(r.tur, r.trakt_id, 2, simdi + Math.floor(i / YENI_IS_PARTISI) * YENI_IS_ARALIGI);
      }
      return yeni.length;
    }),
    kesisim: ({ tur, saglayici }, kimlikler) => {
      const kolon = saglayici === 'tmdb' ? 'tmdb_id' : 'trakt_id';
      return sql(`SELECT trakt_id FROM radar_takip WHERE tur=? AND ${kolon} IN (SELECT value FROM json_each(?))`)
        .all(tur, JSON.stringify(kimlikler)).map((r) => r.trakt_id);
    },
    akisiKaydet: (akis, at, eslesen, telafi) => islem(() => {
      if (yaz) for (const id of eslesen) kuyrugaAl.run(akis.tur, id, 1, at);
      imlecYaz.run(akis.ad, at, telafi);
    }),
    telafi: (akis, simdi, limit) => {
      const onceki = imlec(akis.ad);
      if (!onceki || onceki.telafi_son_id === null) return;
      return islem(() => {
        const satirlar = sql(`SELECT trakt_id FROM radar_takip WHERE tur=? AND trakt_id>?
          AND (?='trakt' OR tmdb_id IS NOT NULL) ORDER BY trakt_id LIMIT ?`)
          .all(akis.tur, onceki.telafi_son_id, akis.saglayici, limit);
        if (yaz) for (const r of satirlar) kuyrugaAl.run(akis.tur, r.trakt_id, 0, simdi);
        imlecYaz.run(akis.ad, onceki.at, satirlar.length < limit ? null : satirlar.at(-1).trakt_id);
        return satirlar.length;
      });
    },
    hazirIsler: (simdi, limit, ustOncelik = 2) => sql(`SELECT i.*, t.tmdb_id FROM radar_is i JOIN radar_takip t USING(tur,trakt_id)
      WHERE i.terk=0 AND i.hazir_at<=? AND i.oncelik<=? ORDER BY i.oncelik DESC,i.hazir_at,i.trakt_id LIMIT ?`).all(simdi, ustOncelik, limit),
    isiErtele: (is, simdi, ms) => islem(() => sql(
      'UPDATE radar_is SET deneme=deneme+1,terk=(deneme+1>=?),hazir_at=? WHERE tur=? AND trakt_id=?'
    ).run(DENEME_TAVANI, simdi + Math.max(ms, gecikme(is.deneme)), is.tur, is.trakt_id)),
    takvim: ({ tur, trakt_id }) => sql('SELECT * FROM radar_takvim WHERE tur=? AND trakt_id=?').get(tur, trakt_id),
    bekleyenAynalar: (simdi, limit) => sql(`SELECT kaymak_id,takvim_rev,ayna_deneme FROM radar_takvim
      JOIN radar_takip USING(tur,trakt_id) LEFT JOIN radar_is USING(tur,trakt_id)
      WHERE ayna_bekliyor=1 AND coalesce(radar_is.terk,0)=0 AND ayna_hazir_at<=? ORDER BY ayna_hazir_at LIMIT ?`).all(simdi, limit),
    aynaOnayla: (r) => islem(() => sql(`UPDATE radar_takvim SET aynalanan_rev=max(aynalanan_rev,?),
      ayna_bekliyor=CASE WHEN takvim_rev=? THEN 0 ELSE 1 END
      WHERE kaymak_id=? AND takvim_rev>=?`).run(r.takvim_rev, r.takvim_rev, r.kaymak_id, r.takvim_rev)),
    aynaErtele: (r, at, yenidenAt = 0) => islem(() => sql(`UPDATE radar_takvim SET ayna_deneme=ayna_deneme+1,ayna_hazir_at=?
      WHERE kaymak_id=? AND takvim_rev=?`).run(Math.max(at + gecikme(r.ayna_deneme), yenidenAt), r.kaymak_id, r.takvim_rev)),
    gidenKutusuBuda: (simdi) => islem(() => gidenKutusuBuda(db, simdi)),
    bekleyenOlaylar: (limit) => sql(`SELECT g.id,g.olay FROM radar_giden g
      JOIN radar_takvim t ON t.tur=g.icerik_tur AND t.trakt_id=g.trakt_id
      WHERE g.terk=0 AND t.aynalanan_rev>=g.takvim_rev ORDER BY g.id LIMIT ?`).all(limit),
    olayTerk: (id) => islem(() => sql('UPDATE radar_giden SET terk=1 WHERE id=?').run(id)),
    olayOnayla: (parti) => islem(() => sql('DELETE FROM radar_giden WHERE id IN (SELECT value FROM json_each(?))')
      .run(JSON.stringify(parti.map((r) => r.id)))),
  };
}

module.exports = { depoAc, depoKur, tablolarVar, saglikOku, SEMA };
