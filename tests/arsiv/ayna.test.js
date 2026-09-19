// ==========================================================================
// ARŞİV → SUPABASE AYNASI — satır biçimi (karakterizasyon) · §C30
// ==========================================================================
// 🔴 NEDEN VAR: `mirror.js`'in satır kurma mantığının HİÇ testi yoktu. §C30
// tekil aktarımı aynı satırları tek bir yapım için kurmak zorunda; iki yol
// ıraksarsa PostgREST partiyi `PGRST102` ile TAMAMEN reddeder (canlıda
// görüldü, §C18). Bu takım:
//   1) aynanın bugünkü çıktısını SABİTLER (ortak modüle taşımadan ÖNCE yazıldı)
//   2) tekil aktarımın, aynanın o yapıma ait satırlarıyla BİREBİR aynı
//      satırları ürettiğini ölçer.
//
// Ağ YOK: `global.fetch` sahte, gönderilen partiler belleğe toplanıyor.

const path = require('path');
const { baslat, AR } = require('../yardimci');

const T = baslat('AYNA SATIRLARI (C30)', { kokOneki: 'ar-ayna-' });

const db = require(path.join(AR, 'db'));
const yazici = require(path.join(AR, 'writer'));

const DIZI = {
  title: 'Breaking Bad', year: 2008, runtime: 45,
  genres: ['drama', 'crime', 'drama'],
  first_aired: '2008-01-21T02:00:00.000Z',
  ids: { trakt: 1388, slug: 'breaking-bad', tvdb: 81189, imdb: 'tt0903747', tmdb: 1396 },
};
const SEZONLAR = [
  {
    number: 1, title: 'Sezon 1', ids: { tmdb: 3572, tvdb: 30272, trakt: 3950 },
    episodes: [
      { number: 1, season: 1, title: 'Pilot', runtime: 58, first_aired: '2008-01-21T02:00:00.000Z', ids: { tmdb: 62085, tvdb: 349232, trakt: 73482 } },
      { number: 2, season: 1, title: 'Cat', runtime: 48, first_aired: 'bozuk-tarih', ids: { tmdb: 62086, tvdb: 356976, trakt: 73483 } },
    ],
  },
];
const FILM = {
  title: 'Inception', year: 2010, runtime: 148, genres: ['action'], released: '2010-07-16',
  ids: { trakt: 16662, slug: 'inception-2010', imdb: 'tt1375666', tmdb: 27205 },
};

/** Sahte fetch: `/catalog/sync` gövdelerini toplar. */
function sahteAg() {
  const partiler = [];
  global.fetch = async (url, init) => {
    const g = JSON.parse(init.body);
    partiler.push({ url, faz: g.faz, satirlar: g.satirlar, sir: init.headers['x-kaymak-sync-secret'] });
    return { ok: true, json: async () => ({ yazilan: g.satirlar.length, atlanan: 0 }), text: async () => '' };
  };
  return partiler;
}

(async () => {
  const durum = db.initArchive();
  if (!durum.enabled) {
    T.ok('Arsiv acilamadi', false, durum.reason);
    T.bitir();
    return;
  }
  process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL = 'http://sahte-worker';
  process.env.PI_SYNC_SECRET = 'x'.repeat(40);

  await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'show_detail', path: '/shows/1388', data: DIZI });
  await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'show_seasons', path: '/shows/1388/seasons', query: { extended: 'full,episodes' }, data: SEZONLAR });
  await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'movie_detail', path: '/movies/16662', data: FILM });

  const { runMirror } = require(path.join(AR, 'mirror'));

  // ======================================================================
  T.H('Ayna: faz sirasi ve satir bicimi');
  // ======================================================================
  const partiler = sahteAg();
  const r = await runMirror({ tamAyna: true });
  T.ok('Tur basarili', r.ok === true, JSON.stringify(r));

  const fazlar = partiler.map((p) => p.faz + ':' + p.satirlar.map((s) => s.type || s.source).join(','));
  T.ok('Ebeveyn once: show/movie -> season -> episode -> external_ids',
    fazlar.length === 4
      && /^entities:(show|movie),(show|movie)$/.test(fazlar[0])
      && fazlar[1] === 'entities:season'
      && fazlar[2] === 'entities:episode,episode'
      && fazlar[3].startsWith('external_ids:'),
    fazlar.join(' | '));

  const ANAHTARLAR = 'episode_number,first_aired,genres,kaymak_id,parent_id,runtime,season_number,title,tmdb_id,type,year';
  const hepsi = partiler.filter((p) => p.faz === 'entities').flatMap((p) => p.satirlar);
  T.ok('Her varlik satiri AYNI anahtar kumesi (PGRST102 kalkani)',
    hepsi.every((s) => Object.keys(s).sort().join(',') === ANAHTARLAR),
    Object.keys(hepsi[0]).sort().join(','));

  const bul = (tip, baslik) => hepsi.find((s) => s.type === tip && s.title === baslik);
  const dizi = bul('show', 'Breaking Bad');
  T.ok('Dizi: runtime/tmdb/genres/first_aired payloaddan cikarildi',
    dizi && dizi.runtime === 45 && dizi.tmdb_id === 1396
      && JSON.stringify(dizi.genres) === '["drama","crime"]'
      && dizi.first_aired === '2008-01-21T02:00:00.000Z',
    JSON.stringify(dizi));
  const film = bul('movie', 'Inception');
  T.ok('Film: released first_aired a dusuyor, tmdb film kimligi',
    film && film.runtime === 148 && film.tmdb_id === 27205 && film.first_aired === '2010-07-16T00:00:00.000Z',
    JSON.stringify(film));
  const pilot = bul('episode', 'Pilot');
  const cat = bul('episode', 'Cat');
  T.ok('Bolum: runtime + tarih show_seasons tan, tmdb bolum kimligi',
    pilot && pilot.runtime === 58 && pilot.tmdb_id === 62085 && pilot.first_aired === '2008-01-21T02:00:00.000Z'
      && pilot.season_number === 1 && pilot.episode_number === 1 && pilot.genres === null,
    JSON.stringify(pilot));
  T.ok('Bozuk tarih null olur, parti reddedilmez', cat && cat.first_aired === null && cat.runtime === 48);

  const kimlikler = partiler.find((p) => p.faz === 'external_ids').satirlar;
  T.ok('Dis kimlikler yalniz trakt:* ve retired_at anahtari tasiyor',
    kimlikler.length > 0
      && kimlikler.every((k) => k.source.startsWith('trakt:') && 'retired_at' in k)
      && kimlikler.every((k) => Object.keys(k).sort().join(',') === 'kaymak_id,retired_at,source,source_id'),
    kimlikler.map((k) => k.source).join(','));
  T.ok('Sir basligi gidiyor', partiler.every((p) => p.sir === 'x'.repeat(40)));

  // ======================================================================
  T.H('Tekil aktarim = aynanin o yapima ait satirlari (BIREBIR)');
  // ======================================================================
  const { altAgacFazlari, kokBul } = require(path.join(AR, 'aynaSatirlari'));
  const bag = db.getDb();
  const kok = dizi.kaymak_id;
  const fazlarT = altAgacFazlari(bag, [kok]);
  const altAgac = new Set([kok,
    ...hepsi.filter((s) => s.parent_id === kok).map((s) => s.kaymak_id)]);
  for (const s of hepsi) if (altAgac.has(s.parent_id)) altAgac.add(s.kaymak_id);

  const sirala = (a) => a.map((x) => JSON.stringify(x, Object.keys(x).sort())).sort();
  const aynaVarlik = sirala(hepsi.filter((s) => altAgac.has(s.kaymak_id)));
  const tekilVarlik = sirala(fazlarT.filter((f) => f.faz === 'entities').flatMap((f) => f.satirlar));
  T.ok('Varlik satirlari AYNI (dizi + sezon + 2 bolum)',
    tekilVarlik.length === 4 && JSON.stringify(aynaVarlik) === JSON.stringify(tekilVarlik),
    `${tekilVarlik.length} satir`);
  const aynaKimlik = sirala(kimlikler.filter((k) => altAgac.has(k.kaymak_id)));
  const tekilKimlik = sirala(fazlarT.find((f) => f.faz === 'external_ids').satirlar);
  T.ok('Dis kimlik satirlari AYNI, film SIZMIYOR',
    JSON.stringify(aynaKimlik) === JSON.stringify(tekilKimlik)
      && !tekilKimlik.some((k) => k.includes('trakt:movie')),
    `${tekilKimlik.length} kimlik`);
  T.ok('Faz sirasi ebeveyn once',
    fazlarT.map((f) => f.faz + ':' + (f.satirlar[0].type || 'kimlik')).join(',')
      === 'entities:show,entities:season,entities:episode,external_ids:kimlik');

  const bolumId = hepsi.find((s) => s.title === 'Pilot').kaymak_id;
  T.ok('kokBul: bolum -> dizi, film -> kendisi, yok -> null',
    kokBul(bag, bolumId) === kok && kokBul(bag, film.kaymak_id) === film.kaymak_id
      && kokBul(bag, 'show_' + '0'.repeat(32)) === null);
  T.ok('Bos kok listesi bos faz', altAgacFazlari(bag, []).length === 0);

  T.bitir();
})().catch((e) => {
  T.ok('Beklenmeyen hata: ' + e.message, false, e.stack);
  T.bitir();
});
