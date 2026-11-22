const assert = require('node:assert/strict');
const { join } = require('node:path');
const { readFileSync } = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { baslat } = require('../yardimci');
const { depoAc, SEMA } = require('../../server/radar/depo');
const { kataloguCek } = require('../../server/radar/tazele');
const { takvimCikar, zamaniSinifla, olaylariCikar } = require('../../server/radar/takvim');
const { AYNA_BELIRSIZ_BEKLEME_MS, GIDEN_KUTUSU_TAVANI, GIDEN_KUTUSU_OMRU } = require('../../server/radar/ayar');
const { akisiGonder, partiGonder } = require('../../server/archive/mirror');
const { aynalariGonder } = require('../../server/radar/ayna');
const { olayGonder, aynaBildirimleriniGonder, workerIstemcisi } = require('../../server/radar/worker');
const { radarTuruKur } = require('../../server/radar/tur');
const { radarYaz, archiveQueue } = require('../../server/archive/queue');
const { closeArchive } = require('../../server/archive/db');
const { createAnlikAktarim } = require('../../server/archive/anlikAktarim');
const { altAgacFazlari } = require('../../server/archive/aynaSatirlari');
const { celiskiVarMi, BEKLEME_MS } = require('../../server/archive/tutarlilik');
const { readPayload } = require('../../server/archive/store');
const { resolveRequest } = require('../../server/lazyfetch/orchestrator');

const T = baslat('RADAR TAKVIM VE GIDEN KUTUSU');
process.env.ARCHIVE_ROOT = join(T.kok, 'arsiv');
const simdi = Date.parse('2026-11-21T15:00:00Z');
const A = '2026-12-05T21:15:00+03:00';
const B = '2026-12-06T20:00:00Z';
const TRAKT_A = '2026-12-05T18:15:00.000Z';
const film = { tur: 'movie', trakt_id: 7, tmdb_id: 70, takipci: 5 };
const dizi = { tur: 'show', trakt_id: 5, tmdb_id: 50, takipci: 5 };
const dur = () => {};
const saat = () => simdi;
const diziOzet = { ids: { trakt: 5, tmdb: 50 }, title: 'Dizi', aired_episodes: 0,
  airs: { day: 'Saturday', time: '21:15', timezone: 'Europe/Istanbul' } };
const sezon = (tarih, bolumler = [{ number: 1, ids: { trakt: 501 }, first_aired: tarih }], sayi = bolumler.length) =>
  ({ number: 1, ids: { trakt: 51 }, episode_count: sayi, episodes: bolumler });

(async () => {
  T.ok('Ofsetli Trakt ani UTC ve kesin; tarih-yalniz gece yarisina cevrilmez',
    zamaniSinifla(A, 'trakt').tarih === TRAKT_A && zamaniSinifla(A, 'trakt').an_turu === 'kesin' &&
    zamaniSinifla('2026-12-05', 'trakt').an_turu === 'yalniz_tarih');
  T.ok('Acik TBA yalniz null; ofsetsiz, hatali ve eksik tarih gecersiz',
    zamaniSinifla(null, 'trakt').an_turu === 'tba' &&
    ['2026-12-05T21:15:00', '2026-02-30', undefined].every((deger) => zamaniSinifla(deger, 'trakt').an_turu === null));
  const ilk = takvimCikar({ tur: 'show', trakt: diziOzet, sezonlar: [sezon(A)] });
  const eksik = takvimCikar({ tur: 'show', trakt: diziOzet, sezonlar: [sezon(A, [], 1)] }, ilk.satirlar);
  const silindi = takvimCikar({ tur: 'show', trakt: diziOzet, sezonlar: [sezon(A, [], 0)] }, eksik.satirlar);
  T.ok('Eksik yanit tarihi korur; dogrulanmis tam yanit siler',
    eksik.satirlar[1].durum === 'eksik_yanit' && eksik.satirlar[1].tarih === TRAKT_A &&
    silindi.satirlar[1].durum === 'silindi_dogrulandi' && silindi.satirlar[1].tarih === null);
  const tmdbTabani = takvimCikar({
    tur: 'show', trakt: diziOzet, sezonlar: [], tmdbBekleniyor: true,
    tmdb: { seasons: [{ id: 53, season_number: 2, episode_count: 1 }] },
    tmdbSezonlar: new Map([[2, { episodes: [{ id: 580, episode_number: 1, air_date: '2026-12-09' }] }]]),
  });
  const tmdbEksik = takvimCikar({ tur: 'show', trakt: diziOzet, sezonlar: [] }, tmdbTabani.satirlar);
  T.ok('TMDB eşlemesi düşerse eski takvim korunur',
    !tmdbEksik.tam && tmdbEksik.satirlar[1].durum === 'eksik_yanit' && tmdbEksik.satirlar[1].tarih === '2026-12-09');
  const gecersiz = takvimCikar({ tur: 'show', trakt: diziOzet, sezonlar: [sezon('bozuk')] }, ilk.satirlar);
  const ertelendi = takvimCikar({ tur: 'show', trakt: diziOzet, sezonlar: [sezon(null)] }, ilk.satirlar);
  const kesin = takvimCikar({ tur: 'show', trakt: diziOzet, sezonlar: [sezon(B)] }, ertelendi.satirlar);
  T.ok('Bozuk tarih eksik; bilinen tarih korunur; acik TBA erteler ve gecerli tarih kesinlestirir',
    !gecersiz.tam && gecersiz.satirlar[1].durum === 'eksik_yanit' && gecersiz.satirlar[1].tarih === TRAKT_A &&
    ertelendi.satirlar[1].durum === 'ertelendi' && kesin.satirlar[1].durum === 'kesin' &&
    ilk.airs.timezone === 'Europe/Istanbul');
  T.ok('Acik saglayici iptal durumu taninir',
    takvimCikar({ tur: 'movie', trakt: { released: null, status: 'canceled' } }).satirlar[0].durum === 'iptal');

  const depo = await depoAc({ yaz: true });
  await depo.takipDegistir([film, dizi], simdi);
  const filmCek = (tarih) => kataloguCek(film, {
    trakt: async () => ({ data: { ids: { trakt: 7 }, released: tarih, title: 'Film' } }),
    tmdb: async () => ({ data: { id: 70, release_date: tarih, title: 'Film' } }),
  }, dur, saat);
  const yazFilm = async (tarih, beklenenRev, at = simdi, olayAcik) => radarYaz({ veri: await filmCek(tarih), beklenenRev, simdi: at, olayAcik });
  const ilkYaz = await yazFilm('2026-12-04', 0);
  assert.equal(ilkYaz.ok, true, JSON.stringify(ilkYaz));
  T.ok('Ilk acilista yalniz temel cizgi yazilir', depo.saglik().kuyruk.olay === 0);
  assert.equal((await yazFilm('2026-12-05', 1)).ok, true);
  assert.equal((await yazFilm('2026-12-06', 2)).ok, true);
  const eskiYaz = await yazFilm('2026-12-10', 2);
  const r = depo.takvim(film);
  const ham = await readPayload({ kaymakId: r.kaymak_id, provider: 'trakt', endpoint: 'movie_detail', lang: 'tr' });
  T.ok('Eski revizyon arsiv ve takvimi ezemez', eskiYaz.reason === 'eski_revizyon' && r.takvim_rev === 3 && ham.data.released === '2026-12-06');
  assert.equal((await yazFilm('2026-12-05', 3)).ok, true);
  const varlikAt = depo.db.prepare('SELECT updated_at FROM entities WHERE kaymak_id=?');
  const at = varlikAt.get(r.kaymak_id).updated_at;
  assert.equal((await yazFilm('2026-12-05', 4, simdi + 1)).rev, 4);
  T.ok('Degismeyen takvim varlik tarihini oynatmaz; Trakt ham yukune TMDB kimligi eklenmez',
    varlikAt.get(r.kaymak_id).updated_at === at && !Object.hasOwn(ham.data.ids, 'tmdb'));
  let giden = depo.db.prepare('SELECT olay FROM radar_giden ORDER BY id').all().map((v) => JSON.parse(v.olay));
  T.ok('A-B-A uc farkli anahtar uretir; degismeyen yanit olay uretmez', giden.length === 3 &&
    new Set(giden.map((o) => o.olay_anahtari)).size === 3 && giden[0].veri.tarih === giden[2].veri.tarih);

  depo.db.exec("CREATE TRIGGER radar_yapay_hata BEFORE INSERT ON radar_giden BEGIN SELECT RAISE(ABORT,'sahte'); END");
  assert.equal((await yazFilm('2026-12-08', 4)).ok, false);
  depo.db.exec('DROP TRIGGER radar_yapay_hata');
  const sonra = await readPayload({ kaymakId: r.kaymak_id, provider: 'trakt', endpoint: 'movie_detail', lang: 'tr' });
  T.ok('Olay yazimi dusunce revizyon ve katalog birlikte geri alinir', depo.takvim(film).takvim_rev === 4 && sonra.data.released === '2026-12-05');
  assert.deepEqual(depo.bekleyenAynaBildirimleri(100), []);
  await depo.aynaOnayla({ ...r, goruntu: r });
  assert.equal(JSON.parse(depo.bekleyenAynaBildirimleri(100)[0].veri).satirlar[0].tarih, '2026-12-06');
  T.ok('Eski ayna ACK yeni revizyonu tamamlayamaz', depo.takvim(film).ayna_bekliyor === 1 && depo.bekleyenOlaylar(500).length === 2);
  await aynalariGonder(depo, () => simdi + 1, dur, async () => ({ ok: true, yazilan: 0, atlanan: 0 }));
  const aynaIstekleri = [];
  const worker = workerIstemcisi({ workerUrl: 'https://worker.invalid', sir: 'radar-sir', fetch: async (url, istek) => {
    assert.equal(url, 'https://worker.invalid/ic/radar/ayna');
    assert.equal(istek.method, 'POST');
    assert.equal(istek.headers['x-kaymak-sync-secret'], 'radar-sir');
    aynaIstekleri.push(istek.body);
    if (aynaIstekleri.length === 1) throw new Error('sahte ACK kaybi');
    return Response.json({ yazilan: 0, yinelenen: 1 });
  } });
  let aynaSaati = simdi + 1;
  const yeniTur = (yaz, olay, depo) => radarTuruKur({ kapilar: { yaz, olay }, depo, worker,
    saglayicilar: {}, saat: () => aynaSaati });
  await yeniTur(false, true, depo).aynala(() => false);
  await yeniTur(true, false, depo).aynala(() => false);
  assert.deepEqual(aynaIstekleri, []);
  await assert.rejects(aynaBildirimleriniGonder(depo, worker, dur, () => aynaSaati), /ACK kaybi/);
  const tekrar = await depoAc({ yaz: true });
  await yeniTur(true, true, tekrar).aynala(() => false);
  assert.equal(aynaIstekleri.length, 1);
  aynaSaati += 60_000;
  await yeniTur(true, true, tekrar).aynala(() => false);
  assert.equal(aynaIstekleri.length, 2);
  assert.equal(aynaIstekleri[0], aynaIstekleri[1]);
  assert.deepEqual(JSON.parse(aynaIstekleri[1]), { satirlar: [{ tur: 'movie', trakt_id: 7, takvim_rev: 4,
    satirlar: [{ sezon: null, bolum: null, tarih: '2026-12-05', an_turu: 'yalniz_tarih', durum: 'kesin' }] }] });
  assert.deepEqual((await depoAc({ yaz: true })).bekleyenAynaBildirimleri(100), []);
  T.ok('Ayna bildirimi iki kapiya bagli; ACK kaybi ayni revizyon ve govde ile tekrar edilir', true);

  depo.db.exec(`INSERT INTO radar_ayna_giden(tur,trakt_id,takvim_rev,veri)
    VALUES ('movie',8,1,'{"satirlar":[]}'),('show',9,2,'{"satirlar":[]}'),('show',10,3,'{"satirlar":[]}')`);
  const boyutDenemeleri = [];
  await assert.rejects(aynaBildirimleriniGonder(depo, { ayna: async (parti) => {
    boyutDenemeleri.push(parti.map((x) => x.trakt_id));
    if (parti.length > 1 || parti[0].trakt_id === 9) throw Object.assign(new Error('asiri_govde'), { status: 413 });
    if (parti[0].trakt_id === 8) {
      depo.db.exec("UPDATE radar_ayna_giden SET takvim_rev=2 WHERE tur='movie' AND trakt_id=8");
    }
    return { yazilan: parti.length, yinelenen: 0 };
  } }, dur), /http_413/);
  assert.deepEqual(boyutDenemeleri, [[8, 9, 10], [8], [9, 10], [9], [10]]);
  assert.deepEqual(depo.bekleyenAynaBildirimleri(100).map((x) => [x.trakt_id, x.takvim_rev]), [[8, 2]]);
  T.ok('Ayna 413 tam kokler arasinda bolunur; eski ACK yeni revizyonu silmez', true);
  const gonderilen = [];
  await assert.rejects(olayGonder(depo, { olay: async (parti) => {
    gonderilen.push(...parti);
    throw new Error('sahte ACK kaybi');
  } }));
  await olayGonder(depo, { olay: async (parti) => {
    assert.deepEqual(parti, gonderilen);
    return { yazilan: 0, yinelenen: parti.length };
  } });
  T.ok('ACK kaybi ayni kimliklerle tekrar; yinelenen cevabi kuyrugu temizler', depo.saglik().kuyruk.olay === 0);

  const istekler = [];
  const traktSezonYolu = '/shows/5/seasons';
  const traktSezonSorgusu = { extended: 'full,episodes' };
  const gercekSaat = Date.now;
  Date.now = () => simdi - 1;
  try {
    await resolveRequest({ provider: 'trakt', path: traktSezonYolu, query: traktSezonSorgusu,
      fetcher: async () => ({ data: [sezon(null)] }) });
    await archiveQueue.drain();
  } finally { Date.now = gercekSaat; }
  const veri = await kataloguCek(dizi, {
    trakt: async (yol) => {
      istekler.push(yol);
      return { data: yol.endsWith('/seasons') ? [sezon(A)] : diziOzet };
    },
    tmdb: async (yol) => {
      istekler.push(yol);
      if (yol === '/tv/50') return { data: { id: 50, seasons: [{ id: 53, season_number: 2, episode_count: 1 }], number_of_seasons: 1 } };
      return { data: { id: 53, season_number: 2, episodes: [{ id: 580, episode_number: 1, air_date: '2026-12-01' }] } };
    },
  }, dur, saat);
  const yaz = await radarYaz({ veri, beklenenRev: 0, simdi: simdi + 1 });
  assert.equal(yaz.ok, true, JSON.stringify(yaz));
  for (const girdi of yaz.girdiler) await girdi.yayinla?.();
  const onbellek = await resolveRequest({
    provider: 'trakt', path: traktSezonYolu, query: traktSezonSorgusu, fetcher: async () => assert.fail('Taze zarf varken istek'),
  });
  T.ok('Radar taze TTL varken de kaynağa gider ve onaydan sonra zarfı yeniler',
    onbellek.status === 'fresh' && onbellek.data[0].episodes[0].first_aired === A);
  const kok = depo.takvim(dizi).kaymak_id;
  const kapali = altAgacFazlari(depo.db, [kok]);
  process.env.RADAR_ACIK = process.env.RADAR_YAZ = '1';
  const fazlar = altAgacFazlari(depo.db, [kok]).flatMap((f) => f.satirlar);
  T.ok('Trakt kesin saat ve TMDB tek basina duyurdugu bolum aynaya gider',
    fazlar.some((e) => e.type === 'episode' && e.season_number === 1 && e.first_aired === TRAKT_A) &&
    fazlar.some((e) => e.type === 'episode' && e.season_number === 2 && e.first_aired === '2026-12-01T00:00:00.000Z') &&
    istekler.join(',') === '/shows/5,/shows/5/seasons,/tv/50,/tv/50/season/2');

  delete process.env.RADAR_ACIK;
  delete process.env.RADAR_YAZ;
  delete process.env.RADAR_OLAY;
  T.ok('Kapilar kapalidan aciga ve tekrar kapaliya: ayna eski ciktiyi aynen verir',
    JSON.stringify(altAgacFazlari(depo.db, [kok])) === JSON.stringify(kapali) &&
    !kapali.flatMap((f) => f.satirlar).some((s) => s.season_number === 2 && s.first_aired));
  process.env.RADAR_ACIK = process.env.RADAR_YAZ = '1';
  const temizVeri = depo.takvim(dizi).veri;
  const eksikYaz = await radarYaz({ veri: { ...veri, tmdbSezonlar: new Map([[2, null]]) },
    beklenenRev: 1, simdi: simdi + 5 });
  const eksikSatir = JSON.parse(depo.takvim(dizi).veri).satirlar.find((r) => r.sezon === 2 && r.bolum === 1);
  const eksikFaz = altAgacFazlari(depo.db, [kok]).flatMap((r) => r.satirlar)
    .find((r) => r.type === 'episode' && r.season_number === 2);
  const bellek = new DatabaseSync(':memory:');
  try {
    bellek.exec(readFileSync(join(__dirname, '../../server/archive/schema.sql'), 'utf8'));
    bellek.exec(SEMA);
    bellek.prepare("INSERT INTO entities (kaymak_id,type,created_at,updated_at) VALUES ('d','show',0,0)").run();
    bellek.prepare("INSERT INTO entities (kaymak_id,type,parent_id,season_number,created_at,updated_at) VALUES ('s','season','d',2,0,0)").run();
    bellek.prepare("INSERT INTO entities (kaymak_id,type,parent_id,season_number,episode_number,created_at,updated_at) VALUES ('b','episode','s',2,1,0,0)").run();
    bellek.prepare("INSERT INTO radar_takip VALUES ('show',5,50,1)").run();
    bellek.prepare("INSERT INTO radar_takvim (tur,trakt_id,kaymak_id,takvim_rev,kaynak_at,ayna_hazir_at,veri) VALUES ('show',5,'d',2,?,0,?)")
      .run(simdi + 5, JSON.stringify({ satirlar: [eksikSatir] }));
    const bellekFazi = altAgacFazlari(bellek, ['d']).flatMap((r) => r.satirlar).find((r) => r.kaymak_id === 'b');
    T.ok('TMDB-yalniz 2026-12-01 eksik yanittan sonra disk ve bellek aynasinda kalir',
      eksikYaz.ok && !eksikYaz.tam && eksikSatir.durum === 'eksik_yanit' && eksikSatir.ayna_kaynak_at === simdi + 1 &&
      eksikFaz.first_aired === '2026-12-01T00:00:00.000Z' && bellekFazi.first_aired === eksikFaz.first_aired);
  } finally { bellek.close(); }
  const aynaBolum = () => altAgacFazlari(depo.db, [kok]).flatMap((f) => f.satirlar)
    .find((r) => r.type === 'episode' && r.season_number === 2)?.first_aired;
  const takvimYamasi = depo.db.prepare('UPDATE radar_takvim SET veri=? WHERE kaymak_id=?');
  const eski = JSON.parse(temizVeri);
  const tmdbBolumu = eski.satirlar.find((r) => r.sezon === 2 && r.bolum === 1);
  tmdbBolumu.durum = 'eksik_yanit';
  takvimYamasi.run(JSON.stringify(eski), kok);
  const eksikAyna = aynaBolum();
  takvimYamasi.run(temizVeri, kok);
  await depo.takipDegistir([film], simdi);
  const takipsizAyna = aynaBolum();
  await depo.takipDegistir([film, dizi], simdi);
  depo.db.prepare("UPDATE radar_is SET terk=1 WHERE tur='show' AND trakt_id=5").run();
  const terkAyna = aynaBolum();
  depo.db.prepare("DELETE FROM radar_is WHERE tur='show' AND trakt_id=5").run();
  const hamDamga = depo.db.prepare("UPDATE payloads SET fetched_at=? WHERE kaymak_id=? AND endpoint='show_seasons'");
  hamDamga.run(simdi+6, kok);
  const yeniArsivAyna = aynaBolum();
  hamDamga.run(simdi, kok);
  T.ok('Eksik, takipsiz ve terk yuvalar elenir; ilgisiz yeni Trakt yukunde TMDB tarihi kalir',
    [eksikAyna, takipsizAyna, terkAyna].every((v) => v === null) && yeniArsivAyna === '2026-12-01T00:00:00.000Z');

  const hashA = olaylariCikar(film, [], takvimCikar({ tur: 'movie', trakt: { released: '2026-12-05' } }), 2, simdi)[0];
  const hashB = olaylariCikar(film, [], takvimCikar({ tur: 'movie', trakt: { released: '2026-12-07' } }), 2, simdi)[0];
  T.ok('Geri donen ayni revizyon farkli icerikte anahtari tekrar kullanmaz', hashA.olay_anahtari !== hashB.olay_anahtari);

  const keepAlive = setInterval(() => {}, 100);
  try {
    let basladi, birak;
    const baslangic = new Promise((r) => { basladi = r; });
    const bekle = new Promise((r) => { birak = r; });
    const gorulen = [];
    const aktar = createAnlikAktarim({ acik: () => true, gonder: async (gruplar) => {
      gorulen.push(gruplar.flatMap((f) => f.satirlar).find((r) => r.type === 'movie')?.first_aired);
      if (gorulen.length === 1) { basladi(); await bekle; }
      return { ok: true, yazilan: 0, atlanan: 0 };
    } });
    const filmKok = depo.takvim(film).kaymak_id;
    const eskiGonderim = aktar.hemen(filmKok);
    await baslangic;
    const bekleyenYazim = radarYaz({ veri: await filmCek('2026-12-12'), beklenenRev: 4, simdi: simdi + 20 });
    await new Promise((r) => setImmediate(r));
    assert.equal(depo.takvim(film).takvim_rev, 4);
    birak();
    assert.equal((await eskiGonderim).revler[filmKok], 4);
    assert.equal((await bekleyenYazim).rev, 5);
    assert.equal((await aktar.hemen(filmKok)).revler[filmKok], 5);
    T.ok('Anlik katalog gonderimi ile Radar commit sirali; sonraki gonderim son revizyonu okur',
      gorulen.join(',') === '2026-12-05T00:00:00.000Z,2026-12-12T00:00:00.000Z');
  } finally {
    clearInterval(keepAlive);
    delete process.env.RADAR_ACIK;
    delete process.env.RADAR_YAZ;
  }

  process.env.RADAR_ACIK = process.env.RADAR_YAZ = '1';
  try {
    let saatDegeri = simdi + 20;
    let zamaniBildir;
    const zamanAsimiYazildi = new Promise((r) => { zamaniBildir = r; });
    const filmKok = depo.takvim(film).kaymak_id;
    const gidenTarihler = [];
    const cfg = { db: depo.db, workerUrl: 'https://worker.invalid', saat: () => saatDegeri, fetch: async (_, opts) => {
      const { faz, satirlar } = JSON.parse(opts.body);
      if (faz === 'entities') {
        gidenTarihler.push(satirlar[0].first_aired);
        if (gidenTarihler.length === 1) throw new DOMException('sahte zaman asimi', 'TimeoutError');
      }
      return { ok: true, json: async () => ({ yazilan: satirlar.length }) };
    } };
    const aktar = createAnlikAktarim({ acik: () => true, saat: cfg.saat, gonder: async (fazlar) => {
      const sayac = { yazilan: 0, atlanan: 0 };
      for (const { faz, satirlar } of fazlar) {
        const r = await akisiGonder(cfg, faz, satirlar, sayac);
        if (r.reason === 'ayna_belirsiz') zamaniBildir(r);
        if (!r.ok) return r;
      }
      return { ok: true, ...sayac };
    } });
    const once = aktar.hemen(filmKok);
    const belirsiz = await zamanAsimiYazildi;
    const ara = await yazFilm('2026-12-13', 5, simdi + 21);
    assert.equal(ara.rev, 6);
    const son = await yazFilm('2026-12-14', 6, simdi + 22);
    assert.equal(son.rev, 7);
    saatDegeri = belirsiz.yenidenAt - 1;
    const erkenAyna = await partiGonder(cfg, 'entities', [{ kaymak_id: filmKok }]);
    assert.equal(erkenAyna.reason, 'ayna_belirsiz');
    assert.equal((await aktar.hemen(filmKok)).reason, 'ayna_belirsiz');
    assert.equal(gidenTarihler.length, 1);
    saatDegeri++;
    const [birinci, ikinci] = await Promise.all([once, aktar.hemen(filmKok)]);
    T.ok('Zaman asimi bekletir; iki yeni revizyondan yalniz gunceli tek kez gonderilir',
      AYNA_BELIRSIZ_BEKLEME_MS >= 60_000 && birinci.reason === 'ayna_belirsiz' && ikinci.revler[filmKok] === 7 &&
      gidenTarihler.join(',') === '2026-12-12T00:00:00.000Z,2026-12-14T00:00:00.000Z');
  } finally {
    delete process.env.RADAR_ACIK;
    delete process.env.RADAR_YAZ;
  }

  let ortamSaati = simdi + 2 * AYNA_BELIRSIZ_BEKLEME_MS;
  const filmKok = depo.takvim(film).kaymak_id;
  const hataGonder = (fetch) => partiGonder({ db: depo.db, workerUrl: 'https://worker.invalid', saat: () => ortamSaati, fetch },
    'entities', [{ kaymak_id: filmKok }]);
  const hataYukselten = (hata) => async () => { throw hata; };
  for (const code of ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']) {
    const r = await hataGonder(hataYukselten(new TypeError('fetch failed', { cause: { code } })));
    assert.equal(r.reason, 'network', code);
  }
  let hemenGitti = false;
  await hataGonder(async () => { hemenGitti = true; return { ok: true, json: async () => ({ yazilan: 1 }) }; });
  T.ok('DNS ve ECONNREFUSED hemen guvenli tekrar verir', hemenGitti);
  for (const hata of [
    new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } }),
    new Error('socket hang up'),
    new TypeError('fetch failed', { cause: new AggregateError([{ code: 'ECONNREFUSED' }, { code: 'UND_ERR_SOCKET' }]) }),
  ]) {
    const r = await hataGonder(hataYukselten(hata));
    assert.equal(r.reason, 'ayna_belirsiz');
    assert.equal(r.yenidenAt, ortamSaati + AYNA_BELIRSIZ_BEKLEME_MS);
    const bekliyor = await hataGonder(async () => assert.fail('Belirsiz ucus tekrar gonderildi'));
    assert.equal(bekliyor.reason, 'ayna_belirsiz');
    ortamSaati += AYNA_BELIRSIZ_BEKLEME_MS;
  }
  const govde = await hataGonder(async () => ({
    ok: true, json: hataYukselten(new TypeError('terminated', { cause: { code: 'UND_ERR_SOCKET' } })),
  }));
  T.ok('Reset, socket hang up ve yanit govdesindeki kopma 75 saniye belirsiz ucusta kalir',
    govde.reason === 'ayna_belirsiz' && govde.yenidenAt === ortamSaati + AYNA_BELIRSIZ_BEKLEME_MS);

  const olayEkle = depo.db.prepare("INSERT INTO radar_giden (olay_anahtari,icerik_tur,trakt_id,takvim_rev,olay) VALUES (?,'movie',7,7,?)");
  await depo.islem(() => {
    depo.db.exec('DELETE FROM radar_giden');
    const eskiAt = new Date(simdi - GIDEN_KUTUSU_OMRU - 1000).toISOString();
    const tazeAt = new Date(simdi - 1000).toISOString();
    for (let i = 0; i < 2; i++) olayEkle.run('eski-' + i, JSON.stringify({ tespit_at: eskiAt }));
    for (let i = 0; i < GIDEN_KUTUSU_TAVANI + 1; i++) olayEkle.run('taze-' + i, JSON.stringify({ tespit_at: tazeAt }));
  });
  assert.equal((await yazFilm('2026-12-15', 7, simdi, true)).rev, 8);
  const acikKuyruk = depo.saglik().kuyruk;
  assert.equal((await yazFilm('2026-12-16', 8, simdi, false)).rev, 9);
  const kapaliKuyruk = depo.saglik().kuyruk;
  T.ok('Olay kapisi acikken budama yok; kapaliyken 7 gun ve 5000 satir tavani atomik uygulanir',
    acikKuyruk.olay === GIDEN_KUTUSU_TAVANI + 4 && acikKuyruk.olayBudanan === 0 &&
    kapaliKuyruk.olay === GIDEN_KUTUSU_TAVANI && kapaliKuyruk.olayBudanan === 5 &&
    !depo.db.prepare("SELECT 1 FROM radar_giden WHERE olay_anahtari LIKE 'eski-%' OR olay_anahtari='taze-0'").get());
  await depo.gidenKutusuBuda(simdi + GIDEN_KUTUSU_OMRU + 1000);
  T.ok('Periyodik budama yeni olay yokken de calisir ve toplam budama sayaci kalir',
    depo.saglik().kuyruk.olay === 0 && depo.saglik().kuyruk.olayBudanan === GIDEN_KUTUSU_TAVANI + 5);

  const karsilastir = (ozet) => celiskiVarMi({
    takvimBakimi: true,
    ozet, ozetAt: simdi, sezonlar: [sezon(null)], sezonlarAt: simdi - 2 * BEKLEME_MS, simdi,
  });
  const gunFarki = celiskiVarMi({
    takvimBakimi: true, yayinDilimi: 'America/Los_Angeles',
    ozet: { next_episode_to_air: { season_number: 1, episode_number: 1, air_date: '2026-12-05' } },
    ozetAt: simdi, sezonlar: [sezon('2026-12-06T05:00:00Z')], sezonlarAt: simdi - 2 * BEKLEME_MS, simdi,
  });
  T.ok('TMDB yerel gunu Trakt UTC gunune takilmaz; varsayilan politika kapali',
    !gunFarki.celiski && celiskiVarMi({ ozet: {}, sezonlar: [] }).neden === 'veri_yok');
  T.ok('Yayimlanmis sayi sabitken yeni sezon ve gelecekteki tarih celiski olur',
    karsilastir({ aired_episodes: 0, next_episode: { season: 2, number: 1 } }).neden === 'yeni_sezon' &&
    karsilastir({ aired_episodes: 0, next_episode: { season: 1, number: 1, first_aired: A } }).neden === 'gelecek_tarih');
})().catch((e) => { console.error(e); T.ok('beklenmeyen hata', false); })
  .finally(() => { closeArchive(); T.bitir(); });
