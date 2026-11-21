const assert = require('node:assert/strict');
const { dirname, join } = require('node:path');
const { mkdirSync, unlinkSync, writeFileSync } = require('node:fs');
const { baslat } = require('../yardimci');
const { depoAc } = require('../../server/radar/depo');
const { AKISLAR, GUN, SAAT, AYNA_BELIRSIZ_BEKLEME_MS, GIDEN_KUTUSU_OMRU } = require('../../server/radar/ayar');
const { akisiTara } = require('../../server/radar/akis');
const { aynalariGonder } = require('../../server/radar/ayna');
const { kataloguCek } = require('../../server/radar/tazele');
const { olayGonder } = require('../../server/radar/worker');
const { radarTuruKur } = require('../../server/radar/tur');
const { closeArchive } = require('../../server/archive/db');
const { archiveQueue, radarYaz } = require('../../server/archive/queue');
const { aynaSirala } = require('../../server/archive/aynaKilidi');
const { createAnlikAktarim } = require('../../server/archive/anlikAktarim');
const { partiGonder } = require('../../server/archive/mirror');
const { altAgacFazlari, haritalariKur } = require('../../server/archive/aynaSatirlari');
const { upsertPayload } = require('../../server/archive/store');
const { tazeYanitHazirla } = require('../../server/lazyfetch/fetchAndStore');
const { buildCacheKey } = require('../../server/lazyfetch/key');
const { getLazyFetchDir } = require('../../server/lazyfetch/paths');
const { memoryCache } = require('../../server/lazyfetch/state');
const { TRAKT_OZET } = require('../../server/radar/ayar');
const { radarKilidi, geceIsi, geceBekliyor } = require('../../server/zamanlayici/geceKilidi');

const T = baslat('RADAR KOR DENETIM');
process.env.ARCHIVE_ROOT = join(T.kok, 'arsiv');
process.env.RADAR_ACIK = process.env.RADAR_YAZ = '1';
const simdi = Date.parse('2026-11-21T15:00:00Z');
const dur = () => {};
const gunluk = { info: dur, warn: dur };
const film = (trakt_id) => ({ tur: 'movie', trakt_id, tmdb_id: null, takipci: 1 });
const ilk = film(11);
const ikinci = film(22);
const ozet = (is, released = '2026-12-01') => ({ ids: { trakt: is.trakt_id }, title: 'Test', released });
const girdi = (path, data, fetchedAt, query = {}) => tazeYanitHazirla({ provider: 'trakt', path, query, yanit: { data }, fetchedAt });
const filmYaz = (is, trakt, rev, at = simdi) => radarYaz({ veri: { ...is, trakt,
  hazir: [girdi('/movies/' + is.trakt_id, trakt, at, { translations: 'tr' })] }, beklenenRev: rev, simdi: at });

async function aynalar(depo) {
  await depo.takipDegistir([ilk, ikinci], simdi);
  for (const is of [ilk, ikinci]) assert.equal((await filmYaz(is, ozet(is), 0)).ok, true);
  const a = depo.takvim(ilk).kaymak_id;
  const b = depo.takvim(ikinci).kaymak_id;
  const tarih = () => altAgacFazlari(depo.db, [a])[0].satirlar[0].first_aired;
  const ham = (lang, released, fetchedAt) => upsertPayload({
    kaymakId: a, provider: 'trakt', endpoint: 'movie_detail', lang, fetchedAt, data: ozet(ilk, released),
  });
  await ham('tr', '2026-12-02', simdi);
  assert.equal(tarih(), '2026-12-01T00:00:00.000Z');
  await ham('-', '2026-12-04', simdi + 2);
  await ham('zz', '2026-02-30', simdi + 4);
  const harita = haritalariKur(depo.db);
  T.ok('Taze dilsiz tarih eski Turkceyi gecer, gecersiz daha yeni kayit damgayi sifirlamaz',
    tarih() === '2026-12-04T00:00:00.000Z' && harita.firstAiredAt.get(a) === simdi + 2);
  await ham('de', '2026-12-05', simdi + 5);
  assert.equal((await filmYaz(ilk, { ...ozet(ilk), status: 'Canceled' }, 1, simdi + 3)).ok, true);
  await ham('tr', '2026-12-06', simdi + 4);
  T.ok('Film iptali daha yeni ham arsiv tarihine karsi korunur', tarih() === null);

  let basladi, devam;
  const baslangic = new Promise((r) => { basladi = r; });
  const bekle = new Promise((r) => { devam = r; });
  const ilkUcus = partiGonder({ db: depo.db, saat: () => simdi, workerUrl: 'https://worker.invalid', fetch: async () => {
    basladi();
    await bekle;
    return { ok: true, json: async () => ({ yazilan: 1, atlanan: 0 }) };
  } }, 'entities', [{ kaymak_id: a }]);
  await baslangic;
  const at = simdi + 60_000 + AYNA_BELIRSIZ_BEKLEME_MS;
  const kilit = () => depo.db.prepare('SELECT value FROM meta WHERE key=?').get('ayna_belirsiz:' + a);
  assert.equal(Number(kilit().value), at);
  const sonraki = await partiGonder({ db: depo.db, saat: () => simdi + 1,
    fetch: () => assert.fail('Kalici on kilit asildi') }, 'entities', [{ kaymak_id: a }]);
  devam();
  assert.equal((await ilkUcus).ok, true);
  T.ok('HTTP tamamlanmadan on kilit SQLite icinden okunur; kesin cevap kilidi kaldirir', sonraki.yenidenAt === at && !kilit());

  let birak;
  const ayna = aynaSirala(() => new Promise((r) => { birak = r; }), true);
  assert.equal((await radarYaz({ beklemeYok: true })).reason, 'ayna_mesgul');
  const bekleyenRadar = filmYaz(ilk, ozet(ilk), 2, simdi + 6);
  let normalArsiv;
  try {
    normalArsiv = await new Promise((tamamla) => archiveQueue.enqueue({
      provider: 'trakt', family: 'movie_detail', path: '/movies/33', query: { extended: 'full', translations: 'tr' },
      data: ozet(film(33)), fetchedAt: simdi, tamamla,
    }));
  } finally { birak(); }
  await ayna;
  await bekleyenRadar;
  T.ok('Ayna kilidini bekleyen Radar, LazyFetch arsiv kuyrugunu tutmaz', normalArsiv.ok);

  const keepAlive = setInterval(dur, 100);
  const gruplar = [];
  try {
    const aktar = createAnlikAktarim({ acik: () => true, fazlariKur: (kokler) => [{ satirlar: kokler }],
      gonder: async ([{ satirlar }]) => { gruplar.push(satirlar); return { ok: true, atlanan: Number(satirlar.includes(a)) }; } });
    for (let i = 0; i < 5; i++) {
      await assert.rejects(aynalariGonder(depo, () => simdi + GUN + i * SAAT, dur, aktar.hemen), /ayna_onaysiz/);
    }
    let basladiMi = false;
    const geceAktar = createAnlikAktarim({ acik: () => true, fazlariKur: () => { basladiMi = true; return []; } });
    assert.equal((await geceAktar.hemen(b, { dur: () => { throw new Error('gece_isi'); } })).reason, 'gece_isi');
    T.ok('Gonderim aninda gece durumu Radar ucusunu engeller', !basladiMi);
  } finally { clearInterval(keepAlive); }
  T.ok('Ortak atlanan yaniti tekil koklere ayrilir; saglam ACK alir, bozuk kok terk edilir',
    gruplar[0].length === 2 && gruplar.some((g) => g.length === 1 && g[0] === b) &&
    depo.takvim(ikinci).ayna_bekliyor === 0 && depo.takvim(ilk).ayna_bekliyor === 2);
}

async function akislariDogrula(depo) {
  const akis = AKISLAR.find((a) => a.ad === 'trakt_movie');
  const once = simdi - 2 * SAAT;
  await depo.akisiKaydet(akis, once, [ilk.trakt_id], null);
  for (let i = 0; i < 5; i++) await depo.isiErtele(depo.hazirIsler(simdi + GUN, 10).find((r) => r.trakt_id === ilk.trakt_id), simdi, 0);
  assert.equal(depo.saglik().kuyruk.terkIs, 1);
  await depo.akisiKaydet(akis, once, [ilk.trakt_id], null);
  assert.equal(depo.hazirIsler(simdi, 10).find((r) => r.trakt_id === ilk.trakt_id).deneme, 0);
  const hata429 = Object.assign(new Error('limit'), { response: { status: 429, headers: { 'retry-after': '120' } } });
  const worker = { takip: async () => ({ satirlar: [ilk], sonraki: null }) };
  await radarTuruKur({ kapilar: { yaz: true }, depo, worker, saat: () => simdi, gunluk,
    saglayicilar: { trakt: async () => { throw hata429; } } })();
  const ertelenen = depo.db.prepare('SELECT deneme,terk,hazir_at FROM radar_is WHERE trakt_id=?').get(ilk.trakt_id);
  T.ok('Yeni sinyal terk isi canlandirir ve HTTP 429 deneme harcamadan Retry-After uygular',
    ertelenen.deneme === 0 && ertelenen.terk === 0 && ertelenen.hazir_at === simdi + 120_000);

  const olcumAkisi = AKISLAR[0];
  const takip = await depoAc({ olcumKalici: true });
  await takip.akisiKaydet(olcumAkisi, once, [], null, 1);
  closeArchive();
  const geri = await depoAc({ olcumKalici: true });
  const pencere = await akisiTara({ depo: geri, akis: olcumAkisi, simdi, dur,
    cek: async () => ({ data: { page: 1, total_pages: 0, results: [] } }) });
  const yazim = await depoAc({ olcumKalici: true, yaz: true });
  T.ok('SQLite yeniden acilinca olcum imleci kullanilir; yazimda yalniz eksik imlec devralinir ve telafi acilir',
    pencere.baslangic === new Date(once).toISOString() && yazim.imlec(olcumAkisi.ad).at === simdi &&
    yazim.imlec(olcumAkisi.ad).telafi_son_id === 0 && yazim.imlec(akis.ad).at === once);
  const daralma = await akisiTara({ depo: yazim, akis, simdi, dur, cek: async (_, { page }) => ({
    data: page === 1 ? [{ ids: { trakt: ilk.trakt_id } }] : [],
    headers: { 'x-pagination-page': page, 'x-pagination-page-count': page === 1 ? 159 : 1, 'x-start-date': '2026-11-21' },
  }) });
  T.ok('Yeni son sayfanin disina dusen daralma sinirli telafi acar', daralma.sayfaDaraldi && daralma.telafi);
  let at = simdi;
  let cagrilar = 0;
  const scan = radarTuruKur({ kapilar: {}, depo: await depoAc({}), gunluk, saat: () => at,
    worker: { takip: async () => ({ satirlar: [], sonraki: null }) },
    saglayicilar: { tmdb: async (yol) => {
      if (yol !== '/tv/changes') return { data: { page: 1, total_pages: 0, results: [] } };
      if (++cagrilar === 1) at += 2 * 60_000;
      throw Object.assign(new Error('sahte akis hatasi'), { status: 503 });
    } },
  });
  await scan();
  at += 30_000;
  await scan();
  assert.equal(cagrilar, 1);
  at += 30_000;
  await scan();
  T.ok('Yavas sayfa hatasinda akis yeniden deneme suresi hatanin alindigi anda baslar', cagrilar === 2);
  return yazim;
}

async function bakim(depo) {
  const bolum = (id, tarih) => ({ number: 1, ids: { trakt: id }, first_aired: tarih });
  const sezon = (no, episodes, count = episodes.length) => ({ number: no, ids: { trakt: 700 + no }, episode_count: count, episodes });
  const dizi = { tur: 'show', trakt_id: 777, tmdb_id: null };
  const yaz = (sezonlar, status, rev) => radarYaz({ veri: { ...dizi, trakt: { ids: { trakt: 777 }, status }, sezonlar,
    hazir: [girdi('/shows/777/seasons', sezonlar, simdi + rev)] }, beklenenRev: rev, simdi: simdi + rev });
  const normal = sezon(1, [bolum(810, '2026-12-04')]);
  const ozel = sezon(0, [], 2);
  assert.equal((await yaz([ozel, normal], 'Returning', 0)).tam, true);
  const kismi = await yaz([ozel, sezon(1, [], 1), sezon(2, [bolum(820, '2026-12-05')])], 'Returning', 1);
  const agac = () => altAgacFazlari(depo.db, [depo.takvim(dizi).kaymak_id]).flatMap((f) => f.satirlar);
  const a = agac();
  T.ok('Eksik Specials isi bozmaz; kismi ham yanit yayimlanmaz ve saglam sezonun kimligi yazilir',
    !kismi.tam && kismi.girdiler.length === 0 && a.some((e) => e.type === 'episode' && e.season_number === 2));
  const cakismali = await yaz([normal, sezon(3, [bolum(810, '2026-12-05')]), sezon(4, [bolum(840, '2026-12-06')])], 'Returning', 2);
  T.ok('Kimlik cakismasi saglam komsu sezonun yazilmasini engellemez',
    cakismali.ok && cakismali.cakisma && !cakismali.tam && agac().some((e) => e.type === 'episode' && e.season_number === 4));
  const program = [sezon(1, [bolum(810, '2026-10-01')]),
    sezon(2, [bolum(820, '2026-12-05T17:00:00Z'), { ...bolum(821, null), number: 2 }])];
  assert.equal((await yaz(program, 'Returning', 3)).rev, 4);
  await depo.takipDegistir([ilk, ikinci, { ...dizi, takipci: 1 }], simdi);
  assert.equal((await yaz(program, 'cAnCeLed', 4)).rev, 5);
  const satirlar = JSON.parse(depo.takvim(dizi).veri).satirlar;
  const iptaller = depo.db.prepare('SELECT olay FROM radar_giden WHERE trakt_id=777 AND takvim_rev=5').all()
    .map(({ olay }) => JSON.parse(olay));
  T.ok('Dizi iptali kesin tarihli gelecek bolumu ve aynayi korur; yalniz TBA iptal olayi uretir',
    satirlar.some((r) => r.sezon === 1 && r.bolum === 1 && r.durum === 'kesin') &&
    agac().some((r) => r.season_number === 2 && r.episode_number === 1 && r.first_aired === '2026-12-05T17:00:00.000Z') &&
    iptaller.length === 1 && iptaller[0].bolum === 2 && iptaller[0].veri.durum === 'iptal');

  const olaylar = [1, 2, 3].map((id) => ({ id, olay: JSON.stringify({ id }) }));
  const terk = [], onay = [];
  await olayGonder({ bekleyenOlaylar: () => olaylar, olayTerk: (id) => terk.push(id),
    olayOnayla: (rows) => onay.push(...rows.map((r) => r.id)) }, {
    olay: async (grup) => {
      if (grup.some((g) => g.id === 2)) throw Object.assign(new Error('gecersiz'), { status: grup.length === 1 ? 422 : 400 });
      return { yazilan: grup.length, yinelenen: 0 };
    },
  });
  assert.deepEqual([terk, onay], [[2], [1, 3]]);
  await depo.takipDegistir([ilk, ikinci], simdi);
  depo.db.exec('DELETE FROM radar_giden');
  const ekle = depo.db.prepare("INSERT INTO radar_giden (olay_anahtari,icerik_tur,trakt_id,takvim_rev,olay) VALUES (?,'movie',?,?,?)");
  const payload = JSON.stringify({ tespit_at: new Date(simdi - GIDEN_KUTUSU_OMRU - 1).toISOString() });
  ekle.run('gonderilebilir', ikinci.trakt_id, 1, payload);
  ekle.run('yetim', 99, 1, payload);
  ekle.run('terk', ilk.trakt_id, 1, payload);
  depo.db.exec("UPDATE radar_giden SET terk=1 WHERE olay_anahtari='terk'");
  await depo.takipDegistir([ikinci], simdi);
  await depo.gidenKutusuBuda(simdi + GIDEN_KUTUSU_OMRU, true);
  T.ok('400/422 bozuk olayi ayirir; acik kipte yetimler ve eski takipsiz takvim budanir',
    !depo.takvim(ilk) && depo.bekleyenOlaylar(10).length === 1 &&
    depo.db.prepare('SELECT olay_anahtari FROM radar_giden').get().olay_anahtari === 'gonderilebilir');
}

async function onbellek(depo) {
  const is = film(55);
  let at = simdi + GUN;
  const { relativePath } = buildCacheKey({ provider: 'trakt', family: 'movie_detail',
    path: '/movies/55', query: TRAKT_OZET });
  const engel = dirname(join(getLazyFetchDir('cache'), relativePath));
  mkdirSync(dirname(engel), { recursive: true });
  writeFileSync(engel, 'dizin olamayan test dosyasi');
  memoryCache.set(relativePath, { fetchedAt: at - 1 });
  const t = radarTuruKur({ kapilar: { yaz: true }, depo, gunluk, saat: () => at,
    worker: { takip: async () => ({ satirlar: [is], sonraki: null }) },
    saglayicilar: { trakt: async (yol, { page }) => yol.includes('/updates/') ? { data: [],
      headers: { 'x-pagination-page': page, 'x-pagination-page-count': 0, 'x-start-date': yol.split('/').at(-1) } } : { data: ozet(is) } },
  });
  await t();
  const bekliyor = depo.db.prepare('SELECT deneme FROM radar_is WHERE trakt_id=55').get()?.deneme;
  assert.equal(memoryCache.get(relativePath), undefined);
  assert.equal(depo.saglik().hataSayilari.onbellek_yazimi, 1);
  unlinkSync(engel);
  at += SAAT / 2;
  await t();
  T.ok('Arsiv commit sonrasi yayim hatasi isi silmez; sonraki basarili yayim tamamlar',
    bekliyor === 1 && depo.takvim(is)?.takvim_rev === 1 && !depo.db.prepare('SELECT 1 FROM radar_is WHERE trakt_id=55').get());

  const dizi = { tur: 'show', trakt_id: 17, tmdb_id: 170 };
  const eski = { season_number: 1, id: 1, episode_count: 1, air_date: '2024-01-01' };
  const guncel = { season_number: 2, id: 2, episode_count: 1, air_date: '2026-12-01' };
  const yollar = [];
  const saglayicilar = {
    trakt: async (yol) => ({ data: yol.endsWith('/seasons') ? [] : { ids: { trakt: 17, tmdb: 170 } } }),
    tmdb: async (yol) => {
      yollar.push(yol);
      if (yol === '/tv/170') return { data: { id: 170, seasons: [eski, guncel], last_episode_to_air: { season_number: 2 } } };
      const s = yol.endsWith('/1') ? eski : guncel;
      return { data: { ...s, overview: 'ozet', episodes: [{ id: s.id, episode_number: 1,
        air_date: s.air_date, name: 'Bolum', status: 'released', crew: [{ id: 8 }], guest_stars: [{ id: 9 }] }] } };
    },
  };
  const gecmis = new Map();
  const cek = (_, f, yol, sorgu) => f(yol, sorgu);
  for (const gecen of [0, SAAT, 6 * SAAT]) await kataloguCek(dizi, saglayicilar, dur, () => simdi + gecen, cek, gecmis);
  T.ok('TMDB gecmis sezonu sinirli onbellekten alir, guncel sezonu her defasinda ceker',
    yollar.filter((y) => y.endsWith('/1')).length === 2 && yollar.filter((y) => y.endsWith('/2')).length === 3);
  assert.deepEqual([...gecmis.values()][0].detay, { id: 1, season_number: 1,
    episodes: [{ id: 1, episode_number: 1, air_date: '2024-01-01', name: 'Bolum', status: 'released' }] });
  T.ok('Gecmis sezon onbellegi ham TMDB yukunu tutmaz', true);
}

(async () => {
  const depo = await depoAc({ yaz: true });
  await aynalar(depo);
  const tekrar = await akislariDogrula(depo);
  await bakim(tekrar);
  await onbellek(tekrar);
  let girdi = false;
  const t = radarTuruKur({ kapilar: { yaz: true }, depo: tekrar, worker: { takip: async () => ({ satirlar: [], sonraki: null }) },
    saglayicilar: {}, saat: () => simdi, gunluk,
    aynala: async () => { await geceIsi(() => { girdi = true; }, 10); } });
  await radarKilidi(t);
  await t.aynala(geceBekliyor);
  T.ok('Radar aynasi gece islerinin Radar kilidini tutmaz', girdi);
})().catch((e) => { console.error(e); T.ok('beklenmeyen hata', false); })
  .finally(() => { closeArchive(); T.bitir(); });
