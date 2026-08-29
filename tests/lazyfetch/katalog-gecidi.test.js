// ==========================================================================
// LAZYFETCH — L7 / L7+ TRAKT KATALOG GEÇİDİ TESTLERİ
// ==========================================================================
// Kapsam: beyaz liste (açık VE kapalı olması gerekenler) · adaptörün
// `Authorization` gönderememesi · `Cache-Control` çözümlemesi ·
// `no-store`/`private` davranışı · aynı adlı ailelerin sağlayıcıya göre
// ayrışması · denetçinin aileleri tanıması.
//
// 🔴 BEYAZ LİSTENİN "KAPALI" TARAFI EN AZ AÇIK TARAFI KADAR ÖNEMLİ.
// `/api/trakt-catalog` PASSTHRU'ya izin VERMEZ; yani `resolveRoute`
// "cacheable: false" derse uç 403 döner. Bir regresyon bu listeyi
// gevşetirse `/users/*` veya `/sync/*` genel bir Trakt geçidine
// dönüşürdü — `server/security.js`'in Madde 192'de kapattığı açık.
//
// 🔴 ÖLÇÜLEN BİR YANILGI KAYITLI (Madde 258): "cop Authorization gonder,
// 401 gelirse iletilmis demektir" testi KANIT DEGIL - Trakt bu ucta
// gecersiz token'i tolere edip 200 dondu. Gercek kanit, fonksiyonun
// token'i PARAMETRE OLARAK BILE ALMAMASI (`fetcher.length === 2`).

const fs = require('fs');
const path = require('path');
const { baslat, LF, PROJE_KOKU } = require('./yardimci');

const T = baslat('KATALOG GECIDI (L7 / L7+)', { kokOneki: 'lf-katalog-' });

const rr = require(path.join(LF, 'routeRegistry'));
const orch = require(path.join(LF, 'orchestrator'));
const key = require(path.join(LF, 'key'));
const { createTraktCatalogFetcher } = require(path.join(LF, 'providers', 'trakt'));
const { parseSharedMaxAge, isStorable } = require(path.join(LF, 'providers', 'cacheControl'));

(async () => {
  // ======================================================================
  T.H('Beyaz liste - ACIK olmasi gerekenler (8 aile)');
  // ======================================================================
  const acik = {
    '/shows/1388': 'show_detail',
    '/shows/1388/seasons': 'show_seasons',
    '/shows/breaking-bad/seasons': 'show_seasons',
    '/shows/1388/related': 'show_related',
    '/shows/1388/people': 'show_people',
    '/shows/breaking-bad/people': 'show_people',
    '/shows/1388/seasons/1/episodes/1': 'episode_detail',
    '/shows/1388/seasons/12/episodes/103': 'episode_detail',
    '/movies/481': 'movie_detail',
    '/movies/481/related': 'movie_related',
    '/movies/481/people': 'movie_people',
  };
  for (const [yol, beklenen] of Object.entries(acik)) {
    const r = rr.resolveRoute('trakt', yol);
    T.ok('ACIK ' + yol, r.cacheable && r.family === beklenen, r.family || 'REDDEDILDI');
  }

  // ======================================================================
  T.H('Beyaz liste - KAPALI kalmasi gerekenler');
  // ======================================================================
  const kapali = [
    // 🔴 LISTE UCLARI: `/shows/:id` deseniyle cakismamali. Cakissaydi bir
    // trend listesi `show_detail` ailesinin TTL'iyle servis edilirdi
    // (trending s-maxage=3600, detay 43200). Sayisal kisit bunu onluyor.
    '/shows/trending', '/shows/popular', '/shows/anticipated', '/shows/played', '/shows/collected',
    '/movies/trending', '/movies/popular', '/movies/boxoffice',
    // 🔴 KULLANICIYA OZEL - bu listeye ASLA giremez (02_ENVANTER.md)
    '/users/settings', '/users/me/history', '/users/me/lists',
    '/sync/history', '/sync/watchlist', '/sync/collection',
    '/calendars/my/shows', '/oauth/token',
    // Bilincli olarak kapsam disi
    '/search/show', '/search/movie', '/shows/1388/comments', '/shows/1388/ratings',
    // Yol gecisi denemeleri
    '/shows/../users/settings', '/shows/1388/seasons/../../users/settings', '/movies/../../etc/passwd',
    // Yanlis derinlik
    '/shows/1388/seasons/1', '/shows/1388/seasons/1/episodes', '/shows', '/movies',
  ];
  for (const yol of kapali) {
    T.ok('KAPALI ' + yol, rr.resolveRoute('trakt', yol).cacheable === false, rr.resolveRoute('trakt', yol).family || '403');
  }

  // ======================================================================
  T.H('Adaptor - Authorization YAPISAL olarak imkansiz');
  // ======================================================================
  const fetcher = createTraktCatalogFetcher('PUBLIC_CLIENT_ID');
  T.ok('Adaptor token i PARAMETRE OLARAK BILE ALMIYOR', fetcher.length === 2, 'fetcher.length=' + fetcher.length);
  const adaptorKaynak = fs.readFileSync(path.join(LF, 'providers', 'trakt.js'), 'utf8');
  T.ok('Adaptor kaynaginda Authorization basligi YOK', !/Authorization\s*:/.test(adaptorKaynak));

  // ======================================================================
  T.H('Cache-Control cozumlemesi');
  // ======================================================================
  // Trakt paylasimli cache'lere AYRI ve 12 KAT uzun bir TTL soyluyor.
  // max-age okunsaydi origin trafigi gereksiz yere 12 kat fazla olurdu.
  T.ok('s-maxage max-age i EZIYOR (RFC 9111 5.2.2.10)', parseSharedMaxAge('public, max-age=3600, s-maxage=43200') === 43200);
  T.ok('s-maxage yoksa max-age kullanilir (TMDB hali)', parseSharedMaxAge('public, max-age=6550') === 6550);
  T.ok('Header hic yoksa undefined (varsayilana duser)', parseSharedMaxAge(undefined) === undefined);
  T.ok('s-maxage icindeki "maxage" yanlis eslesmiyor', parseSharedMaxAge('public, s-maxage=100') === 100);

  T.ok('isStorable: public, max-age=3600 -> true', isStorable('public, max-age=3600') === true);
  T.ok('isStorable: header YOKSA true (eski davranis korunur)', isStorable(undefined) === true);
  T.ok('isStorable: no-store -> false', isStorable('no-store') === false);
  T.ok('isStorable: private -> false (paylasimli cache saklayamaz)', isStorable('private, max-age=60') === false);
  T.ok('isStorable: no-cache -> false (dogrulayamadigimizi saklamayiz)', isStorable('public, no-cache') === false);
  T.ok('isStorable: benzer kelime yanlis eslesmiyor', isStorable('public, max-age=600, x-no-storey=1') === true);

  // ======================================================================
  T.H('no-store - saglayici "saklama" dediginde');
  // ======================================================================
  let cagri = 0;
  const noStoreFetcher = async () => {
    cagri++;
    return { data: { v: 'GIZLI' }, maxAgeSeconds: 60, storable: false };
  };
  const a = await orch.resolveRequest({ provider: 'trakt', path: '/shows/9001', fetcher: noStoreFetcher });
  const b = await orch.resolveRequest({ provider: 'trakt', path: '/shows/9001', fetcher: noStoreFetcher });
  T.ok('Veri kullaniciya DONUYOR (istek basarisiz olmuyor)', a.data.v === 'GIZLI' && b.data.v === 'GIZLI');
  T.ok('Durum teshis edilebilir: x-lazyfetch: no-store', a.status === 'no-store', a.status);
  T.ok('Ikinci istek YINE saglayiciya gitti (saklanmadi)', cagri === 2, cagri + ' cagri');
  const kNoStore = key.buildCacheKey({ provider: 'trakt', family: 'show_detail', path: '/shows/9001' });
  T.ok('DISKE hic yazilmadi', !fs.existsSync(path.join(T.kok, 'cache', kNoStore.relativePath)));

  let c2 = 0;
  const eskiAdaptor = async () => { c2++; return { data: { v: 'NORMAL' }, maxAgeSeconds: 600 }; };
  await orch.resolveRequest({ provider: 'trakt', path: '/shows/9002', fetcher: eskiAdaptor });
  const ikinci = await orch.resolveRequest({ provider: 'trakt', path: '/shows/9002', fetcher: eskiAdaptor });
  T.ok('storable alani OLMAYAN adaptor eski davranisi goruyor (saklanir)', c2 === 1 && ikinci.status === 'fresh', c2 + ' cagri');

  // ======================================================================
  T.H('Ayni adli aileler saglayiciya gore ayrisiyor');
  // ======================================================================
  // L7+ Trakt'a da `episode_detail` ve `movie_detail` ekledi; TMDB'de de
  // ayni adlar var. Diskte ve denetcide karismamalari SART.
  const tmdbEp = key.buildCacheKey({ provider: 'tmdb', family: 'episode_detail', path: '/tv/1396/season/1/episode/1' });
  const traktEp = key.buildCacheKey({ provider: 'trakt', family: 'episode_detail', path: '/shows/1388/seasons/1/episodes/1' });
  T.ok('tmdb/episode_detail ile trakt/episode_detail AYRI dosyalar', tmdbEp.relativePath !== traktEp.relativePath);
  T.ok(
    'Diskte saglayiciya gore ayrisiyor',
    tmdbEp.relativePath.startsWith('tmdb/episode_detail/') && traktEp.relativePath.startsWith('trakt/episode_detail/')
  );

  // ======================================================================
  T.H('Denetci yeni aileleri taniyor mu (Madde 260 kurali)');
  // ======================================================================
  // 🔴 Madde 260: denetci L7'den once yaziImisti ve L7 sonrasi SABIT bir
  // metin basmaya devam ederek CALISAN bir sistemi "bozuk" gosterdi.
  // Kural: bir faz aile/saglayici degistiriyorsa denetci AYNI TURDA
  // guncellenmeli. Bu test o kurali otomatiklestiriyor.
  const denetciKaynak = fs.readFileSync(path.join(PROJE_KOKU, 'scripts', 'lazyfetch-inspect.js'), 'utf8');
  const aileler = ['show_detail', 'show_seasons', 'show_related', 'show_people', 'episode_detail', 'movie_detail', 'movie_related', 'movie_people'];
  for (const aile of aileler) {
    T.ok('Denetci taniyor: trakt/' + aile, denetciKaynak.includes("'trakt/" + aile + "'"));
  }
  T.ok('describe() saglayici onekiyle esliyor, yalnizca family ile DEGIL', /switch \(key\)/.test(denetciKaynak));

  // 🔴 Beyaz listedeki HER aile denetcide tanimli olmali - yeni bir uc
  // eklenip denetci unutulursa bu satir kirmizi yanar.
  const rrKaynak = fs.readFileSync(path.join(LF, 'routeRegistry.js'), 'utf8');
  const traktBolum = rrKaynak.slice(rrKaynak.indexOf('const TRAKT_ROUTES'), rrKaynak.indexOf('const PROVIDER_ROUTES'));
  const tanimliAileler = [...traktBolum.matchAll(/family: '([a-z_]+)'/g)].map((m) => m[1]);
  const eksik = tanimliAileler.filter((f) => !denetciKaynak.includes("'trakt/" + f + "'"));
  T.ok(
    'Beyaz listedeki TUM aileler denetcide tanimli',
    eksik.length === 0,
    eksik.length ? 'EKSIK: ' + eksik.join(', ') : tanimliAileler.length + ' aile'
  );

  T.bitir();
})();
