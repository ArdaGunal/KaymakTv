const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createAnlikAktarim } = require('../../server/archive/anlikAktarim');
const { getDb, closeArchive } = require('../../server/archive/db');
const { aynaBildirimleriniGonder } = require('../../server/radar/worker');
const { aynalariGonder } = require('../../server/radar/ayna');
const { depoAc, depoKur, SEMA } = require('../../server/radar/depo');
const { radarTuruKur } = require('../../server/radar/tur');
const { DAKIKA, DENEME_TAVANI, IS_PARTISI } = require('../../server/radar/ayar');

const simdi = Date.parse('2026-11-22T12:00:00Z');
const dur = () => {};
const bosTakvim = JSON.stringify({ satirlar: [] });
const hata = (status, tekrar) => Object.assign(new Error(`http_${status}`), {
  response: { status, headers: { 'retry-after': tekrar } },
});
const kabul = (parti) => ({ yazilan: parti.length, yinelenen: 0 });

function kur(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(SEMA);
  const depo = depoKur(db, (fn) => {
    db.exec('BEGIN');
    try {
      const sonuc = fn();
      db.exec('COMMIT');
      return sonuc;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }, true);
  const takvimEkle = (id, rev, onay, veri = bosTakvim) => db.prepare(`INSERT INTO radar_takvim
    (tur,trakt_id,kaymak_id,takvim_rev,aynalanan_rev,ayna_hazir_at,veri) VALUES ('show',?,?,?,?,0,?)`)
    .run(id, String(id), rev, onay, veri);
  const kuyrugaAl = (id, veri = bosTakvim) => db.prepare(`INSERT INTO radar_ayna_giden
    (tur,trakt_id,takvim_rev,veri) VALUES ('show',?,1,?)`).run(id, veri);
  const giden = (id) => db.prepare('SELECT * FROM radar_ayna_giden WHERE trakt_id=?').get(id);
  const dene = (at, ayna) => aynaBildirimleriniGonder(depo, { ayna }, dur, () => at);
  return { db, depo, takvimEkle, kuyrugaAl, giden, dene };
}

test('Eski katalog ACK SQL semantiği eşit, eski ve ileri revizyonda korunur', async (t) => {
  const { db, depo, takvimEkle, giden } = kur(t);
  takvimEkle(1, 7, 7);
  const takvim = () => depo.takvim({ tur: 'show', trakt_id: 1 });
  const onay = (takvim_rev) => depo.aynaOnayla({ kaymak_id: '1', takvim_rev }, simdi);
  await onay(7);
  assert.equal(takvim().ayna_bekliyor, 0);
  await onay(6);
  assert.equal(takvim().aynalanan_rev, 7);
  assert.equal(takvim().ayna_bekliyor, 1);
  await onay(8);
  assert.equal(takvim().ayna_bekliyor, 1);
  assert.equal(takvim().aynalanan_rev, 7);
  assert.equal(giden(1), undefined);

  db.exec(`UPDATE radar_takvim SET takvim_rev=8;
    CREATE TRIGGER ayna_bildirimi_hata BEFORE INSERT ON radar_ayna_giden BEGIN SELECT RAISE(ABORT,'test'); END;`);
  await onay(8);
  assert.equal(takvim().aynalanan_rev, 8);
  assert.equal(takvim().ayna_bekliyor, 0);
  assert.equal(depo.saglik().hataSayilari.ayna_bildirimi_yazim, 1);
});

test('Geçici hata hazır kökleri bekletmez; Retry-After, artan süre ve beşinci denemede terk', async (t) => {
  const { depo, kuyrugaAl, giden, dene } = kur(t);
  kuyrugaAl(1);
  await assert.rejects(dene(simdi, () => { throw hata(502, '120'); }), /http_502/);
  assert.equal(giden(1).hazir_at, simdi + 2 * DAKIKA);
  assert.equal(giden(1).deneme, 1);
  kuyrugaAl(2);
  await dene(simdi + DAKIKA, (parti) => {
    assert.deepEqual(parti.map((r) => r.trakt_id), [2]);
    return kabul(parti);
  });
  assert.equal(giden(2).veri, null);
  for (let i = 2; i <= DENEME_TAVANI; i++) {
    const at = giden(1).hazir_at;
    await assert.rejects(dene(at, () => { throw new Error('zaman asimi'); }), /zaman asimi/);
    assert.equal(giden(1).deneme, i);
    assert.equal(giden(1).hazir_at - at, 30_000 * 2 ** i);
  }
  assert.equal(depo.saglik().kuyruk.aynaBildirimi, 0);
  assert.equal(depo.saglik().kuyruk.terkAynaBildirimi, 1);
});

test('Eski takipli takvimler sınırlı doldurulur; yeni onay önce gider, takipsiz kök eklenmez', async (t) => {
  const { db, depo, takvimEkle, giden } = kur(t);
  const takip = Array.from({ length: IS_PARTISI + 1 }, (_, i) => ({ tur: 'show', trakt_id: i + 1, tmdb_id: null, takipci: 1 }));
  await depo.takipDegistir(takip, simdi);
  for (const { trakt_id } of takip) takvimEkle(trakt_id, 2, trakt_id === takip.length ? 0 : 2);
  takvimEkle(500, 1, 1);
  db.exec('DELETE FROM radar_is');
  await depo.aynaOnayla({ kaymak_id: String(takip.length), takvim_rev: 2 }, simdi);
  const gecisler = [];
  let katalogAynalari = 0;
  const kapilar = { yaz: true, olay: false };
  const tur = radarTuruKur({ kapilar, depo, saat: () => simdi, saglayicilar: {}, gunluk: { info: dur, warn: dur },
    aynala: async () => { katalogAynalari++; }, worker: {
      takip: async () => ({ satirlar: takip, sonraki: null }),
      ayna: async (parti) => {
        gecisler.push(...parti.map((r) => r.trakt_id));
        return kabul(parti);
      },
    } });
  await tur();
  await tur.aynala(() => false);
  assert.equal(katalogAynalari, 1);
  assert.equal(giden(1), undefined);
  assert.deepEqual(gecisler, []);
  kapilar.olay = true;
  await tur.aynala(() => false);
  assert.deepEqual(gecisler, [takip.length]);
  assert.equal(depo.saglik().kuyruk.aynaBildirimi, IS_PARTISI);
  assert.equal(giden(500), undefined);
});

test('409 deneme tavanından sonra da yeniden denenir ve başarılı yanıtla kapanır', async (t) => {
  const { depo, kuyrugaAl, giden, dene } = kur(t);
  kuyrugaAl(1);
  for (let i = 0; i <= DENEME_TAVANI; i++) {
    await assert.rejects(dene(Math.max(simdi, giden(1).hazir_at), () => { throw hata(409); }), /http_409/);
    assert.equal(giden(1).terk, 0);
  }
  assert.equal(depo.saglik().kuyruk.aynaBildirimi, 1);
  assert.equal(giden(1).deneme, 0);
  assert.equal(giden(1).cakisma_deneme, DENEME_TAVANI + 1);
  await assert.rejects(dene(giden(1).hazir_at, () => { throw hata(502); }), /http_502/);
  assert.equal(giden(1).terk, 0);
  assert.equal(giden(1).deneme, 1);
  await dene(giden(1).hazir_at, kabul);
  assert.equal(giden(1).veri, null);
});

test('Toplu 400/422 sınırlı yoklamayla durur, sağlık uyarısı yazar ve kayıtları korur', async (t) => {
  const { depo, kuyrugaAl } = kur(t);
  for (let i = 1; i <= IS_PARTISI; i++) kuyrugaAl(i);
  let at = simdi;
  let istekler = 0;
  let topluRet = true;
  const tur = radarTuruKur({ kapilar: { yaz: true, olay: true }, depo, saat: () => at,
    gunluk: { warn: dur }, saglayicilar: {}, worker: { ayna: async (parti) => {
      istekler++;
      if (topluRet) throw hata(istekler % 2 ? 400 : 422);
      return kabul(parti);
    } } });
  await tur.aynala(() => false);
  assert.equal(istekler, 8);
  assert.equal(depo.saglik().kuyruk.aynaBildirimi, IS_PARTISI);
  assert.equal(depo.saglik().kuyruk.terkAynaBildirimi, 0);
  assert.equal(depo.saglik().aynaBildirimiSonHata, 'ayna_sozlesme');
  assert.equal(depo.saglik().sonHata, null);
  at += DAKIKA - 1;
  await tur.aynala(() => false);
  assert.equal(istekler, 8);
  at++;
  topluRet = false;
  await tur.aynala(() => false);
  assert.equal(depo.saglik().aynaBildirimiSonHata, null);
  assert.equal(depo.saglik().kuyruk.aynaBildirimi, 0);
});

test('400/422 karışık partide tekil kökü ayırır; üye sınırı kökü parçalamaz', async (t) => {
  const { kuyrugaAl, giden, dene } = kur(t);
  kuyrugaAl(1);
  kuyrugaAl(2);
  await assert.rejects(dene(simdi, (parti) => {
    if (parti.some((r) => r.trakt_id === 2)) throw hata(parti.length === 1 ? 422 : 400);
    return kabul(parti);
  }), /http_422/);
  assert.equal(giden(1).veri, null);
  assert.equal(giden(2).terk, 1);

  const uyeler = Array.from({ length: 1200 }, (_, i) => ({ sezon: 1, bolum: i + 1, tarih: null, an_turu: 'tba', durum: 'tba' }));
  for (const id of [3, 4]) kuyrugaAl(id, JSON.stringify({ satirlar: uyeler }));
  const partiler = [];
  await dene(simdi, (parti) => {
    partiler.push(parti.map((r) => r.satirlar.length));
    return kabul(parti);
  });
  assert.deepEqual(partiler, [[1200], [1200]]);
});

test('Gece iptali boş uçuşa başarılı ACK vermez; başarılı eski ACK kendi görüntüsünü taşır', async (t) => {
  const { db, depo, takvimEkle, giden } = kur(t);
  await depo.takipDegistir([{ tur: 'show', trakt_id: 1, tmdb_id: null, takipci: 1 }], simdi);
  const eskiVeri = JSON.stringify({ satirlar: [{ sezon: 1, bolum: 1, tarih: '2026-11-22' }] });
  takvimEkle(1, 1, 0, eskiVeri);
  const aktar = createAnlikAktarim({ acik: () => true, fazlariKur: () => assert.fail('gece işi varken faz kuruldu') });
  let kontroller = 0;
  await aynalariGonder(depo, () => simdi, () => { if (++kontroller > 1) throw new Error('gece_isi'); }, aktar.hemen);
  assert.equal(giden(1), undefined);
  assert.equal(depo.takvim({ tur: 'show', trakt_id: 1 }).aynalanan_rev, 0);

  await aynalariGonder(depo, () => simdi, dur, async () => {
    db.prepare('UPDATE radar_takvim SET takvim_rev=2, veri=?').run(bosTakvim);
    return { ok: true };
  });
  assert.equal(giden(1).takvim_rev, 1);
  assert.equal(giden(1).veri, eskiVeri);
});

test('Önceki ayna kuyruğu şeması bekleyen ve terk kayıtlarını koruyarak yükselir', async (t) => {
  const kok = mkdtempSync(join(tmpdir(), 'kaymak-radar-ayna-'));
  const eskiKok = process.env.ARCHIVE_ROOT;
  process.env.ARCHIVE_ROOT = kok;
  t.after(() => {
    closeArchive();
    if (eskiKok === undefined) delete process.env.ARCHIVE_ROOT;
    else process.env.ARCHIVE_ROOT = eskiKok;
    rmSync(kok, { recursive: true, force: true });
  });
  getDb().exec(`CREATE TABLE radar_ayna_giden (tur TEXT NOT NULL, trakt_id INTEGER NOT NULL, takvim_rev INTEGER NOT NULL,
    veri TEXT, terk INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (tur,trakt_id)) STRICT;
    CREATE INDEX radar_ayna_giden_hazir ON radar_ayna_giden(takvim_rev,tur,trakt_id) WHERE veri IS NOT NULL AND terk=0;
    INSERT INTO radar_ayna_giden VALUES ('show',1,10,'{"satirlar":[]}',0),('show',2,20,'{"satirlar":[]}',1);`);
  const depo = await depoAc({ yaz: true, olay: true });
  assert.deepEqual(depo.bekleyenAynaBildirimleri(25, simdi).map((r) => [r.trakt_id, r.takvim_rev, r.deneme]), [[1, 10, 0]]);
  assert.equal(depo.saglik().kuyruk.terkAynaBildirimi, 1);
});
