const { getDb, getArchiveStatus, openReadOnly, transactionAsync } = require('../archive/db');
const { gecikme, RadarHatasi, DENEME_TAVANI, YENI_IS_PARTISI, YENI_IS_ARALIGI, SAAT, GUN } = require('./ayar');

const { olcumImlecleri } = require('./imlec');
const SEMA = require('./sema');
const { gidenKutusuBuda, BUDAMA_SAYACI } = require('./gidenKutusu');

const BOS_AKIS_ONEKI = 'akis_bos:';
const AKIS_DEVRI_ONEKI = 'akis_devri:';

function bosAkisOku(durum, akis) {
  const r = durum.get(BOS_AKIS_ONEKI + akis);
  return r ? JSON.parse(r.deger) : { ardisikBos: 0, basAt: null };
}

function tablolarVar(db) {
  return !!db?.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='radar_takvim'").get();
}

function saglikOku(db, simdi = Date.now()) {
  const bos = { sonTur: null, imlecler: {}, kuyruk: { tazeleme: 0, ayna: 0, olay: 0, terkIs: 0, terkAyna: 0, terkOlay: 0,
    olayBudanan: 0, aynaBildirimi: 0, terkAynaBildirimi: 0 }, hataSayilari: {}, sonHata: null, aynaBildirimiSonHata: null };
  if (!tablolarVar(db)) return bos;
  const durum = db.prepare('SELECT deger FROM radar_durum WHERE anahtar = ?');
  const say = (sql) => db.prepare(sql).get().n;
  const aynaKutusuVar = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='radar_ayna_giden'").get();
  return {
    hataSayilari: Object.fromEntries(db.prepare("SELECT substr(anahtar,6) AS kod,deger FROM radar_durum WHERE anahtar LIKE 'hata:%'").all()
      .map(({ kod, deger }) => [kod, Number(deger)])),
    sonTur: durum.get('sonTur')?.deger ?? null,
    sonHata: durum.get('sonHata')?.deger ?? null,
    aynaBildirimiSonHata: durum.get('aynaBildirimiSonHata')?.deger ?? null,
    imlecler: Object.fromEntries(db.prepare('SELECT akis, at, telafi_son_id FROM radar_imlec').all()
      .map(({ akis, at, telafi_son_id }) => {
        const { ardisikBos, basAt } = bosAkisOku(durum, akis);
        return [akis, {
          at: new Date(at).toISOString(), telafi: telafi_son_id !== null, gecikti: simdi - at > 2 * SAAT,
          ardisikBos, bosUyarisi: basAt !== null && at - basAt >= GUN,
        }];
      })),
    kuyruk: {
      tazeleme: say('SELECT count(*) n FROM radar_is WHERE terk=0'),
      ayna: say(`SELECT count(*) n FROM radar_takvim JOIN radar_takip USING(tur,trakt_id)
        LEFT JOIN radar_is USING(tur,trakt_id) WHERE ayna_bekliyor=1 AND coalesce(radar_is.terk,0)=0`),
      olay: say('SELECT count(*) n FROM radar_giden WHERE terk=0'),
      terkIs: say('SELECT count(*) n FROM radar_is WHERE terk=1'),
      terkAyna: say('SELECT count(*) n FROM radar_takvim WHERE ayna_bekliyor=2'),
      terkOlay: say('SELECT count(*) n FROM radar_giden WHERE terk=1'),
      olayBudanan: Number(durum.get(BUDAMA_SAYACI)?.deger ?? 0),
      aynaBildirimi: aynaKutusuVar ? say('SELECT count(*) n FROM radar_ayna_giden WHERE veri IS NOT NULL AND terk=0') : 0,
      terkAynaBildirimi: aynaKutusuVar ? say('SELECT count(*) n FROM radar_ayna_giden WHERE terk=1') : 0,
    },
  };
}

async function semayiKur() {
  await transactionAsync((h) => {
    h.exec(SEMA);
    if (!h.prepare("SELECT 1 FROM pragma_table_info('radar_takvim') WHERE name='takipsiz_at'").get()) {
      h.exec('ALTER TABLE radar_takvim ADD COLUMN takipsiz_at INTEGER');
    }
    for (const [tablo, kolon] of [['radar_takvim','kaynak_at'], ['radar_is','terk'], ['radar_giden','terk'],
      ['radar_ayna_giden','deneme'], ['radar_ayna_giden','cakisma_deneme'], ['radar_ayna_giden','hazir_at']]) {
      if (!h.prepare(`PRAGMA table_info(${tablo})`).all().some((r) => r.name === kolon)) {
        h.exec(`ALTER TABLE ${tablo} ADD COLUMN ${kolon} INTEGER NOT NULL DEFAULT 0`);
      }
    }
    h.exec(`DROP INDEX IF EXISTS radar_ayna_giden_hazir;
      CREATE INDEX IF NOT EXISTS radar_ayna_giden_hazir_at ON radar_ayna_giden(hazir_at,tur,trakt_id)
      WHERE veri IS NOT NULL AND terk=0`);
  });
}

async function depoAc({ yaz, olay, olcumKalici = false }) {
  const arsivYolu = olcumKalici ? getArchiveStatus().dbPath : null;
  if (yaz) {
    const db = getDb();
    if (!db) throw new RadarHatasi('arsiv_kapali');
    await semayiKur();
    const olcum = olcumImlecleri(arsivYolu);
    if (olcum) {
      try {
        const imlecler = olcum.oku();
        await transactionAsync((h) => {
          const ekle = h.prepare('INSERT OR IGNORE INTO radar_imlec VALUES (?,?,0)');
          for (const r of imlecler) ekle.run(r.akis, r.at);
        });
      } finally { olcum.kapat(); }
    }
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
  const olcum = olcumImlecleri(arsivYolu, true);
  if (olcum) {
    try {
      const ekle = bellek.prepare(`INSERT INTO radar_imlec VALUES (?,?,?) ON CONFLICT(akis) DO UPDATE SET
        at=excluded.at,telafi_son_id=excluded.telafi_son_id WHERE excluded.at>=radar_imlec.at`);
      for (const r of olcum.oku()) ekle.run(r.akis, r.at, r.telafi_son_id);
      const kaynak = openReadOnly();
      if (kaynak) {
        try {
          if (tablolarVar(kaynak.db)) for (const r of kaynak.db.prepare('SELECT * FROM radar_imlec').all()) {
            ekle.run(r.akis, r.at, r.telafi_son_id);
          }
        } finally { kaynak.db.close(); }
      }
    } finally { olcum.kapat(); }
  }
  const depo = depoKur(bellek, atomik, false);
  if (arsivYolu) {
    const kaydet = depo.akisiKaydet;
    depo.akisiKaydet = async (akis, at, eslesen, telafi, hamSatir) => {
      const durum = olcumImlecleri(arsivYolu, true);
      try { durum.yaz(akis.ad, at, telafi); } finally { durum.kapat(); }
      await kaydet(akis, at, eslesen, telafi, hamSatir);
    };
  }
  const arsiv = olay ? getDb() : null;
  if (tablolarVar(arsiv)) {
    await semayiKur();
    const giden = depoKur(arsiv, transactionAsync, false);
    depo.bekleyenOlaylar = giden.bekleyenOlaylar;
    depo.olayOnayla = giden.olayOnayla;
    depo.olayTerk = giden.olayTerk;
    depo.gidenKutusuBuda = giden.gidenKutusuBuda;
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
    SET oncelik=max(radar_is.oncelik,excluded.oncelik), deneme=0, terk=0,
      hazir_at=CASE WHEN radar_is.terk=1 THEN excluded.hazir_at ELSE min(radar_is.hazir_at,excluded.hazir_at) END
    WHERE excluded.oncelik>0`);
  const imlecYaz = sql(`INSERT INTO radar_imlec VALUES (?,?,?)
    ON CONFLICT(akis) DO UPDATE SET at=excluded.at,telafi_son_id=excluded.telafi_son_id`);
  const imlec = (akis) => sql('SELECT at, telafi_son_id FROM radar_imlec WHERE akis=?').get(akis);

  const durumYaz = (anahtar, deger) => islem(() => deger === null
    ? sql('DELETE FROM radar_durum WHERE anahtar=?').run(anahtar)
    : sql('INSERT OR REPLACE INTO radar_durum VALUES (?,?)').run(anahtar, deger));
  const hataSay = (kod) => sql(`INSERT INTO radar_durum VALUES (?, '1')
    ON CONFLICT(anahtar) DO UPDATE SET deger=CAST(deger AS INTEGER)+1`).run('hata:' + kod);
  const aynaBildirimiYaz = (kaynak) => sql(`INSERT INTO radar_ayna_giden(tur,trakt_id,takvim_rev,veri,hazir_at)
    SELECT tur,trakt_id,takvim_rev,veri,? FROM (${kaynak}) WHERE true
    ON CONFLICT(tur,trakt_id) DO UPDATE SET takvim_rev=excluded.takvim_rev,veri=excluded.veri,
      hazir_at=excluded.hazir_at,deneme=0,cakisma_deneme=0,terk=0
    WHERE excluded.takvim_rev>radar_ayna_giden.takvim_rev`);

  return {
    db, islem, imlec,
    akisDevri: (akis) => JSON.parse(sql('SELECT deger FROM radar_durum WHERE anahtar=?').get(AKIS_DEVRI_ONEKI + akis)?.deger ?? 'null'),
    akisDevriYaz: (akis, devir) => durumYaz(AKIS_DEVRI_ONEKI + akis, devir === null ? null : JSON.stringify(devir)),
    saglik: () => saglikOku(db),
    durumYaz,
    hataSay: (kod) => islem(() => hataSay(kod)),
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
      if (yaz) sql(`UPDATE radar_takvim AS k SET takipsiz_at=CASE WHEN EXISTS (
        SELECT 1 FROM radar_takip t WHERE t.tur=k.tur AND t.trakt_id=k.trakt_id
      ) THEN NULL ELSE coalesce(k.takipsiz_at,?) END`).run(simdi);
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
    akisiKaydet: (akis, at, eslesen, telafi, hamSatir) => islem(() => {
      if (yaz) for (const id of eslesen) kuyrugaAl.run(akis.tur, id, 1, at);
      imlecYaz.run(akis.ad, at, telafi);
      if (akis.saglayici === 'trakt') sql('DELETE FROM radar_durum WHERE anahtar=?').run(AKIS_DEVRI_ONEKI + akis.ad);
      if (hamSatir === 0) {
        const eski = bosAkisOku(sql('SELECT deger FROM radar_durum WHERE anahtar=?'), akis.ad);
        const veri = JSON.stringify({ ardisikBos: eski.ardisikBos + 1, basAt: eski.basAt ?? at });
        sql('INSERT OR REPLACE INTO radar_durum VALUES (?,?)').run(BOS_AKIS_ONEKI + akis.ad, veri);
      } else if (hamSatir > 0) {
        sql('DELETE FROM radar_durum WHERE anahtar=?').run(BOS_AKIS_ONEKI + akis.ad);
      }
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
    isiTamamla: (is) => islem(() => sql('DELETE FROM radar_is WHERE tur=? AND trakt_id=?').run(is.tur, is.trakt_id)),
    isiErtele: (is, simdi, ms, say = true) => islem(() => sql(
      'UPDATE radar_is SET deneme=deneme+?,terk=(deneme+?>=?),hazir_at=? WHERE tur=? AND trakt_id=?'
    ).run(Number(say), Number(say), DENEME_TAVANI, simdi + Math.max(ms, gecikme(is.deneme)), is.tur, is.trakt_id)),
    takvim: ({ tur, trakt_id }) => sql('SELECT * FROM radar_takvim WHERE tur=? AND trakt_id=?').get(tur, trakt_id),
    bekleyenAynalar: (simdi, limit) => sql(`SELECT kaymak_id,takvim_rev,ayna_deneme,veri FROM radar_takvim
      JOIN radar_takip USING(tur,trakt_id) LEFT JOIN radar_is USING(tur,trakt_id)
      WHERE ayna_bekliyor=1 AND coalesce(radar_is.terk,0)=0 AND ayna_hazir_at<=? ORDER BY ayna_hazir_at LIMIT ?`).all(simdi, limit),
    aynaOnayla: (r, simdi = Date.now()) => islem(() => {
      const takvim = sql('SELECT * FROM radar_takvim WHERE kaymak_id=?').get(r.kaymak_id);
      sql(`UPDATE radar_takvim SET aynalanan_rev=max(aynalanan_rev,?),
        ayna_bekliyor=CASE WHEN takvim_rev=? THEN 0 ELSE 1 END
        WHERE kaymak_id=? AND takvim_rev>=?`).run(r.takvim_rev, r.takvim_rev, r.kaymak_id, r.takvim_rev);
      if (!takvim || r.takvim_rev <= takvim.aynalanan_rev || r.takvim_rev > takvim.takvim_rev) return;
      const goruntu = r.goruntu?.takvim_rev === r.takvim_rev ? r.goruntu : takvim;
      if (goruntu.takvim_rev !== r.takvim_rev || typeof goruntu.veri !== 'string') {
        hataSay('ayna_goruntusu_yok');
        return;
      }
      try {
        aynaBildirimiYaz('SELECT ? AS tur,? AS trakt_id,? AS takvim_rev,? AS veri')
          .run(simdi, takvim.tur, takvim.trakt_id, r.takvim_rev, goruntu.veri);
      } catch {
        hataSay('ayna_bildirimi_yazim');
      }
    }),
    aynaErtele: (r, at, yenidenAt = 0, satirReddi = false) => islem(() => sql(`UPDATE radar_takvim SET ayna_deneme=ayna_deneme+1,ayna_hazir_at=?,
      ayna_bekliyor=CASE WHEN ? AND ayna_deneme+1>=? THEN 2 ELSE 1 END
      WHERE kaymak_id=? AND takvim_rev=?`).run(Math.max(at + gecikme(r.ayna_deneme), yenidenAt), Number(satirReddi), DENEME_TAVANI, r.kaymak_id, r.takvim_rev)),
    gidenKutusuBuda: (simdi, olayAcik) => islem(() => gidenKutusuBuda(db, simdi, olayAcik)),
    aynaBildirimleriniDoldur: (simdi, limit) => islem(() => aynaBildirimiYaz(`
      SELECT t.tur,t.trakt_id,t.takvim_rev,t.veri FROM radar_takip a JOIN radar_takvim t USING(tur,trakt_id)
      LEFT JOIN radar_ayna_giden g USING(tur,trakt_id)
      WHERE t.aynalanan_rev=t.takvim_rev AND t.takvim_rev>coalesce(g.takvim_rev,0)
      ORDER BY a.tur,a.trakt_id LIMIT ?`).run(simdi, limit).changes),
    bekleyenAynaBildirimleri: (limit, simdi = Date.now()) => sql(`SELECT tur,trakt_id,takvim_rev,veri,deneme,cakisma_deneme FROM radar_ayna_giden
      WHERE veri IS NOT NULL AND terk=0 AND hazir_at<=? ORDER BY hazir_at,tur,trakt_id LIMIT ?`).all(simdi, limit),
    aynaBildirimiOnayla: (parti) => islem(() => {
      const onayla = sql('UPDATE radar_ayna_giden SET veri=NULL WHERE tur=? AND trakt_id=? AND takvim_rev=?');
      for (const r of parti) onayla.run(r.tur, r.trakt_id, r.takvim_rev);
    }),
    aynaBildirimiTerk: (r) => islem(() => sql(`UPDATE radar_ayna_giden SET terk=1
      WHERE tur=? AND trakt_id=? AND takvim_rev=? AND veri IS NOT NULL`).run(r.tur, r.trakt_id, r.takvim_rev)),
    aynaBildirimiErtele: (parti, simdi, ms, cakisma) => islem(() => {
      const ertele = sql(`UPDATE radar_ayna_giden SET deneme=deneme+?,cakisma_deneme=cakisma_deneme+?,hazir_at=?,terk=(? AND deneme+1>=?)
        WHERE tur=? AND trakt_id=? AND takvim_rev=? AND veri IS NOT NULL AND terk=0`);
      for (const r of parti) ertele.run(Number(!cakisma), Number(cakisma),
        simdi + Math.max(ms, gecikme(r.deneme + r.cakisma_deneme + 1)), Number(!cakisma),
        DENEME_TAVANI, r.tur, r.trakt_id, r.takvim_rev);
    }),
    bekleyenOlaylar: (limit) => sql(`SELECT g.id,g.olay FROM radar_giden g
      JOIN radar_takvim t ON t.tur=g.icerik_tur AND t.trakt_id=g.trakt_id
      JOIN radar_takip a ON a.tur=t.tur AND a.trakt_id=t.trakt_id
      WHERE g.terk=0 AND t.aynalanan_rev>=g.takvim_rev ORDER BY g.id LIMIT ?`).all(limit),
    olayTerk: (id) => islem(() => sql('UPDATE radar_giden SET terk=1 WHERE id=?').run(id)),
    olayOnayla: (parti) => islem(() => sql('DELETE FROM radar_giden WHERE id IN (SELECT value FROM json_each(?))')
      .run(JSON.stringify(parti.map((r) => r.id)))),
  };
}

module.exports = { depoAc, depoKur, tablolarVar, saglikOku, SEMA };
