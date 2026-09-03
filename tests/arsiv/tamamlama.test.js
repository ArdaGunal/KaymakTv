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
} = require(path.join(AR, 'backfillSource'));
const {
  tamamla, eksikleriBul, arsivdeVarMi, defterOku, defterYaz, beklemedeMi,
  geriCekilme, ARDISIK_HATA_TAVANI, GERI_CEKILME_MS,
} = require(path.join(AR, 'backfill'));

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
  T.ok('Sema surumu 1 kaldi (saf EKLEMELI degisiklik)', surum.value === '1', `surum=${surum.value}`);
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

  const tazeden = async () => ({ status: 'fresh', data: [{ ids: { trakt: 1 } }] });
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

  db.closeArchive();
  T.bitir();
})().catch((e) => {
  console.error('TEST COKTU:', e);
  process.exit(1);
});
