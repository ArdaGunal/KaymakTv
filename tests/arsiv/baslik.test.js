// ==========================================================================
// BASLIK Adım 3 — aynaya giden özgün dil, özgün ad, çeviri sözlüğü (2.6.8)
// ==========================================================================
// Kararlar: `docs/testler/2.6.8.md` §0. Örnekler arşivde ÖLÇÜLMÜŞ yapımlardan: Çekiç ve Gül, Dark
// Legacy → Kötü Kan, La casa de papel, 進撃の巨人, «‎Ofis‎». Ağ YOK: `global.fetch` sahte.

const path = require('path');
const { baslat, AR } = require('../yardimci');

const T = baslat('BASLIK AYNA (Adim 3)', { kokOneki: 'ar-baslik-' });

const db = require(path.join(AR, 'db'));
const yazici = require(path.join(AR, 'writer'));
const { kokSatirlari, altAgacFazlari } = require(path.join(AR, 'aynaSatirlari'));
const { ozet } = require(path.join(__dirname, '../../scripts/baslik-doldur.js'));
const { ceviriAdi, baslikEsit, adTemizle, ayniAlfabe } = require(path.join(__dirname, '../../locales/baslikElemesi.js'));

const trakt = (id, tmdb, title, language, original_title, tur = 'show') => ({
  title, year: 2010, language, original_title,
  ids: { trakt: id, slug: `s-${id}`, [tur === 'show' ? 'tmdb' : 'tmdb']: tmdb },
});
const YAPIMLAR = [
  // id, tmdb, Trakt adı, dil, Trakt özgün, TMDB özgün, { tr, en }
  [1, 11, 'The Hammer and the Rose', 'tr', 'Çekiç ve Gül', 'Çekiç ve Gül', { tr: 'Çekiç ve Gül', en: 'The Hammer and the Rose' }],
  [2, 12, 'Dark Legacy', 'tr', 'Dark Legacy', 'Kötü Kan', { tr: 'Kötü Kan' }],
  [3, 13, 'Money Heist', 'es', 'La casa de papel', 'La casa de papel', { tr: 'La casa de papel', en: 'Money Heist' }],
  [4, 14, 'Attack on Titan', 'ja', '進撃の巨人', '進撃の巨人', { tr: '進撃の巨人' }],
  [5, 15, 'The Office', 'en', 'The Office', 'The Office', { tr: '‎Ofis‎' }],
  [6, 16, 'Kurtlar Vadisi', 'tr', 'Kurtlar Vadisi', null, {}],
  [7, 17, 'TMDB yuku yok', 'en', null, null, null],
];

(async () => {
  const durum = db.initArchive();
  if (!durum.enabled) { T.ok('Arsiv acilamadi', false, durum.reason); T.bitir(); return; }
  process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL = 'http://sahte-worker';
  process.env.PI_SYNC_SECRET = 'x'.repeat(40);

  for (const [id, tmdb, ad, dil, ozgun, tmdbOzgun, adlar] of YAPIMLAR) {
    await yazici.archiveCatalogResponse({
      provider: 'trakt', family: 'show_detail', path: `/shows/${id}`,
      query: { extended: 'full', translations: 'tr' }, data: trakt(id, tmdb, ad, dil, ozgun),
    });
    for (const [lang, name] of Object.entries(adlar || {})) {
      const y = await yazici.archiveCatalogResponse({
        provider: 'tmdb', family: 'tv_detail', path: `/tv/${tmdb}`,
        query: { language: lang === 'tr' ? 'tr-TR' : 'en-US' },
        data: { id: tmdb, name, original_name: tmdbOzgun, original_language: dil },
      });
      T.ok(`TMDB yuku yazildi (${ad} ${lang})`, y && y.ok, JSON.stringify(y));
    }
  }
  // Film + TMDB'nin aynı adlı `movie_detail` ailesi: Trakt süresi ezilmez.
  await yazici.archiveCatalogResponse({
    provider: 'trakt', family: 'movie_detail', path: '/movies/8',
    query: { extended: 'full', translations: 'tr' },
    data: { ...trakt(8, 18, 'The Avengers', 'en', 'The Avengers', 'movie'), runtime: 143 },
  });
  await yazici.archiveCatalogResponse({
    provider: 'tmdb', family: 'movie_detail', path: '/movie/18', query: { language: 'tr-TR' },
    data: { id: 18, title: 'Yenilmezler', original_title: 'The Avengers', original_language: 'en', runtime: 999 },
  });

  const bag = db.getDb();
  const satirlar = await kokSatirlari(bag);
  const bul = (ad) => satirlar.find((s) => s.title === ad);

  T.H('Eleme (BASLIK-01)');
  const hammer = bul('The Hammer and the Rose');
  T.ok('Yerli: Cekic ve Gul', hammer.original_language === 'tr' && hammer.original_title === 'Çekiç ve Gül'
    && hammer.titles.tr === 'Çekiç ve Gül', JSON.stringify(hammer));
  T.ok('Yerli: Ingilizce sozlukte de duruyor', hammer.titles.en === 'The Hammer and the Rose');
  const dark = bul('Dark Legacy');
  T.ok('Ozgun ad once TMDB: Kotu Kan', dark.original_title === 'Kötü Kan' && dark.titles.tr === 'Kötü Kan', JSON.stringify(dark));
  const heist = bul('Money Heist');
  T.ok('Ozgun dile dusmus Latin ad elenir', !('tr' in heist.titles) && heist.original_title === 'La casa de papel', JSON.stringify(heist));
  T.ok('Latin disi ad elenir', JSON.stringify(bul('Attack on Titan').titles) === '{}');
  T.ok('Gorunmez isaretler temizlenir', bul('The Office').titles.tr === 'Ofis');
  const kurt = bul('Kurtlar Vadisi');
  T.ok('TMDB yoksa Trakt ozgun adi', kurt.original_title === 'Kurtlar Vadisi' && JSON.stringify(kurt.titles) === '{}');
  const yuksuz = bul('TMDB yuku yok');
  T.ok('Yuk yoksa sozluk {} (null degil), ad null', JSON.stringify(yuksuz.titles) === '{}' && yuksuz.original_title === null);

  T.H('Saf kurallar');
  T.ok('Karsilastirma buyuk harf/noktalama/bosluk yok sayar', baslikEsit('The Hammer and The Rose', 'the hammer, and the  rose!'));
  T.ok('Bos ad esit sayilmaz', !baslikEsit('', '') && !baslikEsit('...', '---'));
  T.ok('adTemizle: bos kalirsa null', adTemizle(' ‎ ') === null && adTemizle(5) === null);
  T.ok('Tabloda olmayan alfabe reddedilir', !ayniAlfabe('Ofis', 'Cyrl'));
  T.ok('Turkce harfler ve noktalama Latin', ayniAlfabe('Çekiç ve Gül: İlk Şafak – №1 · 2', 'Latn'));
  T.ok('Ozgun dil hedef dilse ozgun ad kabul', ceviriAdi({ ad: 'Çekiç ve Gül', ozgunAd: 'Çekiç ve Gül', ozgunDil: 'tr', hedefDil: 'tr', hedefAlfabe: 'Latn' }) === 'Çekiç ve Gül');

  T.H('Film');
  const yenilmez = bul('The Avengers');
  T.ok('Film adi title alanindan', yenilmez.titles.tr === 'Yenilmezler', JSON.stringify(yenilmez));
  T.ok('TMDB ayni adli ailesi Trakt suresini ezmez', yenilmez.runtime === 143, String(yenilmez.runtime));

  T.H('Satir bicimi (BASLIK-07)');
  await yazici.archiveCatalogResponse({
    provider: 'trakt', family: 'show_seasons', path: '/shows/1/seasons', query: { extended: 'full,episodes' },
    data: [{ number: 1, ids: { trakt: 100 }, episodes: [{ number: 1, season: 1, title: 'B1', ids: { trakt: 101 } }] }],
  });
  const fazlar = altAgacFazlari(bag, [hammer.kaymak_id]).filter((f) => f.faz === 'entities').flatMap((f) => f.satirlar);
  const anahtar = (s) => Object.keys(s).sort().join(',');
  T.ok('Anlik aktarim: dizi + sezon + bolum', fazlar.length === 3, String(fazlar.length));
  T.ok('Her satir ayni anahtarlar', new Set(fazlar.map(anahtar)).size === 1);
  const alt = fazlar.filter((s) => s.type !== 'show');
  T.ok('Sezon/bolumde uc alan null', alt.every((s) => s.original_language === null && s.original_title === null && s.titles === null));
  T.ok('Anlik aktarim sozlugu aynayla ayni', JSON.stringify(fazlar.find((s) => s.type === 'show').titles) === JSON.stringify(hammer.titles));

  const sonra = await kokSatirlari(bag);
  T.ok('Ilk dolum: bolum/sezon satiri 0', sonra.every((s) => s.type === 'show' || s.type === 'movie'), String(sonra.length));
  const o = ozet(sonra);
  T.ok('Ozet: yerli 3 dizi, adsiz yerli 0', o.yerliDizi === 3 && o.yerliAdsiz.length === 0 && o.bolumSatiri === 0, JSON.stringify(o));

  T.H('Gece aynasi: yalniz TMDB yuku tazelenen yapim da gider');
  const { runMirror, imlecYaz } = require(path.join(AR, 'mirror'));
  const partiler = [];
  global.fetch = async (url, init) => {
    const g = JSON.parse(init.body);
    partiler.push(g);
    return { ok: true, json: async () => ({ yazilan: g.satirlar.length, atlanan: 0 }), text: async () => '' };
  };
  await imlecYaz(bag, Date.now());
  await new Promise((r) => setTimeout(r, 5));
  await yazici.archiveCatalogResponse({
    provider: 'tmdb', family: 'tv_detail', path: '/tv/17', query: { language: 'tr-TR' },
    data: { id: 17, name: 'Yeni Ad', original_name: 'TMDB yuku yok', original_language: 'en' },
  });
  await runMirror();
  const giden = partiler.filter((p) => p.faz === 'entities').flatMap((p) => p.satirlar);
  const yeni = giden.find((s) => s.title === 'TMDB yuku yok');
  T.ok('Yeni TMDB yuku aynaya titles ile gitti', yeni && yeni.titles.tr === 'Yeni Ad', JSON.stringify(giden.map((s) => s.title)));
  T.ok('Eski, degismemis yapim gitmedi', !giden.some((s) => s.title === 'The Hammer and the Rose'));

  T.bitir();
})().catch((e) => {
  T.ok('Beklenmeyen hata: ' + e.message, false, e.stack);
  T.bitir();
});
