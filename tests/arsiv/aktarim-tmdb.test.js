// ==========================================================================
// M534 — `arsiv-aktar.js --yalniz-tmdb`: önbellekteki TMDB künyelerini arşive toplu aktarım
// ==========================================================================
// Kapılar: language yoksa atla · Trakt eşlemesi yoksa atla (yeni varlık YOK) · arşivde
// aynı/daha yeni kayıt varsa atla · `--yalniz-tmdb` Trakt zarflarına DOKUNMAZ. Ağ yok.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');
const { baslat, AR, PROJE_KOKU } = require('../yardimci');

const T = baslat('TMDB TOPLU AKTARIM (M534)', { kokOneki: 'ar-aktar-tmdb-' });
process.env.ARCHIVE_ROOT = path.join(T.kok, 'archive');
const BETIK = path.join(PROJE_KOKU, 'scripts', 'arsiv-aktar.js');
const db = require(path.join(AR, 'db'));

const zarfYaz = (rel, z) => {
  const tam = path.join(T.kok, 'cache', rel);
  fs.mkdirSync(path.dirname(tam), { recursive: true });
  fs.writeFileSync(tam, zlib.gzipSync(Buffer.from(JSON.stringify(z))));
};
const zarf = (ek) => ({
  v: 1, fetchedAt: Date.now() - 864e5, expiresAt: Date.now() + 864e5, hardExpiresAt: Date.now() + 2 * 864e5,
  lastErrorAt: null, isNegative: false, ...ek,
});
const calistir = (...a) => spawnSync(process.execPath, ['--no-warnings', BETIK, ...a], {
  encoding: 'utf8', env: { ...process.env, LAZYFETCH_ROOT: T.kok, ARCHIVE_ROOT: path.join(T.kok, 'archive') },
});
const satir = (re, metin) => (metin.match(re) || [''])[0];

(async () => {
  // Arşivde Trakt'tan gelmiş iki yapım (tmdb eşlemeli)
  db.initArchive();
  const { archiveCatalogResponse } = require(path.join(AR, 'writer'));
  await archiveCatalogResponse({ provider: 'trakt', family: 'show_detail', path: '/shows/1388', query: { extended: 'full', translations: 'tr' },
    data: { title: 'Breaking Bad', ids: { trakt: 1388, tmdb: 1396 } }, fetchedAt: Date.now() });
  await archiveCatalogResponse({ provider: 'trakt', family: 'movie_detail', path: '/movies/481', query: { extended: 'full', translations: 'tr' },
    data: { title: 'The Matrix', ids: { trakt: 481, tmdb: 603 } }, fetchedAt: Date.now() });
  // Canlı kancanın daha önce yazdığı, önbellektekinden YENİ bir film kaydı
  await archiveCatalogResponse({ provider: 'tmdb', family: 'movie_detail', path: '/movie/603', query: { language: 'en-US' },
    data: { id: 603, title: 'YENI', poster_path: '/yeni.jpg' }, fetchedAt: Date.now() });
  const h0 = db.getDb();
  const traktOnce = h0.prepare("SELECT fetched_at FROM payloads WHERE provider='trakt' AND endpoint='show_detail'").get().fetched_at;
  const varlikOnce = h0.prepare('SELECT count(*) c FROM entities').get().c;
  db.closeArchive();

  zarfYaz('tmdb/tv_detail/aa/1.json.gz', zarf({ provider: 'tmdb', family: 'tv_detail', payload: { id: 1396, poster_path: '/bb.jpg' }, requestPath: '/tv/1396', requestQuery: 'language=tr-TR' }));
  zarfYaz('tmdb/movie_detail/bb/2.json.gz', zarf({ provider: 'tmdb', family: 'movie_detail', payload: { id: 603, poster_path: '/m.jpg' }, requestPath: '/movie/603', requestQuery: 'language=tr-TR' }));
  zarfYaz('tmdb/movie_detail/cc/3.json.gz', zarf({ provider: 'tmdb', family: 'movie_detail', payload: { id: 603, title: 'ESKI' }, requestPath: '/movie/603', requestQuery: 'language=en-US' }));
  zarfYaz('tmdb/tv_detail/dd/4.json.gz', zarf({ provider: 'tmdb', family: 'tv_detail', payload: { id: 777 }, requestPath: '/tv/777', requestQuery: 'language=tr-TR' }));
  zarfYaz('tmdb/tv_detail/ee/5.json.gz', zarf({ provider: 'tmdb', family: 'tv_detail', payload: { id: 1396 }, requestPath: '/tv/1396' }));
  zarfYaz('tmdb/tv_detail/ff/6.json.gz', zarf({ provider: 'tmdb', family: 'tv_detail', payload: { id: 1396 } }));
  zarfYaz('tmdb/credits/gg/7.json.gz', zarf({ provider: 'tmdb', family: 'credits', payload: { cast: [] }, requestPath: '/tv/1396/credits', requestQuery: 'language=tr-TR' }));
  zarfYaz('trakt/show_detail/hh/8.json.gz', zarf({ provider: 'trakt', family: 'show_detail', payload: { title: 'ESKI TRAKT', ids: { trakt: 1388, tmdb: 1396 } }, requestPath: '/shows/1388', requestQuery: 'translations=tr' }));

  T.H('Kuru calisma');
  const k = calistir('--yalniz-tmdb');
  T.ok('Hatasiz', k.status === 0, k.stderr);
  T.ok('Aktarilabilir 2 (dizi tr + film tr)', /Aktarilabilir\s+:\s*2/.test(k.stdout), satir(/Aktarilabilir.*/, k.stdout));
  T.ok('Dilsiz 1 · eslemesiz 1 · arsivde daha yeni 1 ayri sayildi',
    /TMDB dilsiz\s+:\s*1/.test(k.stdout) && /TMDB eslemesiz\s+:\s*1/.test(k.stdout) && /TMDB arsivde yeni\s+:\s*1/.test(k.stdout), k.stdout);
  T.ok('Yolsuz eski zarf raporlandi', /1 kayit ESKI BICIM/.test(k.stdout));
  T.ok('Trakt + credits kapsam disi (2)', /kapsam disi aile\s+:\s*2/.test(k.stdout), satir(/kapsam disi.*/, k.stdout));
  db.initArchive();
  T.ok('Kuru calisma TMDB tr yazmadi', db.getDb().prepare("SELECT count(*) c FROM payloads WHERE provider='tmdb' AND lang='tr'").get().c === 0);
  db.closeArchive();

  T.H('Uygulama');
  const u = calistir('--yalniz-tmdb', '--uygula');
  T.ok('Hatasiz, BASARISIZ yok', u.status === 0 && !/BASARISIZ/.test(u.stdout), u.stdout.slice(-400));
  db.initArchive();
  const h = db.getDb();
  T.ok('2 TMDB tr satiri yazildi', h.prepare("SELECT count(*) c FROM payloads WHERE provider='tmdb' AND lang='tr'").get().c === 2);
  T.ok('🔴 Arsivdeki YENI en kaydi ezilmedi',
    JSON.parse(zlib.gunzipSync(h.prepare("SELECT body FROM payloads WHERE provider='tmdb' AND lang='en'").get().body)).title === 'YENI');
  T.ok('🔴 --yalniz-tmdb Trakt satirina DOKUNMADI',
    h.prepare("SELECT fetched_at FROM payloads WHERE provider='trakt' AND endpoint='show_detail'").get().fetched_at === traktOnce);
  T.ok('🔴 Yeni varlik ACILMADI', h.prepare('SELECT count(*) c FROM entities').get().c === varlikOnce);
  T.ok("Hicbir TMDB satiri '-' diliyle yazilmadi", h.prepare("SELECT count(*) c FROM payloads WHERE provider='tmdb' AND lang='-'").get().c === 0);
  db.closeArchive();

  T.H('Idempotan');
  const t2 = calistir('--yalniz-tmdb', '--uygula');
  T.ok('Ikinci kosum: yazim 0, uc kayit "arsivde yeni"',
    /Aktarilan\s+:\s*0/.test(t2.stdout) && /TMDB arsivde yeni\s+:\s*3/.test(t2.stdout),
    (t2.stdout.match(/Aktarilan.*|TMDB arsivde.*/g) || []).join(' | '));
  T.bitir();
})();
