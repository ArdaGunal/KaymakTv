const assert = require('node:assert/strict');
const { baslat } = require('../yardimci');
const { AKISLAR, GUN, SAAT, DAKIKA, TAKIP_ARALIGI, hataKodu } = require('../../server/radar/ayar');
const { depoAc, saglikOku } = require('../../server/radar/depo');
const { akisiTara, telafiyiIlerlet, radarCek } = require('../../server/radar/akis');
const { takipGoruntusu, workerIstemcisi, olayGonder } = require('../../server/radar/worker');
const { radariBaslat } = require('../../server/radar');
const { radarTuruKur } = require('../../server/radar/tur');
const { geceIsi, radarKilidi } = require('../../server/zamanlayici/geceKilidi');
const { closeArchive } = require('../../server/archive/db');
const { join } = require('node:path');
const { resolveRequest } = require('../../server/lazyfetch/orchestrator');
const { kovaDurumu } = require('../../server/lazyfetch/tokenBucket');
const { devreDurumu } = require('../../server/lazyfetch/circuitBreaker');

const T = baslat('RADAR AKIS VE KAPILAR');
process.env.ARCHIVE_ROOT = join(T.kok, 'arsiv');
const simdi = Date.parse('2026-11-21T15:00:00Z');
const dur = () => {};
const satir = (trakt_id, tmdb_id, tur = 'show') => ({ tur, trakt_id, tmdb_id, takipci: 1 });
const sayfa = (page, ...idler) => ({ data: { page, total_pages: 2, results: idler.map((id) => ({ id })) } });

(async () => {
  const depo = await depoAc({ yaz: true });
  const akis = AKISLAR[0];
  const onceki = simdi - SAAT;
  const secenek = { depo, akis, simdi, dur };
  await depo.akisiKaydet(akis, onceki, [], null);
  await depo.takipDegistir([satir(10, 51), satir(11, 52), satir(12, 53, 'movie')], simdi);
  T.ok('Ilk goruntude takipler yuksek oncelik ve tekil', depo.hazirIsler(simdi, 10).every((r) => r.oncelik === 2) && depo.hazirIsler(simdi, 10).length === 3);
  depo.db.exec('DELETE FROM radar_is');

  await assert.rejects(akisiTara({ ...secenek, cek: async (_, { page }) => page === 1 ? sayfa(1, 51) : sayfa(1, 52) }));
  T.ok('Kismi veya yanlis sayfada imlec ve kuyruk sabit', depo.imlec(akis.ad).at === onceki && !depo.hazirIsler(simdi, 10).length);
  const sinir = Object.assign(new Error('sahte'), { response: { status: 429 } });
  await assert.rejects(akisiTara({ ...secenek, cek: async (_, { page }) => {
    if (page === 2) throw sinir;
    return sayfa(1, 51);
  } }), (e) => e === sinir);
  T.ok('429 sonrasi imlec ve kuyruk sabit', depo.imlec(akis.ad).at === onceki && !depo.hazirIsler(simdi, 10).length);
  const r = await akisiTara({ ...secenek, cek: async (_, { page }) => page === 1 ? sayfa(1, 51, 53, 99) : sayfa(2, 51) });
  T.ok('Tum sayfalar tamamlanir; yalniz dogru turdeki kesisim depolanir',
    r.eslesen === 1 && depo.imlec(akis.ad).at === simdi && depo.hazirIsler(simdi, 10).map((x) => x.trakt_id).join(',') === '10');

  const tAkis = AKISLAR[2];
  await depo.akisiKaydet(tAkis, simdi - 40 * GUN, [], null);
  const tr = await akisiTara({ ...secenek, akis: tAkis, cek: async (yol) => {
    assert.match(yol, /^\/shows\/updates\/2026-10-23$/);
    return { data: [{ show: { ids: { trakt: 11 } } }], headers: {
      'x-pagination-page': '1', 'x-pagination-page-count': '1', 'x-start-date': '2026-10-24',
    } };
  } });
  await telafiyiIlerlet(depo, [tAkis], simdi);
  T.ok('Trakt kesilen pencereyi sinirli telafi ile kapatir', tr.telafi && tr.eslesen === 1 && depo.imlec(tAkis.ad).telafi_son_id === null);

  await depo.akisiKaydet(tAkis, simdi - SAAT, [], null);
  const saatlik = await akisiTara({ ...secenek, akis: tAkis, cek: async () => ({
    data: [{ show: { ids: { trakt: 11 } }, updated_at: new Date(simdi + 1).toISOString() }],
    headers: { 'x-pagination-page': '1', 'x-pagination-page-count': '1', 'x-start-date': '2026-11-21T14:30:00Z' },
  }) });
  T.ok('Ayni gunde imlecten ileri Trakt baslangici telafi ister; tur sonrasi guncelleme ertelenir',
    saatlik.telafi && saatlik.eslesen === 0);

  await depo.akisiKaydet(akis, simdi - 3 * GUN, [], null);
  const araliklar = [];
  const parca = await akisiTara({ ...secenek, cek: async (_, q) => {
    araliklar.push(q);
    const uzun = q.start_date === '2026-11-18' && q.end_date === '2026-11-21';
    const total_pages = uzun ? 500 : q.page === 1 ? 2 : 3;
    return { data: { page: q.page, total_pages, results: [{ id: 51 }] } };
  } });
  T.ok('TMDB 500 sayfayi boler ve buyuyen alt pencereyi tamamlar', parca.sayfa === 7 &&
    araliklar[1].end_date === '2026-11-19' && araliklar[4].start_date === '2026-11-20');

  const ilkTur = await depoAc({});
  const akisLog = [];
  const traktIstekleri = [];
  const axios = require('axios');
  const oncekiAxios = axios.get;
  axios.get = async (url, { params }) => {
    const show = url.includes('/shows/');
    const tur = show ? 'show' : 'movie';
    traktIstekleri.push({ url, ...params });
    const kayit = (id, at) => ({ [tur]: { ids: { trakt: id } }, updated_at: new Date(at).toISOString() });
    return {
      data: show ? [kayit(10, simdi - GUN - 1)] : params.page === 1 ? [kayit(12, simdi - 1)] : [],
      headers: { 'x-pagination-page': String(params.page), 'x-pagination-page-count': show || params.page > 1 ? '1' : '159',
        'x-pagination-limit': show ? '100' : '10', 'x-start-date': '2026-11-20T00:00:00Z' },
    };
  };
  try {
    const { createTraktCatalogFetcher } = require('../../server/lazyfetch/providers/trakt');
    await radarTuruKur({
      kapilar: { acik: true }, depo: ilkTur, saat: () => simdi,
      gunluk: { info: (s) => akisLog.push(s), warn: (s) => akisLog.push(s) },
      worker: { takip: async () => ({ satirlar: [satir(10, 51), satir(12, 53, 'movie')], sonraki: null }) },
      saglayicilar: {
        tmdb: async (yol, { page }) => ({
          data: { page, total_pages: page === 1 ? 4 : yol === '/tv/changes' ? 1 : 2,
            results: yol === '/tv/changes' && page > 1 ? [] : [{ id: yol === '/tv/changes' ? 51 : 53 }] },
        }),
        trakt: createTraktCatalogFetcher('sahte'),
      },
    })();
  } finally { axios.get = oncekiAxios; }
  T.ok('TMDB iki akista sayfa azalmasini tolere eder; ilk turda iki imlec de yazilir',
    ilkTur.imlec('tmdb_show')?.at === simdi && ilkTur.imlec('tmdb_movie')?.at === simdi &&
    akisLog.some((s) => s.includes('tmdb_show') && s.includes('yol=/tv/changes') && s.includes('sayfa_daraldi=1')) &&
    akisLog.some((s) => s.includes('tmdb_movie') && s.includes('sayfa_daraldi=1')));
  T.ok('Ilk Trakt penceresi ortak; adaptorde her HTTP sayfasina limit gider ve etkin limit loglanir',
    traktIstekleri.length === 3 && traktIstekleri.every((r) => r.limit === 100 && r.url.endsWith('/2026-11-20')) &&
    akisLog.filter((s) => s.includes('baslangic=2026-11-20T15:00:00.000Z bitis=2026-11-21T15:00:00.000Z') &&
      s.includes('trakt_')).length === 2 &&
    akisLog.some((s) => s.includes('trakt_show kesisim=0') && s.includes('limit_uygulanan=100')) &&
    akisLog.some((s) => s.includes('trakt_movie kesisim=1') && s.includes('limit_uygulanan=10')));
  T.ok('Trakt film akisi daralinca ilk turda 159 yerine iki dogrulanmis sayfayla imlec yazar',
    ilkTur.imlec('trakt_movie')?.at === simdi &&
    akisLog.some((s) => s.includes('trakt_movie kesisim=1') && s.includes('sayfa=2') && s.includes('sayfa_daraldi=1')));

  const filmAkisi = AKISLAR.find((a) => a.ad === 'trakt_movie');
  await assert.rejects(akisiTara({ akis: filmAkisi, depo: ilkTur, simdi: simdi + SAAT, dur, cek: async (_, { page }) => ({
    data: page === 1 ? [{ movie: { ids: { trakt: 12 } } }] : [],
    headers: { 'x-pagination-page': '1', 'x-pagination-page-count': page === 1 ? '4' : '1', 'x-start-date': '2026-11-21' },
  }) }), (e) => e.kod === 'akis_sayfalama');
  T.ok('Daralmada yanlis sayfa donerse Trakt imleci ilerlemez', ilkTur.imlec('trakt_movie').at === simdi);

  const bosDepo = await depoAc({});
  const bosTrakt = (at, baslik, data) => akisiTara({
    akis: tAkis, depo: bosDepo, simdi: at, dur,
    cek: async () => ({
      data,
      headers: { 'x-pagination-page': '1', 'x-pagination-page-count': baslik, 'x-start-date': '2026-11-20' },
    }),
  });
  await bosTrakt(simdi, '0', []);
  const ilkBos = saglikOku(bosDepo.db, simdi + GUN).imlecler.trakt_show;
  await bosTrakt(simdi + GUN - SAAT, '1', []);
  const yaklasti = saglikOku(bosDepo.db, simdi + GUN - SAAT).imlecler.trakt_show;
  await bosTrakt(simdi + GUN, '0', []);
  const uyari = saglikOku(bosDepo.db, simdi + GUN).imlecler.trakt_show;
  T.ok('Bos Trakt dizi cevabi normal; 24 saatlik basarili bos gozlemlerden sonra uyari',
    ilkBos.ardisikBos === 1 && !ilkBos.bosUyarisi && yaklasti.ardisikBos === 2 && !yaklasti.bosUyarisi &&
    uyari.ardisikBos === 3 && uyari.bosUyarisi && Object.keys(bosDepo.saglik().hataSayilari).length === 0);
  const disarida = await bosTrakt(simdi + GUN + SAAT, '1', [
    { show: { ids: { trakt: 999 } }, updated_at: new Date(simdi).toISOString() },
  ]);
  const temiz = bosDepo.saglik().imlecler.trakt_show;
  T.ok('Ham satir varsa kesisim sifir olsa bile bosluk sayaci ve uyarisi sifirlanir',
    disarida.hamSatir === 1 && disarida.eslesen === 0 && temiz.ardisikBos === 0 && !temiz.bosUyarisi &&
    ilkTur.saglik().imlecler.trakt_movie.ardisikBos === 0);

  const akisHatalari = [];
  await radarTuruKur({
    kapilar: { acik: true }, depo: await depoAc({}), saat: () => simdi,
    gunluk: { info: () => {}, warn: (s) => akisHatalari.push(s) },
    worker: { takip: async () => ({ satirlar: [], sonraki: null }) },
    saglayicilar: { tmdb: async () => ({ data: null }) },
  })();
  T.ok('Son tur hatasi baska akisi gizlemez; iki TMDB yolu ayri loglanir',
    akisHatalari.some((s) => s.includes('tmdb_show:akis_sayfalama yol=/tv/changes')) &&
    akisHatalari.some((s) => s.includes('tmdb_movie:akis_sayfalama yol=/movie/changes')));

  let sayfaNo = 0;
  await assert.rejects(async () => depo.takipDegistir(await takipGoruntusu({ takip: async () => {
    if (sayfaNo++) throw sinir;
    return { satirlar: [satir(20, 53)], sonraki: 'ikinci' };
  } }, dur), simdi));
  await assert.rejects(depo.takipDegistir([satir(20, 53), satir(20, 88)], simdi));
  T.ok('Takip gecisinde sayfa kaybi veya cift satir onceki goruntuyu korur', depo.kesisim(akis, [51, 52, 53]).join(',') === '10,11');
  await depo.takipDegistir([satir(11, 52)], simdi);
  T.ok('Silinen takip is kuyrugundan da kalkar', depo.hazirIsler(simdi, 10).map((x) => x.trakt_id).join(',') === '11');

  let cagrilar = 0;
  const patla = () => { cagrilar++; throw new Error('kapali'); };
  const gunlukler = [];
  for (const ortam of [{}, { RADAR_YAZ: '1', RADAR_OLAY: '1' }, { RADAR_ACIK: '1', RADAR_YAZ: '1', GECE_ISLERI: '0', RADAR_SIR: 'x'.repeat(32) }]) {
    assert.equal(radariBaslat({ ortam, aralik: patla, ilk: patla, istemci: patla, depoAc: patla }), null);
  }
  for (let i = 0; i < 2; i++) {
    radariBaslat({ ortam: { RADAR_ACIK: '1' }, aralik: patla, gunluk: { warn: (s) => gunlukler.push(s) } });
  }
  T.ok('Varsayilan kapali; eksik sir tek uyari; zamanlayici ve istek yok', cagrilar === 0 && gunlukler.length === 1);
  const bellek = await depoAc({});
  const info = [];
  let detay = 0;
  await radarTuruKur({
    kapilar: { acik: true, yaz: false, olay: false }, depo: bellek, saat: () => simdi,
    gunluk: { info: (s) => info.push(s), warn: () => {} },
    worker: { takip: async () => ({ satirlar: [satir(10, 51)], sonraki: null }), olay: patla },
    saglayicilar: { tmdb: async (yol) => {
      if (!yol.endsWith('/changes')) detay++;
      return { data: { page: 1, total_pages: 1, results: [{ id: 51 }, { id: 90 }] } };
    } },
    yaz: patla, aynala: patla,
  })();
  T.ok('Olcum yalniz sinyal okur; eslesen adedi loglar ve kalici arsive yazmaz',
    !detay && !cagrilar && info.some((s) => s.includes('tmdb_show kesisim=1')) &&
    !bellek.hazirIsler(simdi, 10).length && !depo.imlec('tmdb_movie'));

  const sira = [];
  let gece;
  await radarKilidi(async (bekliyor) => {
    sira.push('radar');
    gece = geceIsi(() => sira.push('gece'));
    assert.equal(bekliyor(), true);
    assert.equal(await radarKilidi(patla), false);
    sira.push('radar-bitti');
  });
  await gece;
  T.ok('Gece isi Radar yazimi bitene kadar bekler', sira.join(',') === 'radar,radar-bitti,gece');

  const gercekSaat = Date.now;
  const sabit = gercekSaat();
  Date.now = () => sabit;
  try {
    const bas = kovaDurumu('tmdb').jeton;
    const fetcher = async () => ({ data: { cast: [] } });
    await resolveRequest({ provider: 'tmdb', path: '/tv/555/credits', fetcher });
    await radarCek('tmdb', fetcher, '/tv/changes', {}, dur);
    T.ok('LazyFetch ıskası ve Radar akışı aynı kovadan iki jeton alır', bas - kovaDurumu('tmdb').jeton === 2);
  } finally {
    Date.now = gercekSaat;
  }

  const eskiGet = axios.get;
  const { createTraktCatalogFetcher } = require('../../server/lazyfetch/providers/trakt');
  axios.get = async () => { throw sinir; };
  try {
    await assert.rejects(radarCek('trakt', createTraktCatalogFetcher('sahte'), '/shows/updates/2026-11-21', {}, dur),
      (e) => hataKodu(e) === 'http_429');
    T.ok('Trakt adaptoru gercek Axios 429 bicimini korur; LazyFetch devresi etkilenmez',
      devreDurumu('trakt').ardisikHata === 0);
  } finally { axios.get = eskiGet; }

  const buyuk = 'ı'.repeat(230_000);
  const olaylar = [1, 2, 3, 4].map((id) => ({ id, olay: JSON.stringify({ id, veri: id === 4 ? buyuk + buyuk : buyuk }) }));
  const terk = [], onay = [], boyutlar = [];
  await olayGonder({ bekleyenOlaylar: () => olaylar, olayTerk: (id) => terk.push(id),
    olayOnayla: (grup) => onay.push(...grup.map((r) => r.id)) }, {
    olay: async (grup) => {
      boyutlar.push(Buffer.byteLength(JSON.stringify({ olaylar: grup })));
      if (grup.some((r) => r.id === 2)) throw Object.assign(new Error('sahte 413'), { status: 413 });
      return { yazilan: grup.length, yinelenen: 0 };
    },
  });
  const yarilar = [];
  await olayGonder({ bekleyenOlaylar: () => [1, 2].map((id) => ({ id, olay: JSON.stringify({ id }) })),
    olayTerk: (id) => terk.push(id), olayOnayla: () => {} }, {
    olay: async (grup) => {
      yarilar.push(grup.length);
      if (grup.length > 1) throw Object.assign(new Error('413'), { status: 413 });
      return { yazilan: 1, yinelenen: 0 };
    },
  });
  T.ok('UTF-8 900 KB tavan, 413 bolme, tekil asiri boyut terk ve sira ilerlemesi',
    Math.max(...boyutlar) <= 900_000 && terk.join(',') === '2,4' && onay.join(',') === '1,3' && yarilar.join(',') === '2,1,1');

  const hataIsi = depo.hazirIsler(simdi, 10)[0];
  for (let i = 0; i < 5; i++) await depo.isiErtele({ ...hataIsi, deneme: i }, simdi, 0);
  T.ok('Bes hata isi terk eder ve yasli imlec saglikta isaretlenir',
    depo.saglik().kuyruk.terkIs === 1 && saglikOku(depo.db, simdi + 2 * SAAT + 1).imlecler[akis.ad].gecikti);

  const filtreliSayfa = await takipGoruntusu({
    takip: async (imlec) => imlec ? { satirlar: [satir(11, 52)], sonraki: null } : { satirlar: [], sonraki: 'tmdb-only' },
  }, dur);
  T.ok('Worker filtreli bos sayfadan sonra imlec varsa devam eder', filtreliSayfa.length === 1);

  await radarKilidi(async () => {
    await assert.rejects(geceIsi(patla, 5), /radar_gece_kilit_zaman_asimi/);
  });
  T.ok('Gece kilidinin beklemesi sinirli; zaman asiminda is kosmaz', cagrilar === 0);

  let saatSimdi = simdi;
  const gecici = await depoAc({});
  let istekHatasi = true;
  const saglikTuru = radarTuruKur({ kapilar: { acik: true, yaz: false, olay: false },
    depo: gecici, saat: () => saatSimdi, saglayicilar: {},
    gunluk: { info: () => {}, warn: () => {} }, worker: { takip: async () => {
      if (istekHatasi) throw sinir;
      // Uclari sonraki kontrol anina kadar vakti gelmemis yap.
      for (const akis of AKISLAR) await gecici.akisiKaydet(akis, saatSimdi, [], null);
      return { satirlar: [], sonraki: null };
    } } });
  await saglikTuru();
  istekHatasi = false;
  saatSimdi += SAAT;
  await saglikTuru();
  T.ok('Yeni basarili tur son hatayi temizler; hata sayaci kalir',
    gecici.saglik().sonHata === null && gecici.saglik().hataSayilari.http_429 === 1);

  let okuma = 0;
  let takipSaati = simdi;
  const aralikTuru = radarTuruKur({ kapilar: { acik: true }, depo: await depoAc({}), saat: () => takipSaati,
    saglayicilar: {}, gunluk: { info: () => {}, warn: () => {} },
    worker: { takip: async () => { okuma++; return { satirlar: [], sonraki: null }; } } });
  await aralikTuru();
  takipSaati = simdi + 10 * DAKIKA - 1;
  await aralikTuru();
  const oncekiOkuma = okuma;
  takipSaati++;
  await aralikTuru();
  T.ok('Takip goruntusu 10 dakikadan once cekilmez', TAKIP_ARALIGI === 10 * DAKIKA && oncekiOkuma === 1 && okuma === 2);

  const sahteSir = 'x'.repeat(32);
  const worker = workerIstemcisi({ workerUrl: 'https://worker.invalid', sir: sahteSir, fetch: async (url, opt) => {
    assert.equal(new URL(url).searchParams.get('sonraki'), 'a&b');
    assert.equal(opt.headers['x-kaymak-sync-secret'], sahteSir);
    assert.equal(opt.redirect, 'error');
    return { ok: true, json: async () => ({ satirlar: [], sonraki: null }) };
  } });
  await worker.takip('a&b');
  T.ok('Takip GET imleci URL kodlanir ve sir yalniz baslikta', true);
})().catch((e) => { console.error(e); T.ok('beklenmeyen hata', false); })
  .finally(() => { closeArchive(); T.bitir(); });
