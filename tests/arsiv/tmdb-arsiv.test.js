// ==========================================================================
// K4 + K1(d) (M532) — TMDB tv_detail / movie_detail arşive yazılır ve geri döner
// ==========================================================================
// Kural: YALNIZ Trakt'tan gelmiş (tmdb eşlemesi olan) yapıma eklenir, yeni
// varlık açılmaz; anlık aktarım (Supabase) tetiklenmez; TMDB çökünce künye
// (afiş/arka plan YOLU dahil) arşivden döner. Ağ yok, sahte kök.

const path = require('path');
const { baslat, AR, LF } = require('../yardimci');

const T = baslat('TMDB ARSIVI (K4 · M532)', { kokOneki: 'ar-tmdb-' });
process.env.ARCHIVE_ROOT = path.join(T.kok, 'archive');
delete process.env.ARSIV_GERI_DUSUS;

const db = require(path.join(AR, 'db'));
const { archiveCatalogResponse } = require(path.join(AR, 'writer'));
const { readCatalogFromArchive } = require(path.join(AR, 'reader'));
const { initLazyFetchPaths } = require(path.join(LF, 'paths'));
const { resolveRequest } = require(path.join(LF, 'orchestrator'));
const { archiveQueue } = require(path.join(AR, 'queue'));

const DIZI = { title: 'Breaking Bad', year: 2008, ids: { trakt: 1388, slug: 'breaking-bad', imdb: 'tt0903747', tmdb: 1396 } };
const FILM = { title: 'The Matrix', year: 1999, ids: { trakt: 481, slug: 'the-matrix-1999', imdb: 'tt0133093', tmdb: 603 } };
const TMDB_DIZI = { id: 1396, name: 'Breaking Bad', overview: 'Lise kimya öğretmeni…', poster_path: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg', backdrop_path: '/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg' };
const TMDB_FILM = { id: 603, title: 'Matrix', poster_path: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg', backdrop_path: '/bd.jpg' };
const patla = () => { throw new Error('TMDB 503 Service Unavailable'); };

(async () => {
  initLazyFetchPaths();
  T.ok('Arsiv acildi', db.initArchive().enabled);
  const h = db.getDb();
  const say = (sql) => h.prepare(sql).get().c;

  await archiveCatalogResponse({ provider: 'trakt', family: 'show_detail', path: '/shows/1388', query: { translations: 'tr' }, data: DIZI });
  await archiveCatalogResponse({ provider: 'trakt', family: 'movie_detail', path: '/movies/481', query: { translations: 'tr' }, data: FILM });
  const varlik0 = say('SELECT count(*) c FROM entities');
  const kimlik0 = say('SELECT count(*) c FROM external_ids');

  T.H('Yazim');
  const y1 = await archiveCatalogResponse({ provider: 'tmdb', family: 'tv_detail', path: '/tv/1396', query: { language: 'tr-TR' }, data: TMDB_DIZI });
  const y2 = await archiveCatalogResponse({ provider: 'tmdb', family: 'movie_detail', path: '/movie/603', query: { language: 'tr-TR' }, data: TMDB_FILM });
  T.ok('tv_detail Trakt dizisine yazildi', y1.ok === true && !!y1.arsivId, JSON.stringify(y1));
  T.ok('movie_detail Trakt filmine yazildi', y2.ok === true && !!y2.arsivId, JSON.stringify(y2));
  const satir = h.prepare("SELECT kaymak_id, lang FROM payloads WHERE provider='tmdb' AND endpoint='tv_detail'").get();
  const dizi = h.prepare("SELECT kaymak_id FROM external_ids WHERE source='trakt:show' AND source_id='1388'").get();
  T.ok('Ayni kaymak_id (Trakt omurgasi) + dil tr', satir && satir.kaymak_id === dizi.kaymak_id && satir.lang === 'tr', JSON.stringify(satir));
  T.ok('🔴 Anlik aktarimi TETIKLEMEZ (sonucta kaymakId/showKaymakId yok)', !('kaymakId' in y1) && !('showKaymakId' in y1));

  const yok = await archiveCatalogResponse({ provider: 'tmdb', family: 'tv_detail', path: '/tv/777', query: { language: 'tr-TR' }, data: { id: 777, poster_path: '/x.jpg' } });
  T.ok('🔴 Esleme yoksa ATLANIR (trakt_kimligi_yok)', yok.ok === false && yok.reason === 'trakt_kimligi_yok');
  const uyusmaz = await archiveCatalogResponse({ provider: 'tmdb', family: 'tv_detail', path: '/tv/1396', query: { language: 'tr-TR' }, data: { id: 9, poster_path: '/y.jpg' } });
  T.ok('🔴 Yanit kimligi yoldakiyle uyusmuyorsa YAZILMAZ', uyusmaz.ok === false && uyusmaz.reason === 'yanit_kimligi_uyusmuyor');
  const bos = await archiveCatalogResponse({ provider: 'tmdb', family: 'movie_detail', path: '/movie/603', query: {}, data: {} });
  T.ok('Bos yanit yazilmaz', bos.ok === false && bos.reason === 'bos_yanit');
  const ters = await archiveCatalogResponse({ provider: 'tmdb', family: 'tv_detail', path: '/movie/603', query: {}, data: TMDB_FILM });
  T.ok('Aile ile yol tipi uyusmazsa reddedilir', ters.ok === false);
  T.ok('🔴 TMDB yazimlari YENI VARLIK/KIMLIK ACMADI', say('SELECT count(*) c FROM entities') === varlik0 && say('SELECT count(*) c FROM external_ids') === kimlik0);
  // M534: Madde 288 birlesmis varlik — tmdb:movie bir BOLUM varligina bagli
  const db2 = db.getDb();
  const bolumId = 'episode_' + 'f'.repeat(32);
  db2.prepare("INSERT INTO entities (kaymak_id, type, parent_id, season_number, episode_number, title, created_at, updated_at) VALUES (?, 'episode', NULL, 0, 22, 'SAO Ordinal Scale', 1, 1)").run(bolumId);
  db2.prepare("INSERT INTO external_ids (source, source_id, kaymak_id, first_seen_at, last_seen_at) VALUES ('tmdb:movie', '413594', ?, 1, 1)").run(bolumId);
  const tur = await archiveCatalogResponse({ provider: 'tmdb', family: 'movie_detail', path: '/movie/413594', query: { language: 'tr-TR' }, data: { id: 413594, title: 'SAO' } });
  T.ok('🔴 M534: film kunyesi BOLUM varligina yazilmaz (tur_uyusmuyor)', tur.ok === false && tur.reason === 'tur_uyusmuyor', JSON.stringify(tur));

  T.H('Okuma + orkestrator geri dususu');
  const o = await readCatalogFromArchive({ provider: 'tmdb', family: 'tv_detail', path: '/tv/1396', query: { language: 'tr-TR' } });
  T.ok('Arsivden poster_path doner', o.ok && o.data.poster_path === TMDB_DIZI.poster_path);
  const r = await resolveRequest({ provider: 'tmdb', path: '/movie/603', query: { language: 'tr-TR' }, fetcher: patla });
  T.ok('🔴 TMDB coktu + cache bos -> ARSIVDEN afis yolu', r.status === 'archive-fallback' && r.data.poster_path === TMDB_FILM.poster_path, r.status);
  const en = await readCatalogFromArchive({ provider: 'tmdb', family: 'movie_detail', path: '/movie/603', query: { language: 'en-US' } });
  T.ok('Dil ayri tutulur (en kaydi yok)', en.ok === false);

  T.H('Kuyruk: canli kanca TMDB yi yaziyor, eslemesizi sessizce atliyor');
  const hata0 = archiveQueue.getStats().hata;
  await resolveRequest({ provider: 'tmdb', path: '/tv/1396/credits', query: {}, fetcher: async () => ({ data: { cast: [] }, maxAgeSeconds: 60 }) });
  await resolveRequest({ provider: 'tmdb', path: '/tv/555', query: { language: 'tr-TR' }, fetcher: async () => ({ data: { id: 555, poster_path: '/z.jpg' }, maxAgeSeconds: 60 }) });
  await archiveQueue.drain();
  T.ok('Eslemesiz/kapsam disi TMDB hata SAYILMADI', archiveQueue.getStats().hata === hata0);
  const log = say("SELECT count(*) c FROM sync_log WHERE event='error'");
  T.ok('sync_log a hata YAZILMADI (gurultu yok)', log === 0, String(log));

  T.H('K1(b) - arsivden Trakt afis yedegi (aga cikmaz)');
  const { traktAfisYedegi, afisAdresi } = require(path.join(AR, 'traktAfis'));
  const POSTER = 'media.trakt.tv/images/shows/000/002/177/posters/medium/9cb5875b93.jpg.webp';
  await archiveCatalogResponse({ provider: 'trakt', family: 'show_detail', path: '/shows/2177', query: { translations: 'tr' },
    data: { title: 'South Park', ids: { trakt: 2177, tmdb: 2190 }, images: { poster: [POSTER] } } });
  await archiveCatalogResponse({ provider: 'trakt', family: 'movie_detail', path: '/movies/59753', query: { translations: 'en' },
    data: { title: "Ender's Game", ids: { trakt: 59753, tmdb: 80274 }, images: { poster: ['media.trakt.tv/images/movies/x/posters/medium/a.jpg.webp'] } } });
  T.ok('Dizi: tmdb 2190 -> https Trakt afisi', (await traktAfisYedegi('show', 2190)) === 'https://' + POSTER);
  T.ok('Film: yalniz en kaydi olsa da bulunur', (await traktAfisYedegi('movie', 80274)) === 'https://media.trakt.tv/images/movies/x/posters/medium/a.jpg.webp');
  T.ok('images alani olmayan yapim -> null', (await traktAfisYedegi('show', 1396)) === null);
  T.ok('Arsivde olmayan -> null (varlik yaratmaz)', (await traktAfisYedegi('show', 4242)) === null && say('SELECT count(*) c FROM entities') >= varlik0);
  T.ok('Gecersiz girdi -> null', (await traktAfisYedegi('person', 1)) === null && (await traktAfisYedegi('show', '1;DROP')) === null);
  T.ok('🔒 Trakt disi sunucu reddedilir', afisAdresi({ poster: ['evil.example.com/a.jpg'] }) === null && afisAdresi({ poster: ['media.trakt.tv/../../x'] }) !== 'https://evil');
  T.ok('walter.trakt.tv da kabul', afisAdresi({ poster: ['walter-r2.trakt.tv/images/a.jpg'] }) === 'https://walter-r2.trakt.tv/images/a.jpg');

  T.H('K1(b) - /api/afis-yedek HTTP');
  const express = require('express');
  const http = require('http');
  const app = express();
  app.use('/api/afis-yedek', require(path.join(__dirname, '..', '..', 'server', 'afisYedek')));
  const sunucu = app.listen(0);
  const port = sunucu.address().port;
  const getir = (q) => new Promise((coz, red) => {
    http.get({ host: '127.0.0.1', port, path: '/api/afis-yedek' + q, agent: false }, (y) => {
      let b = ''; y.on('data', (c) => { b += c; }); y.on('end', () => coz({ status: y.statusCode, govde: JSON.parse(b) }));
    }).on('error', red);
  });
  const ok1 = await getir('?tur=show&tmdb=2190');
  T.ok('200 + url', ok1.status === 200 && ok1.govde.url === 'https://' + POSTER, JSON.stringify(ok1));
  const yok1 = await getir('?tur=movie&tmdb=1');
  T.ok('Yoksa 200 + url:null', yok1.status === 200 && yok1.govde.url === null);
  T.ok('Gecersiz girdi 400', (await getir('?tur=show&tmdb=abc')).status === 400 && (await getir('?tur=person&tmdb=1')).status === 400);
  sunucu.closeAllConnections();
  await new Promise((r) => sunucu.close(r));

  T.bitir();
})();
