const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { gzipSync } = require('node:zlib');
const { test } = require('node:test');
const { initArchive, getDb, closeArchive, transactionAsync } = require('../../server/archive/db');
const { diziDurumu, diziDurumunuYaz } = require('../../server/archive/diziDurumu');
const { archiveCatalogResponse } = require('../../server/archive/writer');
const { altAgacFazlari, kokSatirlari } = require('../../server/archive/aynaSatirlari');
const { diziDurumuBackfillTuru, diziDurumuBackfillAdimi, diziDurumuBackfillAynala } = require('../../server/radar/diziDurumuBackfill');

function arsivAc(t, eskiyiKur) {
  const kok = mkdtempSync(join(tmpdir(), 'kaymak-dizi-durumu-'));
  const eski = process.env.LAZYFETCH_ROOT;
  const eskiArsiv = process.env.ARCHIVE_ROOT;
  process.env.LAZYFETCH_ROOT = kok;
  delete process.env.ARCHIVE_ROOT;
  t.after(() => {
    closeArchive();
    if (eski === undefined) delete process.env.LAZYFETCH_ROOT;
    else process.env.LAZYFETCH_ROOT = eski;
    if (eskiArsiv !== undefined) process.env.ARCHIVE_ROOT = eskiArsiv;
    rmSync(kok, { recursive: true, force: true });
  });
  if (eskiyiKur) {
    const dizin = join(kok, 'archive');
    mkdirSync(dizin);
    const onceki = new DatabaseSync(join(dizin, 'katalog.db'));
    try { eskiyiKur(onceki); } finally { onceki.close(); }
  }
  assert.equal(initArchive().enabled, true);
  return getDb();
}

function durumOku(db, id) {
  return { ...db.prepare('SELECT yayin_durumu, durum_kaynak, durum_at FROM entities WHERE kaymak_id=?').get(id) };
}

test('TMDB durumları öncelikli, tanınmayan TMDB için Trakt yedek', () => {
  for (const [ham, beklenen] of [
    ['Returning Series', 'devam'], ['Ended', 'bitti'], ['Canceled', 'iptal'],
    ['In Production', 'yapimda'], ['Planned', 'planli'], ['Pilot', 'planli'],
  ]) {
    assert.deepEqual(diziDurumu(ham, 'returning series'), { durum: beklenen, kaynak: 'tmdb' });
  }
  assert.deepEqual(diziDurumu('unknown', 'upcoming'), { durum: 'planli', kaynak: 'trakt' });
  assert.deepEqual(diziDurumu(null, null), { durum: 'bilinmiyor', kaynak: null });
});

test('SQLite v3 göçü eski varlık ve payload satırını korur', (t) => {
  const yedek = gzipSync(Buffer.from('{"status":"Ended"}'));
  const db = arsivAc(t, (onceki) => {
    const sema = readFileSync(join(__dirname, '../../server/archive/schema.sql'), 'utf8')
      .replace(/^  (?:yayin_durumu|durum_kaynak|durum_at) +[^\n]*\n/gm, '')
      .replace("VALUES ('schema_version', '4');", "VALUES ('schema_version', '3');");
    onceki.exec(sema);
    onceki.exec("INSERT INTO entities(kaymak_id,type,title,created_at,updated_at) VALUES ('eski','show','Eski Dizi',11,12)");
    onceki.prepare(`
      INSERT INTO payloads(kaymak_id,provider,endpoint,lang,body,bytes_raw,bytes_gz,fetched_at,updated_at)
      VALUES ('eski','tmdb','tv_detail','tr',?,18,?,11,12)
    `).run(yedek, yedek.length);
  });
  assert.deepEqual(durumOku(db, 'eski'), { yayin_durumu: null, durum_kaynak: null, durum_at: null });
  assert.equal(db.prepare("SELECT updated_at FROM entities WHERE kaymak_id='eski'").get().updated_at, 12);
  assert.deepEqual(Buffer.from(db.prepare("SELECT body FROM payloads WHERE kaymak_id='eski'").get().body), yedek);
});

test('gerçek arşiv yazıcısı, kaynak önceliği ve zaman sırası iki aynada aynı sonucu üretir', async (t) => {
  const db = arsivAc(t);
  const trakt = (status, fetchedAt) => archiveCatalogResponse({
    provider: 'trakt', family: 'show_detail', path: '/shows/42', query: { extended: 'full', translations: 'tr' },
    data: { title: 'Dizi', ids: { trakt: 42, tmdb: 99 }, status }, fetchedAt,
  });
  const tmdb = (status, fetchedAt, language = 'tr-TR') => archiveCatalogResponse({
    provider: 'tmdb', family: 'tv_detail', path: '/tv/99', query: { language },
    data: { id: 99, name: 'Dizi', status }, fetchedAt,
  });
  const ilk = await trakt('returning series', 100);
  assert.equal(ilk.ok, true, JSON.stringify(ilk));
  const kok = ilk.kaymakId;
  assert.deepEqual(durumOku(db, kok), { yayin_durumu: 'devam', durum_kaynak: 'trakt', durum_at: 100 });
  assert.equal((await tmdb('Ended', 200)).kaymakId, kok);
  assert.equal((await tmdb('Ended', 300)).kaymakId, undefined);

  await trakt('in production', 500);
  await tmdb('pilot', 250, 'en-US');
  await tmdb('bilinmeyen', 600);
  assert.deepEqual(durumOku(db, kok), { yayin_durumu: 'bitti', durum_kaynak: 'tmdb', durum_at: 300 });

  const satir = altAgacFazlari(db, [kok])[0].satirlar[0];
  assert.equal(satir.yayin_durumu, 'bitti');
  assert.equal(satir.durum_kaynak, 'tmdb');
  assert.equal(satir.durum_at, '1970-01-01T00:00:00.300Z');
  assert.deepEqual((await kokSatirlari(db))[0], satir);
  const gecis = Date.now() + 1000;
  assert.equal(diziDurumunuYaz(db, { kaymakId: kok, provider: 'tmdb', endpoint: 'tv_detail', fetchedAt: 301, hamDurum: 'Ended' }, gecis), false);
  assert.equal(db.prepare('SELECT updated_at FROM entities WHERE kaymak_id=?').get(kok).updated_at, gecis);
  assert.equal(altAgacFazlari(db, [kok])[0].satirlar[0].durum_at, '1970-01-01T00:00:00.301Z');
});

test('Radar takvim işlemi durum alanlarını aynı arşiv yazımında günceller', async (t) => {
  const db = arsivAc(t);
  db.exec(require('../../server/radar/sema'));
  const trakt = { ids: { trakt: 14, tmdb: 28 }, title: 'Radar dizisi', status: 'returning series' };
  const tmdb = { id: 28, name: 'Radar dizisi', status: 'Ended', seasons: [] };
  const veri = {
    tur: 'show', trakt_id: 14, tmdbId: 28, trakt, tmdb, sezonlar: [], tmdbSezonlar: new Map(),
    hazir: [
      { is: { provider: 'trakt', family: 'show_detail', query: { translations: 'tr' }, data: trakt, fetchedAt: 150 } },
      { is: { provider: 'tmdb', family: 'tv_detail', query: { language: 'tr-TR' }, data: tmdb, fetchedAt: 151 } },
    ],
  };
  const sonuc = await archiveCatalogResponse({
    provider: 'radar', radar: { veri, beklenenRev: 0, simdi: 200, olayAcik: false },
  });
  assert.equal(sonuc.ok, true, JSON.stringify(sonuc));
  const { kaymak_id: id } = db.prepare("SELECT kaymak_id FROM radar_takvim WHERE tur='show' AND trakt_id=14").get();
  assert.deepEqual(durumOku(db, id), { yayin_durumu: 'bitti', durum_kaynak: 'tmdb', durum_at: 151 });

  veri.hazir[1].is = { ...veri.hazir[1].is, data: { ...tmdb, status: 'Canceled' }, fetchedAt: 400 };
  const eskiRev = await archiveCatalogResponse({
    provider: 'radar', radar: { veri, beklenenRev: 0, simdi: 401, olayAcik: false },
  });
  assert.equal(eskiRev.reason, 'eski_revizyon');
  assert.deepEqual(durumOku(db, id), { yayin_durumu: 'bitti', durum_kaynak: 'tmdb', durum_at: 151 });
});

test('backfill eşzamanlı işlemin geri alınan payload kaydını kalıcılaştırmaz', async (t) => {
  const db = arsivAc(t);
  db.exec("INSERT INTO entities(kaymak_id,type,created_at,updated_at) VALUES ('d-01','show',1,1)");
  const ham = Buffer.from('{"status":"Ended"}');
  const gz = gzipSync(ham);
  const geriAl = new Error('test rollback');
  let acildi;
  let devamEt;
  const basladi = new Promise((resolve) => { acildi = resolve; });
  const bekle = new Promise((resolve) => { devamEt = resolve; });
  const ucus = transactionAsync(async (h) => {
    h.prepare(`
      INSERT INTO payloads(kaymak_id,provider,endpoint,lang,body,bytes_raw,bytes_gz,fetched_at,updated_at)
      VALUES ('d-01','tmdb','tv_detail','tr',?,?,?,100,100)
    `).run(gz, ham.length, gz.length);
    acildi();
    await bekle;
    throw geriAl;
  });
  const geriAlindi = assert.rejects(ucus, geriAl);
  await basladi;
  const backfill = diziDurumuBackfillTuru(200);
  devamEt();
  await geriAlindi;
  assert.deepEqual(await backfill, { asama: 'arsiv', taranan: 1, degisen: 0 });
  assert.equal(durumOku(db, 'd-01').yayin_durumu, null);
});

test('bir Radar turu ağsız dilimleri işler ve takip kuyruğu sınırını aşmaz', async (t) => {
  const db = arsivAc(t);
  db.exec(require('../../server/radar/sema'));
  db.exec(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<41)
    INSERT INTO entities(kaymak_id,type,created_at,updated_at) SELECT 'd-'||i,'show',0,0 FROM n;
    INSERT INTO radar_takip(tur,trakt_id,tmdb_id,takipci)
    VALUES ('show',1,NULL,1),('show',2,NULL,1),('show',3,NULL,1),('show',4,NULL,1),('show',5,NULL,1)`);
  assert.deepEqual(await diziDurumuBackfillAdimi(100, true),
    { asama: 'takip', siralanan: 4, bitti: false, taranan: 41, degisen: 0 });
  assert.equal(db.prepare('SELECT count(*) n FROM radar_is').get().n, 4);
  assert.deepEqual(await diziDurumuBackfillAdimi(101, true), { asama: 'takip', siralanan: 1, bitti: true });
});

test('ağsız arşiv backfill imleci kaydeder, yeni takip görüntüsünü bekler ve Radar işlerini korur', async (t) => {
  const db = arsivAc(t);
  db.exec(require('../../server/radar/sema'));
  const varlik = db.prepare("INSERT INTO entities(kaymak_id,type,created_at,updated_at) VALUES (?,'show',0,0)");
  const esitlik = db.prepare("INSERT INTO external_ids(source,source_id,kaymak_id,first_seen_at,last_seen_at) VALUES ('trakt:show',?,?,1,1)");
  const takip = db.prepare("INSERT INTO radar_takip(tur,trakt_id,tmdb_id,takipci) VALUES ('show',?,NULL,1)");
  const yuk = db.prepare(`
    INSERT INTO payloads(kaymak_id,provider,endpoint,lang,body,bytes_raw,bytes_gz,fetched_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `);
  for (let i = 1; i <= 41; i++) {
    const id = 'd-' + String(i).padStart(2, '0');
    varlik.run(id);
    esitlik.run(String(i), id);
  }
  for (const i of [1, 2, 3, 4, 5, 41, 50]) takip.run(i);
  db.exec(`INSERT INTO radar_is(tur,trakt_id,oncelik,hazir_at,deneme,terk)
    VALUES ('show',2,2,123,0,0), ('show',5,1,123,5,1)`);
  db.exec("UPDATE entities SET yayin_durumu='devam',durum_kaynak='trakt',durum_at=150 WHERE kaymak_id='d-01'");
  const ham = Buffer.from('{"status":"Returning Series"}');
  const gz = gzipSync(ham);
  yuk.run('d-01', 'tmdb', 'tv_detail', 'tr', gz, ham.length, gz.length, 100, 100);
  yuk.run('d-41', 'tmdb', 'tv_detail', 'tr', gz, ham.length, gz.length, 100, 100);

  assert.deepEqual(await diziDurumuBackfillTuru(200), { asama: 'arsiv', taranan: 40, degisen: 1 });
  assert.equal(durumOku(db, 'd-01').durum_kaynak, 'tmdb');
  assert.equal(durumOku(db, 'd-41').yayin_durumu, null);
  assert.deepEqual(await diziDurumuBackfillTuru(201), { asama: 'arsiv', taranan: 1, degisen: 1 });
  assert.equal(durumOku(db, 'd-41').yayin_durumu, 'devam');
  assert.deepEqual(await diziDurumuBackfillTuru(202), { bekliyor: true });
  assert.deepEqual(await diziDurumuBackfillTuru(203, true), { asama: 'takip', siralanan: 3, bitti: false });
  assert.deepEqual(await diziDurumuBackfillTuru(204, true), { asama: 'takip', siralanan: 1, bitti: true });
  assert.equal(await diziDurumuBackfillTuru(205, true), null);
  assert.deepEqual(await diziDurumuBackfillAynala({ aynala: async () => ({ ok: false, reason: 'gecici' }) }),
    { bitti: false, neden: 'gecici' });
  assert.deepEqual(await diziDurumuBackfillAynala({ aynala: async () => ({ ok: true, tamamlandi: true, yazilan: 2, atlanan: 0 }) }),
    { bitti: true, yazilan: 2, atlanan: 0 });
  assert.deepEqual(await diziDurumuBackfillAynala({ aynala: async () => assert.fail('İkinci ayna yapılmaz') }), { bitti: true });

  const isler = db.prepare('SELECT trakt_id, oncelik, hazir_at FROM radar_is ORDER BY trakt_id').all();
  assert.deepEqual(isler.map((r) => r.trakt_id), [2, 3, 4, 5, 50]);
  assert.deepEqual({ ...isler[0] }, { trakt_id: 2, oncelik: 2, hazir_at: 123 });
  assert.deepEqual({ ...db.prepare('SELECT terk, deneme, oncelik FROM radar_is WHERE trakt_id=5').get() },
    { terk: 0, deneme: 0, oncelik: 0 });
});
