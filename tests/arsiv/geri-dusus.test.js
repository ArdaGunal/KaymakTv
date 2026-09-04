// ==========================================================================
// A4 — ARŞİV GERİ DÜŞÜŞÜ (karar A5) TESTLERİ
// ==========================================================================
// 🔴 NEDEN TEST EDİLİYOR: bu yol YALNIZCA SAĞLAYICI ÇÖKTÜĞÜNDE çalışır —
// yani gerçek hayatta en az gözlenen, en geç fark edilen yol. Kesinti
// anında sessizce yanlış davranırsa kimse görmez (Madde 284/286: fail-soft
// sessizdir). Bu yüzden burada NORMAL yolun bozulmadığı da ölçülüyor.
//
// 🔴 HİÇBİR AĞ İSTEĞİ YOK — `fetcher` enjekte ediliyor ve hep patlıyor.

const path = require('path');
const { baslat, AR, LF } = require('../yardimci');

const T = baslat('ARSIV GERI DUSUSU (A4)', { kokOneki: 'ar-gerid-' });

process.env.ARCHIVE_ROOT = path.join(T.kok, 'archive');
delete process.env.ARSIV_GERI_DUSUS;

const db = require(path.join(AR, 'db'));
const { archiveCatalogResponse, dilCoz, yoldanKimlik } = require(path.join(AR, 'writer'));
const { readCatalogFromArchive, geriDususAcikMi, yoldanKaymakId } = require(path.join(AR, 'reader'));
const { hedefleriUret } = require(path.join(AR, 'backfillSource'));
const { initLazyFetchPaths } = require(path.join(LF, 'paths'));
const { resolveRequest } = require(path.join(LF, 'orchestrator'));

const SEZONLAR = [{
  number: 1, title: 'Sezon 1',
  ids: { tmdb: 3572, tvdb: 30272, trakt: 3950 },
  episodes: [
    { number: 1, season: 1, title: 'Pilot', ids: { imdb: 'tt0959621', tmdb: 62085, tvdb: 349232, trakt: 73482 } },
  ],
}];
const DIZI = { title: 'Breaking Bad', year: 2008, ids: { trakt: 1388, slug: 'breaking-bad', imdb: 'tt0903747', tmdb: 1396 } };
const FILM = { title: 'The Matrix', year: 1999, ids: { trakt: 481, slug: 'the-matrix-1999', imdb: 'tt0133093', tmdb: 603 } };
const BOLUM = { season: 1, number: 1, title: 'Pilot', ids: { trakt: 73482, imdb: 'tt0959621', tmdb: 62085, tvdb: 349232 } };

const patla = () => { throw new Error('Trakt 504 Gateway Timeout'); };

(async () => {
  initLazyFetchPaths();
  const durum = db.initArchive();
  T.ok('Arsiv acildi', durum.enabled, durum.reason || '');

  // ==================================================================
  T.H('SAGLIKLI YOL — once bunu olc (devre kesici HENUZ kapali)');
  // ==================================================================
  // 🔴 BU BLOK EN BASTA OLMAK ZORUNDA. Asagidaki testler kasten patlayan
  // bir `fetcher` kullaniyor ve `circuitBreaker` 5 ardisik hatada AÇILIYOR
  // (saglayici basina TEK singleton). Devre bir kez acildiktan sonra
  // "saglayici duzeldi" senaryosunu bu surecte olcmek IMKANSIZ — istek
  // saglayiciya hic gitmez. Ilk taslakta bu blok sondaydi ve tam bu yuzden
  // kirmizi yandi (2026-09-04).
  //
  // Ayri bir yol kullaniliyor (`/shows/999001`): 1388'e basarili bir istek
  // atsaydik cache'e zarf yazilirdi ve asagidaki ARSIV geri dususu testleri
  // GRACE fallback'e kayardi — yani asil olcmek istedigimiz sey olculemezdi.
  const saglikli = await resolveRequest({
    provider: 'trakt', path: '/shows/999001',
    query: { extended: 'full', translations: 'tr' },
    fetcher: async () => ({ data: { title: 'TAZE VERI', ids: { trakt: 999001 } }, maxAgeSeconds: 3600 }),
  });
  T.ok('Saglayici saglikliyken TAZE veri geliyor (arsive hic bakilmiyor)',
    saglikli.status === 'miss' && saglikli.data.title === 'TAZE VERI',
    `${saglikli.status} / ${saglikli.data && saglikli.data.title}`);

  // ==================================================================
  T.H('Arsivi doldur (gercek yazici ile)');
  // ==================================================================
  const y1 = await archiveCatalogResponse({
    provider: 'trakt', family: 'show_detail', path: '/shows/1388',
    query: { extended: 'full', translations: 'tr' }, data: DIZI,
  });
  const y2 = await archiveCatalogResponse({
    provider: 'trakt', family: 'show_seasons', path: '/shows/1388/seasons',
    query: { extended: 'full,episodes' }, data: SEZONLAR,
  });
  const y3 = await archiveCatalogResponse({
    provider: 'trakt', family: 'movie_detail', path: '/movies/481',
    query: { extended: 'full', translations: 'tr' }, data: FILM,
  });
  const y4 = await archiveCatalogResponse({
    provider: 'trakt', family: 'episode_detail', path: '/shows/1388/seasons/1/episodes/1',
    query: { extended: 'full', translations: 'tr' }, data: BOLUM,
  });
  // Teshis: hangi ailenin NEDEN yazilamadigi cikti da gorunsun — "false"
  // gormek hata ayiklamaya yetmiyor (Madde 260: teshis edilebilirlik
  // sonradan eklenmez).
  T.ok('4 aile de arsive yazildi', y1.ok && y2.ok && y3.ok && y4.ok,
    [['show_detail', y1], ['show_seasons', y2], ['movie_detail', y3], ['episode_detail', y4]]
      .map(([a, r]) => `${a}=${r.ok ? 'ok' : r.reason}`).join(' '));

  // ==================================================================
  T.H('🔴 ILISKI: okuma anahtari YAZMA anahtariyla ayni turuyor');
  // ==================================================================
  // Bu iddia Madde 286'nin ailesini kilitliyor: iki taraf anahtari AYRI
  // hesaplasaydi bir anahtarla YAZIP baska bir anahtarla ARARDIK ve arsiv
  // "bos" gorunurdu — ustelik iki taraf da KENDI basina dogru gorunurdu.
  for (const h of [
    ...hedefleriUret({ traktId: '1388', type: 'show' }, 'tr'),
    ...hedefleriUret({ traktId: '481', type: 'movie' }, 'tr'),
  ]) {
    const okunan = await readCatalogFromArchive({
      provider: 'trakt', family: h.endpoint, path: h.path, query: h.query,
    });
    T.ok(`ILISKI: ${h.endpoint} yazilan anahtarla OKUNABILIYOR`, okunan.ok === true,
      okunan.reason || `lang=${dilCoz(h.query)}`);
  }

  // 🔴 `show_seasons` DILSIZ: yanlislikla translations eklenirse okuma KAYAR.
  const yanlisDil = await readCatalogFromArchive({
    provider: 'trakt', family: 'show_seasons', path: '/shows/1388/seasons',
    query: { extended: 'full,episodes', translations: 'tr' },
  });
  T.ok('🔴 show_seasons yanlis dille ARANIRSA bulunamaz (anahtar gercekten dile duyarli)',
    yanlisDil.ok === false && yanlisDil.reason === 'not_found', yanlisDil.reason);

  // ==================================================================
  T.H('Kimlik cozumleme — slug, sayisal ID ve hiyerarsi');
  // ==================================================================
  T.ok('Sayisal ID ile cozuluyor', yoldanKaymakId('show_detail', '/shows/1388') !== null);
  T.ok('SLUG ile de ayni yapima cozuluyor',
    yoldanKaymakId('show_detail', '/shows/breaking-bad') === yoldanKaymakId('show_detail', '/shows/1388'));
  T.ok('Film yolu /movies/ ile cozuluyor', yoldanKaymakId('movie_detail', '/movies/481') !== null);
  T.ok('🔴 Bolum HIYERARSI ile cozuluyor (dizi -> sezon -> bolum)',
    yoldanKaymakId('episode_detail', '/shows/1388/seasons/1/episodes/1') !== null);
  T.ok('Var olmayan bolum null doner',
    yoldanKaymakId('episode_detail', '/shows/1388/seasons/9/episodes/9') === null);
  T.ok('Bilinmeyen yapim null doner', yoldanKaymakId('show_detail', '/shows/99999999') === null);
  T.ok('Bozuk yol cokmuyor, null donuyor', yoldanKaymakId('show_detail', 'saçma') === null);

  // ==================================================================
  T.H('🔴🔴 OKUYUCU HICBIR SEY YARATMAZ');
  // ==================================================================
  // EN KRITIK IDDIA. Bu yol TAM DA saglayici coktugunde, yani isteklerin
  // biriktigi anda calisiyor. `resolveOrCreate` kullanilsaydi her basarisiz
  // istek arsive BOS bir entity kabugu ekler, bir Trakt kesintisi arsivi
  // binlerce sahte kayitla sisirirdi — ve arsiv hicbir seyi silmedigi icin
  // geri donusu OLMAZDI.
  const h = db.getDb();
  const eOnce = h.prepare('SELECT count(*) c FROM entities').get().c;
  const xOnce = h.prepare('SELECT count(*) c FROM external_ids').get().c;

  for (let i = 0; i < 25; i++) {
    await readCatalogFromArchive({
      provider: 'trakt', family: 'show_detail', path: `/shows/777${i}`,
      query: { extended: 'full', translations: 'tr' },
    });
    await readCatalogFromArchive({
      provider: 'trakt', family: 'episode_detail', path: `/shows/888${i}/seasons/2/episodes/3`,
      query: { extended: 'full', translations: 'tr' },
    });
  }
  T.ok('🔴 50 basarisiz okuma SIFIR entity yaratti',
    h.prepare('SELECT count(*) c FROM entities').get().c === eOnce, `${eOnce} -> ${h.prepare('SELECT count(*) c FROM entities').get().c}`);
  T.ok('🔴 50 basarisiz okuma SIFIR dis kimlik yaratti',
    h.prepare('SELECT count(*) c FROM external_ids').get().c === xOnce);

  // ==================================================================
  T.H('Kapsam kapilari — sessizce genislemiyor');
  // ==================================================================
  const tmdb = await readCatalogFromArchive({ provider: 'tmdb', family: 'tv_detail', path: '/tv/1396', query: {} });
  T.ok('TMDB desteklenmiyor', tmdb.ok === false && tmdb.reason === 'desteklenmeyen_saglayici');

  const kapsamDisi = await readCatalogFromArchive({
    provider: 'trakt', family: 'show_people', path: '/shows/1388/people', query: {},
  });
  T.ok('🔴 show_people arsivde YOK -> geri dusus kapsam disi',
    kapsamDisi.ok === false && kapsamDisi.reason === 'kapsam_disi_aile', kapsamDisi.reason);

  // ==================================================================
  T.H('Acil kapatma anahtari (ARSIV_GERI_DUSUS)');
  // ==================================================================
  T.ok('Varsayilan ACIK', geriDususAcikMi() === true);
  for (const v of ['0', 'false', 'off', 'HAYIR']) {
    process.env.ARSIV_GERI_DUSUS = v;
    T.ok(`"${v}" ile KAPANIYOR`, geriDususAcikMi() === false);
  }
  process.env.ARSIV_GERI_DUSUS = '0';
  const kapali = await readCatalogFromArchive({
    provider: 'trakt', family: 'show_detail', path: '/shows/1388',
    query: { extended: 'full', translations: 'tr' },
  });
  T.ok('Kapaliyken arsivden OKUMUYOR', kapali.ok === false && kapali.reason === 'geri_dusus_kapali');
  delete process.env.ARSIV_GERI_DUSUS;
  T.ok('Silinince tekrar ACIK', geriDususAcikMi() === true);

  // ==================================================================
  T.H('🔴 ORKESTRATOR ENTEGRASYONU — asil davranis');
  // ==================================================================
  // Saglayici patliyor VE cache bos: A4 oncesi burada HATA firlatilirdi.
  const r1 = await resolveRequest({
    provider: 'trakt', path: '/shows/1388',
    query: { extended: 'full', translations: 'tr' }, fetcher: patla,
  });
  T.ok('🔴 Saglayici coktu + cache bos -> ARSIVDEN dondu', r1.status === 'archive-fallback', r1.status);
  T.ok('Donen veri arsivdeki veri', r1.data && r1.data.ids && r1.data.ids.trakt === 1388);

  // 🔴 AYRI DURUM ADI: operator "kullanici ne gordu"yu OLCEREK cevaplamali
  // (M261). `grace-fallback` ile ayni ada koysaydik, kesinti sirasinda
  // verinin cache'ten mi arsivden mi geldigini bir daha ayirt edemezdik.
  T.ok('🔴 Durum adi grace-fallback DEGIL, archive-fallback', r1.status !== 'grace-fallback');

  const r2 = await resolveRequest({
    provider: 'trakt', path: '/shows/1388/seasons',
    query: { extended: 'full,episodes' }, fetcher: patla,
  });
  T.ok('show_seasons (DILSIZ) da geri dusuyor', r2.status === 'archive-fallback', r2.status);
  T.ok('Sezon verisi dogru', Array.isArray(r2.data) && r2.data[0].number === 1);

  const r3 = await resolveRequest({
    provider: 'trakt', path: '/shows/1388/seasons/1/episodes/1',
    query: { extended: 'full', translations: 'tr' }, fetcher: patla,
  });
  T.ok('episode_detail de geri dusuyor', r3.status === 'archive-fallback', r3.status);

  // ---- Arsivde OLMAYAN bir yapim: orijinal saglayici hatasi KORUNMALI.
  let hata = null;
  try {
    await resolveRequest({
      provider: 'trakt', path: '/shows/424242',
      query: { extended: 'full', translations: 'tr' }, fetcher: patla,
    });
  } catch (e) { hata = e; }
  T.ok('Arsivde de yoksa HATA firlatiliyor', hata !== null);
  // 🔴 Geri dusus, tesihisi BOZMAMALI: kullanici/operator "Trakt 504 verdi"
  // gormeli, "sqlite ..." degil.
  T.ok('🔴 ORIJINAL saglayici hatasi korundu (okuyucu hatasi ezmedi)',
    hata && /504/.test(hata.message), hata && hata.message);

  // ---- Kapsam disi aile: geri dusus YOK, hata aynen gecmeli.
  let hata2 = null;
  try {
    await resolveRequest({
      provider: 'trakt', path: '/shows/1388/people', query: {}, fetcher: patla,
    });
  } catch (e) { hata2 = e; }
  T.ok('Arsivlenmeyen ailede geri dusus YOK, hata firlatiliyor',
    hata2 !== null && /504/.test(hata2.message));

  // ==================================================================
  T.H('🔴 ARSIVDEN GELEN VERI CACHE E YAZILMAZ');
  // ==================================================================
  // Yazsaydik: TTL'i OLMAYAN bir kaydi TTL'li bir depoya "taze" diye
  // yazmis olurduk ve saglayici duzeldikten SONRA bile eski veriyi taze
  // sayip servis etmeye devam ederdik. Ayrica kesinti bitince ilk istek
  // saglayiciya gitmeli; cache'i arsivle doldurmak onu TTL boyunca
  // ERTELERDI.
  const fs = require('fs');
  const { getLazyFetchDir } = require(path.join(LF, 'paths'));
  const cacheDir = getLazyFetchDir('cache');
  const cacheSay = () => {
    let n = 0;
    (function say(d) {
      let g; try { g = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const x of g) {
        if (x.isDirectory()) say(path.join(d, x.name));
        else if (x.name.endsWith('.json.gz')) n++;
      }
    })(cacheDir);
    return n;
  };
  // Baslangictaki SAGLIKLI istek 1 zarf yazdi; arsiv geri dususleri HIC
  // yazmamali. "Sifir dosya" yerine "saglikli istegin yazdigi kadar" demek,
  // iddiayi hem daha kesin hem de ileride bozulmaya dayanikli yapiyor.
  T.ok('🔴 Arsiv geri dususleri cache e HIC yazmadi', cacheSay() === 1,
    `${cacheSay()} dosya (yalnizca ilk saglikli istegin zarfi olmali)`);

  // ==================================================================
  T.H('🔴 ORTAYA CIKAN DAVRANIS: devre kesici + geri dusus etkilesimi');
  // ==================================================================
  // Bu blok BIR TESTIN KIRMIZI YANMASIYLA kesfedildi (2026-09-04) ve
  // sonradan BILINCLI bir davranis olarak kayda gecirildi.
  //
  // Yukaridaki patlayan `fetcher` 5 ardisik hatayi asti, yani `trakt`
  // devresi ARTIK ACIK. Devre acikken `fetchAndStore` saglayiciyi HIC
  // ARAMAZ, `CircuitOpenError` firlatir — ve orchestrator bunu normal bir
  // saglayici hatasi gibi ele alir. Sonuc: **saglayici o an duzelmis olsa
  // bile, devre kapanana kadar (30 sn) arsivden servis devam eder.**
  //
  // ✅ Bu DOGRU davranis: devre kesicinin isi zaten "coken saglayiciyi
  // bosuna dovme". Arsivden servis, hata dondurmekten kesinlikle iyidir.
  //
  // 🔴 AMA OPERASYONEL SONUCU VAR ve kayda gecmeli: A4 ONCESI acik bir
  // devre KULLANICIYA HATA olarak gorunurdu. Artik SESSIZCE eski veri
  // olarak gorunuyor. Yani "her sey yolunda sanip aslinda 30 sn bayat
  // veri servis etmek" mumkun — fail-soft sessizdir (M284/286).
  // Tek gorunur iz: `x-lazyfetch: archive-fallback` basligi. Denetci ve
  // telemetri bu durumu SAYMALI (MASTER_PLAN acik is).
  const cb = require(path.join(LF, 'circuitBreaker'));
  T.ok('Devre kesici (trakt) su an ACIK — patlayan fetcher esigi asti',
    cb.canRequest('trakt') === false);

  const r4 = await resolveRequest({
    provider: 'trakt', path: '/shows/1388',
    query: { extended: 'full', translations: 'tr' },
    fetcher: async () => ({ data: { ...DIZI, title: 'TAZE VERI' }, maxAgeSeconds: 3600 }),
  });
  T.ok('🔴 Devre ACIKKEN saglayici duzelse bile ARSIVDEN servis suruyor',
    r4.status === 'archive-fallback', r4.status);
  T.ok('Ve donen veri arsivdeki (taze olan DEGIL) — beklenen',
    r4.data.title === 'Breaking Bad', r4.data.title);

  // ---- Devre KAPALIYKEN taze verinin aktigi zaten en bastaki blokta
  // olculdu (`/shows/999001` -> status 'miss'). Ikisi birlikte sunu
  // kanitliyor: arsive KILITLENMIYORUZ, yalnizca devre acikken oradan
  // servis ediyoruz.
  T.ok('Devre KAPALIYKEN taze veri akiyordu (bastaki olcum)',
    saglikli.status === 'miss' && saglikli.data.title === 'TAZE VERI');

  // ==================================================================
  T.H('🔴 GORUNURLUK — sayaclar ve DENETCI (Madde 260 kurali)');
  // ==================================================================
  // A4'un dogurdugu kor nokta: A4 ONCESI acik bir devre kullaniciya HATA
  // olarak gorunurdu; artik SESSIZCE eski veri olarak gorunuyor. Sayac ve
  // denetci olmadan "sistem haftalardir arsivden servis ediyor" durumunu
  // KIMSE fark etmezdi (M284/286: fail-soft sessizdir).
  const stats = require(path.join(AR, 'stats'));
  const sayac = stats.readFallbackStats();

  // Yukaridaki entegrasyon testleri 4 basarili geri dusus uretti
  // (show_detail, show_seasons, episode_detail, + devre acikken show_detail).
  T.ok('Geri dususler SAYILDI', sayac.toplam >= 4, `toplam=${sayac.toplam}`);
  T.ok('Ilk olay damgasi var', typeof sayac.ilkAt === 'number');
  T.ok('Son olay damgasi var', typeof sayac.sonAt === 'number');
  T.ok('Son >= ilk', sayac.sonAt >= sayac.ilkAt);
  T.ok('Aile bazinda ayrisiyor', sayac.aileler.length >= 2,
    sayac.aileler.map((a) => a.aile + '=' + a.adet).join(' '));
  T.ok('show_seasons geri dususu sayildi',
    sayac.aileler.some((a) => a.aile === 'show_seasons' && a.adet >= 1));

  // 🔴 SAYAC KATALOG VERISI DEGIL: `meta` tablosunda duruyor, yani sema
  // surumu artmadi ve `sync_log` CHECK kisiti hic ellenmedi.
  const metaAnahtarlari = h.prepare("SELECT key FROM meta WHERE key LIKE 'fallback%'").all().length;
  T.ok('Sayaclar meta tablosunda (sema degismedi)', metaAnahtarlari >= 3, `${metaAnahtarlari} anahtar`);
  T.ok('Sema surumu HALA 1',
    h.prepare("SELECT value v FROM meta WHERE key='schema_version'").get().v === String(db.HEDEF_SEMA_SURUMU));

  // Arsiv kapaliyken sayac yazmak COKMEMELI (saglayici coktugunde cagriliyor).
  T.ok('bumpFallback throw etmiyor',
    (() => { try { stats.bumpFallback('show_detail'); return true; } catch (_) { return false; } })());

  // ---- 🔴 DENETCININ BU DURUMU GERCEKTEN BASTIGI: Madde 260'in kilidi.
  // Denetci ALT SUREC olarak calistiriliyor cunku gercek kullanimi bu.
  const { spawnSync } = require('child_process');
  const denetci = spawnSync(process.execPath, ['--no-warnings',
    path.join(T.PROJE_KOKU, 'scripts', 'lazyfetch-inspect.js'), '--arsiv'], {
    encoding: 'utf8',
    env: { ...process.env, LAZYFETCH_ROOT: T.kok, ARCHIVE_ROOT: path.join(T.kok, 'archive') },
  });
  const cikti = (denetci.stdout || '') + (denetci.stderr || '');
  T.ok('Denetci calisti', denetci.status === 0, `cikis ${denetci.status}`);

  // 🪤 REGEX'LER IKI YAZIMI DA KABUL ETMELI. Denetci `LANG` UTF-8 demiyorsa
  // ASCII'ye duser ve Turkce harfleri sadelestirir (Madde 257'nin mirasi:
  // `SADE` haritasi) — "ARŞİVDEN SERVİS" cikitida "ARSIVDEN SERVIS" olur.
  // Ilk taslakta bu iddia tam bu yuzden kirmizi yandi (2026-09-04).
  T.ok('🔴 Denetci ARSIVDEN SERVIS bolumunu BASIYOR',
    /AR[SŞ][IİI]VDEN SERV[IİI]S/i.test(cikti),
    (cikti.match(/AR[SŞ][IİI]VDEN.*/i) || ['(bulunamadi)'])[0]);
  // ⚠️ Sayac ALT SURECI BASLATMADAN HEMEN ONCE okunmali: yukaridaki
  // "bumpFallback throw etmiyor" iddiasi sayaci bir artirdi, yani en
  // bastaki `sayac` degeri artik BAYAT. (Kucuk bir ornegi, olcum aracinin
  // kendi olctugu seyi degistirmesi tuzagi.)
  const guncelToplam = stats.readFallbackStats().toplam;
  T.ok('Denetci SAYIYI gosteriyor', new RegExp(`${guncelToplam}\\s*kez`).test(cikti),
    `beklenen ${guncelToplam}`);

  // 🔴 BU IDDIA ONCE YANLIS POZITIFTI: yalnizca /show_seasons/ ariyordu ve
  // o dizge `v_kapsam` (AILE BAZINDA) tablosunda ZATEN vardi — yani geri
  // dusus blogu hic basilmasa bile YESIL yanardi. Artik yalnizca o bloga
  // ait, baska hicbir yerde gecmeyen bir cumle araniyor.
  T.ok('Denetci geri dususun NE DEMEK oldugunu acikliyor',
    /ar[sş][iı]vden cevap verildi[gğ]i/i.test(cikti));
  T.ok('Denetci son olay zamanini gosteriyor', /\n\s+son: \d{4}-\d{2}-\d{2}/.test(cikti));

  db.closeArchive();
  T.bitir();
})().catch((e) => {
  console.error('TEST COKTU:', e);
  process.exit(1);
});
