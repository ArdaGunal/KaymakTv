// ==========================================================================
// A3 ADIM 2 — BACKFILL (SUPABASE -> ARŞİV EKSİKLERİ) TESTLERİ
// ==========================================================================
// 🔴 NEDEN TEST EDİLİYOR: bu motor, TTL'siz ve SİLMESİZ bir depoya yazan
// ve SAĞLAYICIYA GİDEN tek otomatik sistemdir. İki ayrı yoldan zarar
// verebilir:
//   1. Yanlış `lang`/`path` ile yazarsa arşivde sahte mükerrer kayıt (M286)
//   2. Ardışık hata yerse `circuitBreaker`'ı açar ve CANLI kullanıcıların
//      katalog trafiğini keser
//
// 🔴 HİÇBİR AĞ İSTEĞİ YOK. `resolveRequest` ve `fetch` enjekte ediliyor —
// yani bu takım Trakt'a da Supabase'e de hiç dokunmaz.

const path = require('path');
const { baslat, AR } = require('../yardimci');

const T = baslat('ARSIV BACKFILL (A3/2)', { kokOneki: 'ar-backfill-' });

process.env.ARCHIVE_ROOT = path.join(T.kok, 'archive');

const db = require(path.join(AR, 'db'));
const { upsertPayload } = require(path.join(AR, 'store'));
const { resolveOrCreate } = require(path.join(AR, 'identity'));
const { DEFAULT_CONFIG: DEVRE_CONFIG } = require(path.join(AR, '..', 'lazyfetch', 'circuitBreaker'));
const {
  fetchTakipEdilenler, hedefleriUret, hedefListesi, hedefAnahtari,
  fetchImportHedefleri, tasiBekleyenleri,
} = require(path.join(AR, 'backfillSource'));
const {
  eksikleriBul, arsivdeVarMi, defterOku, defterYaz, beklemedeMi,
  geriCekilme, ARDISIK_HATA_TAVANI, GERI_CEKILME_MS, TAZELIK_MS,
} = require(path.join(AR, 'backfill'));
const { tamamla } = require(path.join(AR, 'backfillTamamla'));

/** Sahte Supabase `fetch` — sayfalamayı gerçekçi taklit eder. */
function sahteFetch(satirlar, { sayfaBoyu = 1000 } = {}) {
  const cagrilar = [];
  return {
    cagrilar,
    fetchImpl: async (url, opts) => {
      cagrilar.push(opts.headers.Range);
      const m = /^(\d+)-(\d+)$/.exec(opts.headers.Range || '');
      const bas = m ? Number(m[1]) : 0;
      const dilim = satirlar.slice(bas, bas + sayfaBoyu);
      return { ok: true, status: 200, json: async () => dilim };
    },
  };
}

(async () => {
  const durum = db.initArchive();
  T.ok('Arsiv acildi (backfill_state semasi dahil)', durum.enabled, durum.reason || durum.dbPath);

  // ==================================================================
  T.H('backfill_state tablosu — sema SURUMU ARTIRILMADAN geldi');
  // ==================================================================
  // 🔴 BU IDDIA BIR TUZAGI KILITLIYOR. Tabloyu eklerken HEDEF_SEMA_SURUMU'nu
  // artirsaydik ve goc adimi yazmasaydik, `db.js semayiGocEt()` var olan
  // v1 arsivde "1 -> 2 gocu tanimli degil" diye FIRLATIRDI: arsiv canlida
  // SESSIZCE KAPANIRDI (fail-soft sessizdir — M284/286). Burada iki sey
  // birden olculuyor: tablo var VE surum hala 1.
  const conn = db.getDb();
  const tabloVar = conn.prepare(
    "SELECT count(*) c FROM sqlite_master WHERE type='table' AND name='backfill_state'"
  ).get().c;
  T.ok('backfill_state tablosu olustu', tabloVar === 1);

  const surum = conn.prepare("SELECT value FROM meta WHERE key='schema_version'").get();
  // 🔴 SURUM 3 (2026-09-15): `sync_log.event` CHECK kisiti KALDIRILDI (§C16).
  // Surum 2 (2026-09-14) `external_ids.retired_at` mezar tasini getirmisti.
  //
  // Neden bu degisiklik surumu ARTIRDI, digerleri artirmadi: `schema.sql`
  // tamamen `IF NOT EXISTS` — YENI TABLO ve YENI INDEKS var olan bir
  // veritabaninda kendiliginden olusur, goc adimi gerekmez. Ama
  // `CREATE TABLE IF NOT EXISTS` var olan bir tabloya KOLON EKLEMEZ; o
  // yuzden ADD COLUMN icin surumlu bir goc adimi sart.
  //
  // ⚠️ Bu iddia sabit bir sayiya cakiliyor ki surum KEYFI olarak
  // artirilamasin. Artiracaksan once `db.js`e gocu yaz, sonra burayi.
  T.ok('Sema surumu 3 (sync_log CHECK kaldirildi)', surum.value === '3', `surum=${surum.value}`);
  T.ok('db.js hedef surumu ile TUTARLI', Number(surum.value) === db.HEDEF_SEMA_SURUMU,
    `meta=${surum.value} kod=${db.HEDEF_SEMA_SURUMU}`);

  // ==================================================================
  T.H('Kaynak — Supabase okuma ve tekillestirme');
  // ==================================================================
  const satirlar = [
    { show_id: 1388, media_type: 'show' },
    { show_id: 1388, media_type: 'show' },   // mukerrer
    { show_id: 1388, media_type: 'movie' },  // AYNI id, FARKLI tip
    { show_id: 555, media_type: 'movie' },
    { show_id: null, media_type: 'show' },   // 'posted' aktivitesi
  ];
  const sf = sahteFetch(satirlar);
  const kaynak = await fetchTakipEdilenler({ url: 'https://x.supabase.co', anonKey: 'k', fetchImpl: sf.fetchImpl });

  T.ok('Okuma basarili', kaynak.ok === true, kaynak.reason || '');
  T.ok('Mukerrer satir tekillestirildi', kaynak.items.length === 3, `${kaynak.items.length} tekil`);
  T.ok('show_id NULL satiri atlandi', !kaynak.items.some((i) => i.traktId === 'null'));
  // 🔴 Ayni kimligin dizi ve film hali AYRI yapimdir (identity.js'in
  // `tmdb:show`/`tmdb:movie` ayrimiyla ayni tuzak).
  T.ok('Ayni ID farkli tip AYRI yapim sayildi',
    kaynak.items.filter((i) => i.traktId === '1388').length === 2);
  T.ok('Ham satir sayisi raporlaniyor', kaynak.satir === 5, `${kaynak.satir}`);

  const bosKaynak = await fetchTakipEdilenler({ url: '', anonKey: '' });
  T.ok('Yapilandirma eksikse ok:false (throw DEGIL)',
    bosKaynak.ok === false && bosKaynak.reason === 'supabase_yapilandirmasi_eksik');

  // 🔴 SAYFALAMA: PostgREST tavani asildiginda SESSIZCE kirpar. Bugun 847
  // satir var; "tek istek yeter" varsayimi listenin buyudugu ilk gun
  // sessizce eksik backfill demekti (M273 deseni).
  const cokSatir = Array.from({ length: 25 }, (_, i) => ({ show_id: 1000 + i, media_type: 'show' }));
  const sf2 = sahteFetch(cokSatir, { sayfaBoyu: 10 });
  const kaynak2 = await fetchTakipEdilenler({
    url: 'https://x.supabase.co', anonKey: 'k', fetchImpl: sf2.fetchImpl, sayfaBoyu: 10,
  });
  T.ok('Sayfalama TUM satirlari getirdi', kaynak2.items.length === 25, `${kaynak2.items.length}/25`);
  T.ok('Birden fazla sayfa istendi', sf2.cagrilar.length === 3, `${sf2.cagrilar.length} istek`);

  const hataliFetch = async () => ({ ok: false, status: 403, json: async () => ({}) });
  const kaynak3 = await fetchTakipEdilenler({ url: 'https://x', anonKey: 'k', fetchImpl: hataliFetch });
  T.ok('HTTP hatasi ok:false dondurur', kaynak3.ok === false && kaynak3.reason === 'http 403', kaynak3.reason);

  // ==================================================================
  T.H('Hedef sekli — ISTEMCININ gonderdiginin BIREBIR aynisi');
  // ==================================================================
  // 🔴 M286'nin kilidi: yanlis `lang` = arsivde SAHTE MUKERRER kayit.
  // Olculen istemci davranisi (services/api/shows.ts, movies.ts):
  //   show_detail/movie_detail -> translations=<dil>   => lang '<dil>'
  //   show_seasons             -> TRANSLATIONS YOK     => lang '-'
  const dHedef = hedefleriUret({ traktId: '1388', type: 'show' }, 'tr');
  T.ok('Dizi 2 hedef uretir (detail + seasons)', dHedef.length === 2);

  const detay = dHedef.find((h) => h.endpoint === 'show_detail');
  T.ok('show_detail yolu dogru', detay.path === '/shows/1388', detay.path);
  T.ok('show_detail translations tasiyor', detay.query.translations === 'tr');
  T.ok('show_detail lang = tr', detay.lang === 'tr');

  const sezon = dHedef.find((h) => h.endpoint === 'show_seasons');
  T.ok('show_seasons yolu dogru', sezon.path === '/shows/1388/seasons', sezon.path);
  T.ok('🔴 show_seasons translations TASIMAZ', sezon.query.translations === undefined);
  T.ok('🔴 show_seasons lang = "-" (DILSIZ)', sezon.lang === '-', `lang=${sezon.lang}`);
  T.ok('show_seasons extended=full,episodes', sezon.query.extended === 'full,episodes', sezon.query.extended);

  // 🔴 ILISKI TESTI: hedefin `lang` alani, yazicinin ayni query'den
  // cozecegi dille AYNI olmali. Ikisi ayri yerde hesaplaniyor; ayrisirlarsa
  // arsiv sahte mukerrer uretir ve iki taraf da KENDI basina dogru gorunur
  // (M273: sabitleri degil ARALARINDAKI ILISKIYI test et).
  const { dilCoz } = require(path.join(AR, 'writer'));
  for (const h of dHedef.concat(hedefleriUret({ traktId: '9', type: 'movie' }, 'tr'))) {
    T.ok(`ILISKI: ${h.endpoint} hedef.lang == writer.dilCoz(query)`,
      h.lang === dilCoz(h.query), `${h.lang} vs ${dilCoz(h.query)}`);
  }

  const fHedef = hedefleriUret({ traktId: '555', type: 'movie' }, 'tr');
  T.ok('Film 1 hedef uretir', fHedef.length === 1 && fHedef[0].endpoint === 'movie_detail');
  T.ok('Film yolu /movies/ (shows DEGIL)', fHedef[0].path === '/movies/555', fHedef[0].path);
  T.ok('Film kaynagi trakt:movie', fHedef[0].source === 'trakt:movie', fHedef[0].source);
  T.ok('Dizi kaynagi trakt:show', detay.source === 'trakt:show', detay.source);

  T.ok('Hedef anahtari dili ICERIR',
    hedefAnahtari(detay) === 'trakt/show_detail/1388/tr', hedefAnahtari(detay));
  T.ok('Ayni yapimin iki ucu FARKLI anahtar', hedefAnahtari(detay) !== hedefAnahtari(sezon));

  // ⛔ episode_detail bilerek kapsam disi (2.000+ cagri; show_seasons zaten
  // tum bolumleri tasiyor).
  const tumHedefler = hedefListesi(kaynak.items, 'tr');
  T.ok('episode_detail backfill edilmiyor', !tumHedefler.some((h) => h.endpoint === 'episode_detail'));
  T.ok('3 yapim -> 4 hedef (1 dizi x2 + 2 film)', tumHedefler.length === 4, `${tumHedefler.length}`);

  // ==================================================================
  T.H('Eksik tespiti — entities DEGIL payloads sorgulanir');
  // ==================================================================
  // 🔴 Arsivde 37.572 entity var ama cogu `archiveShowSeasons`'in actigi
  // BOLUM kaydi: kimligi bilinen, ham yaniti OLMAYAN satirlar. A4 istemciye
  // yanit URETECEK; entity'ye bakip "kapsiyoruz" demek bos donen bir arsiv
  // olurdu.
  // ⚠️ `resolveOrCreate` NESNE dondurur (`{kaymak_id, created, conflict}`),
  // `findByExternal` ise DUZ STRING. Ikisini karistirmak testi kirmizi
  // yakti — sozlesme koddan OKUNDU, varsayilmadi.
  const olusan = resolveOrCreate({
    type: 'show',
    externalIds: [{ source: 'trakt:show', source_id: '1388' }],
    derived: { title: 'Test Dizi' },
  });
  const kaymakId = olusan.kaymak_id;
  T.ok('Entity olusturuldu', olusan.created === true && kaymakId.startsWith('show_'), kaymakId);

  let kontrol = arsivdeVarMi(detay);
  T.ok('Entity VAR ama payload YOK -> hala EKSIK', kontrol.var === false && kontrol.kaymakId === kaymakId);

  await upsertPayload({ kaymakId, provider: 'trakt', endpoint: 'show_detail', lang: 'tr', data: { a: 1 } });
  kontrol = arsivdeVarMi(detay);
  T.ok('Payload yazilinca KAPSANAN oldu', kontrol.var === true);

  // 🔴 Dil ayrimi: 'tr' yazildi diye '-' kapsanmis SAYILMAZ.
  T.ok('Ayni yapimin DILSIZ ucu hala eksik', arsivdeVarMi(sezon).var === false);
  T.ok('Ayni yapimin en ucu hala eksik',
    arsivdeVarMi(hedefleriUret({ traktId: '1388', type: 'show' }, 'en')[0]).var === false);

  const bilinmeyen = hedefleriUret({ traktId: '999999', type: 'movie' }, 'tr')[0];
  T.ok('Hic gorulmemis yapim eksik sayilir', arsivdeVarMi(bilinmeyen).var === false);

  const ayrim = eksikleriBul(dHedef.concat(bilinmeyen));
  T.ok('eksikleriBul: 1 kapsanan', ayrim.kapsanan.length === 1);
  T.ok('eksikleriBul: 2 eksik', ayrim.eksik.length === 2, `${ayrim.eksik.length}`);
  T.ok('eksikleriBul: 0 beklemede', ayrim.beklemede.length === 0);

  // ==================================================================
  T.H('Defter — basarisiz uc isaretlenir, ustel geri cekilme');
  // ==================================================================
  const simdi = Date.now();
  defterYaz(sezon, { hata: '504 Gateway Timeout', simdi });
  const d1 = defterOku(hedefAnahtari(sezon));
  T.ok('Defter satiri yazildi', !!d1);
  T.ok('Deneme 1 oldu', d1.deneme === 1, `deneme=${d1.deneme}`);
  T.ok('Hata metni saklandi', d1.son_hata === '504 Gateway Timeout');
  T.ok('sonraki_deneme_at = simdi + 6 saat',
    d1.sonraki_deneme_at === simdi + GERI_CEKILME_MS[0],
    `fark=${(d1.sonraki_deneme_at - simdi) / 3600000} sa`);
  T.ok('basarili_at bos', d1.basarili_at === null);

  defterYaz(sezon, { hata: '504', simdi });
  const d2 = defterOku(hedefAnahtari(sezon));
  T.ok('Ikinci hata denemeyi artirdi', d2.deneme === 2, `deneme=${d2.deneme}`);
  T.ok('Aralik uzadi (6sa -> 24sa)', d2.sonraki_deneme_at - simdi === GERI_CEKILME_MS[1]);

  T.ok('Geri cekilme merdiveni artan',
    GERI_CEKILME_MS.every((v, i) => i === 0 || v > GERI_CEKILME_MS[i - 1]));
  T.ok('Merdiven TAVANLI (kalici kara liste YOK)',
    geriCekilme(99) === GERI_CEKILME_MS[GERI_CEKILME_MS.length - 1],
    `${geriCekilme(99) / 86400000} gun`);

  T.ok('Beklemedeki hedef beklemede sayilir', beklemedeMi(hedefAnahtari(sezon), simdi) === true);
  T.ok('Pencere gecince tekrar denenebilir',
    beklemedeMi(hedefAnahtari(sezon), simdi + GERI_CEKILME_MS[1] + 1) === false);

  const ayrim2 = eksikleriBul(dHedef.concat(bilinmeyen), { simdi });
  T.ok('eksikleriBul beklemedekini AYIRDI', ayrim2.beklemede.length === 1, `${ayrim2.beklemede.length}`);
  T.ok('eksikleriBul beklemedekini EKSIK saymadi',
    !ayrim2.eksik.some((h) => hedefAnahtari(h) === hedefAnahtari(sezon)));

  defterYaz(sezon, { basarili: true, simdi });
  const d3 = defterOku(hedefAnahtari(sezon));
  T.ok('Basari sonrasi basarili_at doldu', d3.basarili_at === simdi);
  T.ok('Basari sonrasi bekleme kalkti', d3.sonraki_deneme_at === null);
  T.ok('Basari denemeyi ARTIRMADI (tesis: kac kez ugrasildi)', d3.deneme === 2, `deneme=${d3.deneme}`);

  // ==================================================================
  T.H('🔴 TAZELEME (zorla) — arsivde VAR olan hedef YINE indirilir');
  // ==================================================================
  // T5.3'un ASIL TUZAGI (olculdu, M343): eksik bolumu olan 36 dizinin 15'i
  // arsivde ZATEN VAR. `arsivdeVarMi` onlara "kapsanan" deyip atlarsa o
  // bolumlerin `user_import_pending` satirlari SONSUZA KADAR erimez.

  const tazeHedef = hedefleriUret({ traktId: '1388', type: 'show', tazele: true }, 'tr');
  T.ok('tazele -> her hedefte zorla=true', tazeHedef.every((h) => h.zorla === true));

  // Akis hedeflerinin sekli DEGISMEMELI: `zorla: false` bile yazilmiyor.
  T.ok('🔴 tazele YOKken hedefte zorla ALANI HIC YOK',
    hedefleriUret({ traktId: '1388', type: 'show' }, 'tr')
      .every((h) => !Object.prototype.hasOwnProperty.call(h, 'zorla')));

  // `detay` (show_detail/tr) payload'i YUKARIDA yazildi -> normalde kapsanan.
  T.ok('Kontrol: ayni hedef zorlasiz KAPSANAN',
    eksikleriBul([detay]).kapsanan.length === 1);
  const tazeAyrim = eksikleriBul(tazeHedef);
  T.ok('🔴 zorla ile arsivde OLAN hedef EKSIK sayildi',
    tazeAyrim.kapsanan.length === 0 && tazeAyrim.eksik.length === 2,
    `kapsanan=${tazeAyrim.kapsanan.length} eksik=${tazeAyrim.eksik.length}`);

  // 🔴 GERI CEKILME DEFTERI YINE UYGULANIYOR: `zorla` "her gece yeniden
  // dene" demek DEGIL. Surekli basarisiz bir hedef sonsuz donguye girmesin.
  const tazeSimdi = Date.now();
  defterYaz(tazeHedef[0], { hata: 'gecici hata', simdi: tazeSimdi });
  const tazeAyrim2 = eksikleriBul(tazeHedef, { simdi: tazeSimdi });
  T.ok('🔴 zorla GERI CEKILMEYI ezmiyor (beklemede 1)',
    tazeAyrim2.beklemede.length === 1 && tazeAyrim2.eksik.length === 1,
    `beklemede=${tazeAyrim2.beklemede.length} eksik=${tazeAyrim2.eksik.length}`);
  T.ok('Pencere gecince zorlanan hedef yine denenebilir',
    eksikleriBul(tazeHedef, { simdi: tazeSimdi + GERI_CEKILME_MS[0] + 1 }).eksik.length === 2);
  defterYaz(tazeHedef[0], { basarili: true, simdi: tazeSimdi });

  // `hedefListesi` bayragi TASIYOR MU (iki kaynak da ayni yoldan geciyor)
  const karisik = hedefListesi(
    [{ traktId: '77', type: 'movie', tazele: true }, { traktId: '78', type: 'movie' }], 'tr');
  T.ok('hedefListesi tazele bayragini tasiyor',
    karisik[0].zorla === true && karisik[1].zorla === undefined);

  // ==================================================================
  T.H('📥 AKTARIM KAYNAGI — Worker istemcisi (SIFIR ag istegi)');
  // ==================================================================
  const eskiUrl = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL;
  const eskiSir = process.env.PI_SYNC_SECRET;

  // Yapilandirma kapilari: sir/URL yoksa AGA CIKILMAZ.
  process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL = '';
  process.env.PI_SYNC_SECRET = 's'.repeat(48);
  let patladi = false;
  const hicCagirma = async () => { patladi = true; throw new Error('AGA CIKILDI'); };
  let r = await fetchImportHedefleri({ fetchImpl: hicCagirma });
  T.ok('Worker URL yoksa istek ATILMAZ', r.ok === false && r.reason === 'worker_url_yok' && !patladi);

  process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL = 'https://worker.ornek';
  process.env.PI_SYNC_SECRET = 'kisa';
  r = await tasiBekleyenleri({ fetchImpl: hicCagirma });
  T.ok('Sir 32 karakterden kisaysa istek ATILMAZ',
    r.ok === false && r.reason === 'sir_yok' && !patladi);

  process.env.PI_SYNC_SECRET = 's'.repeat(48);

  // Sahte Worker — basligi ve yolu da denetliyor.
  const wCagrilar = [];
  const sahteWorker = (govde, { ok = true, status = 200 } = {}) => async (url, opts) => {
    wCagrilar.push({ url, sir: opts.headers['x-kaymak-sync-secret'], govde: JSON.parse(opts.body) });
    return { ok, status, json: async () => govde, text: async () => JSON.stringify(govde) };
  };

  r = await fetchImportHedefleri({
    limit: 7,
    fetchImpl: sahteWorker({
      success: true,
      hedefler: [
        { source: 'trakt:show', source_id: '102', tazele: true, bekleyen: 3 },
        { source: 'trakt:movie', source_id: '8001', tazele: false, bekleyen: 1 },
        // 🔴 046 bunlari uretmemeli; uretirse Pi'ye GECMEMELI
        { source: 'trakt:episode', source_id: '9001', bekleyen: 1 },
        { source: 'trakt:show', source_id: '1),or=(id.neq.0', bekleyen: 9 },
        { source: 'tmdb:show', source_id: '5', bekleyen: 9 },
      ],
    }),
  });
  T.ok('Hedefler alindi', r.ok === true, r.reason || '');
  T.ok('🔴 Yalnizca dizi/film gecti (bolum, rakam disi kimlik, tmdb ELENDI)',
    r.items.length === 2, `${r.items.length}`);
  T.ok('Sekil fetchTakipEdilenler ile AYNI (+tazele)',
    r.items[0].traktId === '102' && r.items[0].type === 'show' && r.items[0].tazele === true);
  T.ok('Film tazele=false',
    r.items[1].traktId === '8001' && r.items[1].type === 'movie' && r.items[1].tazele === false);
  T.ok('🔑 SIRA KORUNDU (en cok bekleyen once)', r.items[0].bekleyen === 3);
  T.ok('Dogru yol ve sir basligi', wCagrilar[0].url.endsWith('/import/eksikler')
    && wCagrilar[0].sir === 's'.repeat(48) && wCagrilar[0].govde.limit === 7);

  r = await tasiBekleyenleri({
    limit: 500,
    fetchImpl: sahteWorker({ success: true, tasinan: 12, kalan: 5, devam: false }),
  });
  T.ok('Tasima sayilari okundu', r.ok === true && r.tasinan === 12 && r.kalan === 5 && r.devam === false);
  T.ok('Tasima dogru yola gitti', wCagrilar[wCagrilar.length - 1].url.endsWith('/import/bekleyenler'));

  r = await tasiBekleyenleri({ fetchImpl: sahteWorker({ success: true, tasinan: 500, kalan: 375, devam: true }) });
  T.ok('devam=true okunuyor (Pi tekrar cagirmali)', r.devam === true);

  // Bozuk/eksik yanitlar SESSIZCE 0 SAYILMAZ.
  r = await tasiBekleyenleri({ fetchImpl: sahteWorker({ success: true }) });
  T.ok('🔴 Sayisiz yanit HATA (sessizce 0 degil)', r.ok === false && r.reason === 'bicim');
  r = await fetchImportHedefleri({ fetchImpl: sahteWorker({ success: true }) });
  T.ok('🔴 hedefler dizisi yoksa HATA', r.ok === false && r.reason === 'bicim');
  r = await fetchImportHedefleri({ fetchImpl: sahteWorker({}, { ok: false, status: 502 }) });
  T.ok('HTTP hatasi sebebiyle birlikte doner', r.ok === false && r.reason === 'http_502');
  r = await tasiBekleyenleri({ fetchImpl: async () => { throw new Error('ECONNREFUSED'); } });
  T.ok('🔴 Ag hatasi THROW ETMEZ (gece zamanlayicisi cokmesin)',
    r.ok === false && r.reason === 'network');

  process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL = eskiUrl;
  process.env.PI_SYNC_SECRET = eskiSir;

  // ==================================================================
  T.H('🔴 ARDISIK HATA FRENI — devre kesici esiginin ALTINDA');
  // ==================================================================
  // 🔴 EN KRITIK IDDIA. `circuitBreaker` saglayici basina TEK singleton:
  // backfill'in yedigi hata, CANLI kullanicinin istegini de kesen devreyi
  // acar. Fren bu yuzden esigin ALTINDA olmak ZORUNDA.
  //
  // Bu iddia SABITLERI degil ARALARINDAKI ILISKIYI olcuyor (M273): iki
  // sayidan HANGISI degisirse degissin burasi kirmizi yanar.
  T.ok('🔴 ILISKI: fren < devre kesici esigi',
    ARDISIK_HATA_TAVANI < DEVRE_CONFIG.trakt.failureThreshold,
    `fren=${ARDISIK_HATA_TAVANI} esik=${DEVRE_CONFIG.trakt.failureThreshold}`);
  T.ok('Fren en az 1 deneme birakiyor', ARDISIK_HATA_TAVANI >= 1);

  const cokHedef = Array.from({ length: 20 }, (_, i) =>
    hedefleriUret({ traktId: String(20000 + i), type: 'movie' }, 'tr')[0]);

  let cagri = 0;
  const hepHata = async () => { cagri++; throw new Error('504 Gateway Timeout'); };
  const s1 = await tamamla({
    hedefler: cokHedef, fetcher: () => {}, resolve: hepHata,
    beklemeMs: 0, uyuFn: async () => {},
  });

  T.ok('🔴 Fren devreye girdi', s1.durduranSebep === 'ardisik_hata', s1.durduranSebep);
  T.ok('🔴 Devre kesici esigine ULASILMADAN durdu',
    cagri < DEVRE_CONFIG.trakt.failureThreshold,
    `${cagri} cagri < ${DEVRE_CONFIG.trakt.failureThreshold} esik`);
  T.ok('Tam olarak fren tavani kadar denendi', cagri === ARDISIK_HATA_TAVANI, `${cagri}`);
  T.ok('Kalanlar denenmedi', s1.atlanan === 20 - ARDISIK_HATA_TAVANI, `atlanan=${s1.atlanan}`);
  T.ok('Basarisiz uclar deftere yazildi',
    defterOku(hedefAnahtari(cokHedef[0])) !== null);

  // ==================================================================
  T.H('not-found ve yazim hatasi ardisik sayaca DUSMEZ');
  // ==================================================================
  // 🔴 not-found bir HATA DEGIL: saglayici saglikli cevap verdi, icerik yok.
  // Sayaca dusseydi, silinmis uc yapim ust uste geldiginde backfill kendini
  // BOSUNA durdururdu.
  const hepYok = async () => ({ status: 'not-found', data: null });
  const s2 = await tamamla({
    hedefler: cokHedef.slice(0, 10), fetcher: () => {}, resolve: hepYok,
    beklemeMs: 0, uyuFn: async () => {},
  });
  T.ok('not-found ile durmadi', s2.durduranSebep === null, String(s2.durduranSebep));
  T.ok('Hepsi denendi', s2.denenen === 10, `${s2.denenen}`);
  T.ok('bulunamadi sayildi', s2.bulunamadi === 10);
  T.ok('basarisiz sayilmadi', s2.basarisiz === 0);
  T.ok('not-found deftere yazildi (her gece denenmesin)',
    (defterOku(hedefAnahtari(cokHedef[0])) || {}).son_hata !== null);

  // 🔴 Yazim hatasi saglayicinin sucu DEGIL (disk/sema) — devre kesiciyi
  // Trakt'a karsi acmak YANLIS teshis olurdu.
  const iyiYanit = async () => ({ status: 'miss', data: [{ ids: { trakt: 1 } }] });
  const yazimHatasi = async () => ({ ok: false, reason: 'disk dolu' });
  const s3 = await tamamla({
    hedefler: cokHedef.slice(0, 10), fetcher: () => {}, resolve: iyiYanit, arsivle: yazimHatasi,
    beklemeMs: 0, uyuFn: async () => {},
  });
  T.ok('Yazim hatasi freni TETIKLEMEDI', s3.durduranSebep === null, String(s3.durduranSebep));
  T.ok('Yazim hatasi basarisiz olarak sayildi', s3.basarisiz === 10, `${s3.basarisiz}`);

  // ==================================================================
  T.H('Hiz siniri — YALNIZCA aga cikildiginda beklenir');
  // ==================================================================
  // 296 hedefin cogu onbellekte tazeyse, hepsinde beklemek isi bosuna
  // 12 dakikaya yayardi.
  let uykular = [];
  const uyuKaydet = async (ms) => { uykular.push(ms); };
  const arsivleTamam = async () => ({ ok: true });

  // 🆕 §C23: gerçek orkestratör önbellek isabetinde artık `fetchedAt` DÖNDÜRÜYOR.
  // Sahte de öyle dönmeli — damgasız isabet artık YAZILMIYOR (aşağıda ayrı iddia).
  const tazeden = async () => ({ status: 'fresh', data: [{ ids: { trakt: 1 } }], fetchedAt: Date.now() - 1000 });
  const s4 = await tamamla({
    hedefler: cokHedef.slice(0, 5), fetcher: () => {}, resolve: tazeden,
    arsivle: arsivleTamam, beklemeMs: 2500, uyuFn: uyuKaydet,
  });
  T.ok('Onbellekten gelende HIC beklenmedi', uykular.length === 0, `${uykular.length} uyku`);
  T.ok('Onbellekten sayaci dogru', s4.onbellekten === 5 && s4.agdanCekilen === 0);
  T.ok('Onbellekten gelen de ARSIVE yazildi', s4.yazilan === 5, `${s4.yazilan}`);

  uykular = [];
  const agdan = async () => ({ status: 'miss', data: [{ ids: { trakt: 1 } }] });
  const s5 = await tamamla({
    hedefler: cokHedef.slice(0, 5), fetcher: () => {}, resolve: agdan,
    arsivle: arsivleTamam, beklemeMs: 2500, uyuFn: uyuKaydet,
  });
  T.ok('Agdan cekilende her seferinde beklendi', uykular.length === 5, `${uykular.length} uyku`);
  T.ok('Bekleme suresi dogru', uykular.every((u) => u === 2500));
  T.ok('agdanCekilen sayaci dogru', s5.agdanCekilen === 5 && s5.onbellekten === 0);

  // ==================================================================
  T.H('--limit ve arsivleme sozlesmesi');
  // ==================================================================
  const s6 = await tamamla({
    hedefler: cokHedef, fetcher: () => {}, resolve: agdan, arsivle: arsivleTamam,
    limit: 3, beklemeMs: 0, uyuFn: async () => {},
  });
  T.ok('--limit uygulandi', s6.denenen === 3, `${s6.denenen}`);
  T.ok('limit sebebi raporlandi', s6.durduranSebep === 'limit');

  // 🔴 Arsive giden `path`/`query`, HEDEFIN kendisi olmali — orchestrator'in
  // dondurdugu bir sey degil. Yol degisirse yazici kimligi/dili yanlis cozer.
  const gorulen = [];
  await tamamla({
    hedefler: dHedef, fetcher: () => {}, resolve: agdan,
    arsivle: async (arg) => { gorulen.push(arg); return { ok: true }; },
    beklemeMs: 0, uyuFn: async () => {},
  });
  T.ok('Arsive family=aile adi gecti', gorulen.every((g) => ['show_detail', 'show_seasons'].includes(g.family)));
  T.ok('Arsive HEDEFIN yolu gecti',
    gorulen.some((g) => g.path === '/shows/1388/seasons'));
  T.ok('Arsive HEDEFIN query\'si gecti (dil dogru)',
    gorulen.find((g) => g.family === 'show_detail').query.translations === 'tr');
  T.ok('Arsive provider=trakt gecti', gorulen.every((g) => g.provider === 'trakt'));

  // ==================================================================
  T.H('🔴 §C23-A — ARSIVIN DAMGASI YALAN SOYLEMEZ');
  // ==================================================================
  // M387'de canli veriyle olculdu: iki gecede 60 "tazelemenin" 28'i sahteydi.
  // Onbellekten gelen 15,9 gunluk veri `fetchedAt` gecirilmedigi icin
  // `upsertPayload` varsayilani `Date.now()` ile "bu gece cekildi" diye yazildi.
  const ESKI = Date.now() - 16 * 24 * 3600 * 1000; // M387'deki gercek yas
  const damgalar = [];
  const damgaKaydet = async (arg) => { damgalar.push(arg.fetchedAt); return { ok: true }; };

  const s7 = await tamamla({
    hedefler: cokHedef.slice(0, 2), fetcher: () => {},
    resolve: async () => ({ status: 'fresh', data: [{ ids: { trakt: 1 } }], fetchedAt: ESKI }),
    arsivle: damgaKaydet, beklemeMs: 0, uyuFn: async () => {},
  });
  T.ok('🔴 Onbellek isabetinde damga ZARFTAN geldi (simdi DEGIL)',
    damgalar.length === 2 && damgalar.every((d) => d === ESKI), damgalar.map((d) => new Date(d).toISOString()).join(','));
  T.ok('...ve yine de yazildi (veri dogru, yalnizca yasi dogru)', s7.yazilan === 2);

  damgalar.length = 0;
  const s8 = await tamamla({
    hedefler: cokHedef.slice(0, 2), fetcher: () => {},
    resolve: async () => ({ status: 'stale', data: [{ ids: { trakt: 1 } }], fetchedAt: ESKI }),
    arsivle: damgaKaydet, beklemeMs: 0, uyuFn: async () => {},
  });
  T.ok('Bayat (SWR) isabette de damga zarftan', damgalar.every((d) => d === ESKI) && s8.yazilan === 2);

  // 🔴 Damgasi olmayan isabet YAZILMAZ: `Date.now()` ile doldurmak tam da
  // duzeltilen yalani geri getirirdi.
  damgalar.length = 0;
  const s9 = await tamamla({
    hedefler: cokHedef.slice(0, 2), fetcher: () => {},
    resolve: async () => ({ status: 'fresh', data: [{ ids: { trakt: 1 } }] }),
    arsivle: damgaKaydet, beklemeMs: 0, uyuFn: async () => {},
  });
  T.ok('🔴 DAMGASIZ onbellek isabeti arsive YAZILMADI', damgalar.length === 0 && s9.yazilan === 0, `yazilan=${s9.yazilan}`);
  T.ok('...basarisiz sayildi (sessizce yutulmadi)', s9.basarisiz === 2);
  T.ok('...ama ardisik hata FRENINI tetiklemedi (saglayici sucsuz)', s9.durduranSebep === null, String(s9.durduranSebep));

  damgalar.length = 0;
  const TAZE = Date.now() - 50;
  await tamamla({
    hedefler: cokHedef.slice(0, 1), fetcher: () => {},
    resolve: async () => ({ status: 'miss', data: [{ ids: { trakt: 1 } }], fetchedAt: TAZE }),
    arsivle: damgaKaydet, beklemeMs: 0, uyuFn: async () => {},
  });
  T.ok('Aga gidildiyse damga zarftan (gercek cekilme ani)', damgalar[0] === TAZE);

  damgalar.length = 0;
  const once = Date.now();
  await tamamla({
    hedefler: cokHedef.slice(0, 1), fetcher: () => {},
    resolve: async () => ({ status: 'passthru', data: [{ ids: { trakt: 1 } }] }),
    arsivle: damgaKaydet, beklemeMs: 0, uyuFn: async () => {},
  });
  T.ok('Aga gidilip damga yoksa Date.now() — o durumda DOGRU olan bu', damgalar[0] >= once);

  // ==================================================================
  T.H('🔴 §C23 — saglayiciya ULASILAMADI: yedekten donen veri tazeleme DEGIL');
  // ==================================================================
  // Orkestrator saglayici cokunce firlatmiyor, eski veriyi donuyor. Eskiden
  // backfill bunu "agdan cekildi" sayip "simdi" damgasiyla yaziyordu VE
  // `ardisikHata`yi sifirliyordu — Trakt cokukken fren hic calismiyordu.
  for (const durum of ['grace-fallback', 'archive-fallback']) {
    damgalar.length = 0;
    const sY = await tamamla({
      hedefler: cokHedef.slice(0, 10), fetcher: () => {},
      resolve: async () => ({ status: durum, data: [{ ids: { trakt: 1 } }], fetchedAt: ESKI }),
      arsivle: damgaKaydet, beklemeMs: 0, uyuFn: async () => {},
    });
    T.ok(`🔴 ${durum}: arsive YAZILMADI`, damgalar.length === 0 && sY.yazilan === 0, `yazilan=${sY.yazilan}`);
    T.ok(`${durum}: basarisiz + yedektenDonen sayildi`, sY.basarisiz === ARDISIK_HATA_TAVANI && sY.yedektenDonen === ARDISIK_HATA_TAVANI,
      `basarisiz=${sY.basarisiz} yedekten=${sY.yedektenDonen}`);
    T.ok(`🔴 ${durum}: ARDISIK HATA FRENI calisti (devre kesiciden once durdu)`, sY.durduranSebep === 'ardisik_hata', String(sY.durduranSebep));
    T.ok(`${durum}: agdan/onbellekten sayilmadi`, sY.agdanCekilen === 0 && sY.onbellekten === 0);
  }

  // ==================================================================
  T.H('🔴 §C23-B — tazelik bakimi LazyFetch onbellegini YAS SINIRIYLA atlar');
  // ==================================================================
  // LazyFetch sezon arasi diziye 30 gun taze diyor; §C20 10 gun. Tazelik
  // bakimi LazyFetch'in icinden gectigi icin onun kurali kazaniyordu.
  const gorulenIstek = [];
  const istekKaydet = async (opts) => { gorulenIstek.push(opts); return { status: 'miss', data: [{ ids: { trakt: 1 } }], fetchedAt: Date.now() }; };

  const normalHedef = cokHedef[0];
  const bakimHedefi = { ...cokHedef[1], tazelikBakimi: true };
  await tamamla({
    hedefler: [normalHedef, bakimHedefi], fetcher: () => {}, resolve: istekKaydet,
    arsivle: async () => ({ ok: true }), beklemeMs: 0, uyuFn: async () => {},
  });
  T.ok('🔴 Tazelik bakimi hedefi YAS SINIRI gecti (TAZELIK_MS)',
    gorulenIstek[1] && gorulenIstek[1].maxEnvelopeAgeMs === TAZELIK_MS, String(gorulenIstek[1] && gorulenIstek[1].maxEnvelopeAgeMs));
  T.ok('🔴 NORMAL hedef sinir GECMEDI (onbellek kazanci korunur)',
    gorulenIstek[0] && gorulenIstek[0].maxEnvelopeAgeMs === undefined, String(gorulenIstek[0] && gorulenIstek[0].maxEnvelopeAgeMs));

  const sZ = await tamamla({
    hedefler: [bakimHedefi, bakimHedefi], fetcher: () => {},
    resolve: async () => ({ status: 'miss-refetched', data: [{ ids: { trakt: 1 } }], fetchedAt: Date.now(), forced: true }),
    arsivle: async () => ({ ok: true }), beklemeMs: 0, uyuFn: async () => {},
  });
  T.ok('zorlaCekilen OLCULUYOR (M387\'de bu sayi yoktu)', sZ.zorlaCekilen === 2 && sZ.agdanCekilen === 2, `zorla=${sZ.zorlaCekilen}`);

  // ── eksikleriBul isareti — §C20'nin tazeleme kovasi (daha once HIC birim testi yoktu) ──
  const devamEden = resolveOrCreate({
    type: 'show',
    externalIds: [{ source: 'trakt:show', source_id: '424242' }],
    derived: { title: 'Sezon Arasi Dizi', status: 'returning series' },
  });
  const biten = resolveOrCreate({
    type: 'show',
    externalIds: [{ source: 'trakt:show', source_id: '434343' }],
    derived: { title: 'Bitmis Dizi', status: 'ended' },
  });
  const sezonHedefi = (id) => hedefleriUret({ traktId: id, type: 'show' }, 'tr').find((h) => h.endpoint === 'show_seasons');
  await upsertPayload({ kaymakId: devamEden.kaymak_id, provider: 'trakt', endpoint: 'show_seasons', lang: '-', data: [], fetchedAt: ESKI });
  await upsertPayload({ kaymakId: biten.kaymak_id, provider: 'trakt', endpoint: 'show_seasons', lang: '-', data: [], fetchedAt: ESKI });

  const kova = eksikleriBul([sezonHedefi('424242'), sezonHedefi('434343')]);
  const isaretli = kova.eksik.find((h) => h.sourceId === '424242');
  T.ok('Devam eden + 16 gunluk show_seasons → EKSIK (tazeleme kovasi)', !!isaretli && kova.tazeleme === 1, `tazeleme=${kova.tazeleme}`);
  T.ok('🔴 ...ve tazelikBakimi ile ISARETLENDI', isaretli && isaretli.tazelikBakimi === true);
  T.ok('Bitmis dizi tazelenmez (kapsanan)', kova.kapsanan.some((h) => h.sourceId === '434343'));
  T.ok('Hic cekilmemis (eksik) hedef ISARETLENMEZ — zorla cekime gerek yok, onbellek zaten yok',
    eksikleriBul([bilinmeyen]).eksik.every((h) => h.tazelikBakimi !== true));

  // ==================================================================
  T.H('Gece zamanlayicisi — PENCERE CAKISMASI ve kurulum kapilari');
  // ==================================================================
  const zam = require(path.join(AR, 'backfillSchedule'));
  const yedekMod = require(path.join(AR, 'backup'));
  const supurucu = require(path.join(AR, '..', 'lazyfetch', 'sweeper'));

  // 🔴 EN KRITIK IDDIA: uc gece isi de AYNI SSD'ye dokunuyor ve pencereleri
  // CAKISMAMALI. Bu, sabitleri degil ARALARINDAKI ILISKIYI olcuyor (M273) —
  // biri kaydirilirsa burasi kirmizi yanar.
  //
  //   02:00-03:59 backfill (arsive YAZAR)
  //   04:00-05:59 supurucu (cache/'ten SILER)
  //   05:00-06:59 yedek    (VACUUM INTO)
  //
  // Ozellikle backfill < yedek sarti: `VACUUM INTO` kaynakta okuma kilidi
  // tutar, es zamanli yazim busy_timeout'a takilip SESSIZCE kaybedilebilir.
  // Ayrica gecenin yeni verisi AYNI GECE yedeklenmis olur (M284'te arsivin
  // 40 MB'i tam olarak yedeksiz kalmisti).
  T.ok('🔴 ILISKI: backfill penceresi YEDEK penceresinden ONCE biter',
    zam.PENCERE_SONU <= yedekMod.PENCERE_BASI,
    `backfill ${zam.PENCERE_BASI}-${zam.PENCERE_SONU} vs yedek ${yedekMod.PENCERE_BASI}-...`);
  T.ok('🔴 ILISKI: backfill penceresi SUPURUCU ile cakismiyor',
    zam.PENCERE_SONU <= supurucu.SWEEP_WINDOW_START_HOUR,
    `backfill ${zam.PENCERE_BASI}-${zam.PENCERE_SONU} vs supurucu ${supurucu.SWEEP_WINDOW_START_HOUR}-...`);
  T.ok('Pencere kendi icinde tutarli (bas < son)', zam.PENCERE_BASI < zam.PENCERE_SONU);

  // 🔴 GECELIK TAVAN, PENCEREYE SIGMALI. Olculdu (M288): 171 hedef = 468 sn.
  // Yani hedef basina ~2,74 sn. Tavan, pencerenin suresini asarsa is
  // supurucunun uzerine tasar ve iki I/O yuku ust uste biner.
  const SANIYE_PER_HEDEF = 468 / 171;
  const tavanSuresiSa = (zam.GECELIK_TAVAN * SANIYE_PER_HEDEF) / 3600;
  const pencereSa = zam.PENCERE_SONU - zam.PENCERE_BASI;
  T.ok('🔴 ILISKI: gecelik tavan pencereye SIGIYOR (olculmus hiza gore)',
    tavanSuresiSa < pencereSa,
    `${zam.GECELIK_TAVAN} hedef ~= ${tavanSuresiSa.toFixed(2)} sa < ${pencereSa} sa pencere`);

  // ---- Kurulum kapilari: eksik yapilandirmada SESSIZCE kurma.
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  T.ok('Supabase yapilandirmasi yoksa zamanlayici KURULMAZ',
    zam.startBackfillSchedule() === null);
  if (supabaseUrl) process.env.EXPO_PUBLIC_SUPABASE_URL = supabaseUrl;
  if (supabaseKey) process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = supabaseKey;

  // ---- runBackfill kapilari: THROW ETMEZ, sebep dondurur.
  const traktId = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID;
  delete process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID;
  const rTrakt = await zam.runBackfill();
  T.ok('Trakt client id yoksa ok:false (throw DEGIL)',
    rTrakt.ok === false && rTrakt.reason === 'trakt_client_id_yok', JSON.stringify(rTrakt));
  if (traktId) process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID = traktId;

  // ==================================================================
  // 🔴 ACILIS KONTROLU — "sessizce atlanan gece isi" (Madde 296)
  // ==================================================================
  // `setInterval` ILK kontrolu bir SAAT sonra yapar. Pencere 2 saat,
  // aralik 1 saat: sunucu pencerenin SON SAATINDE yeniden baslarsa ilk
  // kontrol pencerenin DISINA duser ve o gunun turu HIC KOSMAZ.
  //
  // 📏 Bu varsayim degil, CANLI OLCUM (2026-09-04 06:12): sunucu 06:09'da
  // yeniden baslatilmisti, yedek penceresi 05:00-07:00, ilk kontrol
  // 07:09'a dusuyordu. O gunun yedegi atlanacakti ve kimse fark
  // etmeyecekti.
  //
  // 🔴 ILISKI TESTI: aralik, pencereden KISA olmali. Esit/uzun olsaydi
  // acilis kontrolu olmadan pencere tamamen kacirilabilirdi.
  const pencereSaat = zam.PENCERE_SONU - zam.PENCERE_BASI;
  T.ok('🔴 ILISKI: kontrol araligi pencereden KISA',
    zam.KONTROL_ARALIGI_MS < pencereSaat * 3600 * 1000,
    `${zam.KONTROL_ARALIGI_MS / 3600000} sa < ${pencereSaat} sa`);

  // 🔴 Ayni-gun korumasi BELLEKTEN DEGIL, `sync_log`'dan okunmali:
  // bellekteki bayrak her yeniden baslatmada sifirlaniyor, yani acilis
  // kontroluyle birlikte pencere icinde uc deploy = uc tur olurdu.
  // ⚠️ DEFTER ONCE TEMIZLENIYOR: yukaridaki "ardisik hata freni" testi
  // `sync_log`'a zaten bir `backfill` satiri yazdi (fren tetiklendiginde
  // logluyor). Onu temizlemeden "bugun kosulmadi" iddiasi ANLAMSIZ olurdu —
  // ilk taslakta tam bu yuzden kirmizi yandi (2026-09-04). Test kendi
  // baslangic durumunu KURMALI, varsaymamali.
  const bag = db.getDb();
  bag.prepare("DELETE FROM sync_log WHERE event = 'backfill'").run();
  T.ok('Temiz defterde: bugun kosulmadi', zam.bugunKosulduMu(new Date()) === false);

  // DUNKU bir tur BUGUNU engellememeli — yalnizca dunun satiri var.
  bag.prepare('INSERT INTO sync_log (at, event, detail) VALUES (?, ?, ?)')
    .run(Date.now() - 26 * 3600 * 1000, 'backfill', 'dunku tur');
  T.ok('🔴 DUNKU tur bugunu ENGELLEMIYOR', zam.bugunKosulduMu(new Date()) === false);

  // Bugunun satiri eklenince ANLASILMALI — ve bu bilgi BELLEKTEN degil
  // `sync_log`'dan geliyor, yani yeniden baslatmaya dayanikli.
  bag.prepare('INSERT INTO sync_log (at, event, detail) VALUES (?, ?, ?)')
    .run(Date.now(), 'backfill', 'bugunku tur');
  T.ok('🔴 Bugunku tur sync_log dan ANLASILIYOR (bellekten degil)',
    zam.bugunKosulduMu(new Date()) === true);

  T.ok('stopBackfillSchedule cagrilabiliyor (idempotent)',
    (() => { try { zam.stopBackfillSchedule(); zam.stopBackfillSchedule(); return true; } catch (_) { return false; } })());

  db.closeArchive();
  T.bitir();
})().catch((e) => {
  console.error('TEST COKTU:', e);
  process.exit(1);
});
