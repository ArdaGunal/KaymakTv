// ==========================================================================
// A3 ADIM 1 — `cache/` → ARŞİV AKTARIM TESTLERİ
// ==========================================================================
// 🔴 NEDEN TEST EDİLİYOR: bu betik, TTL'siz ve SİLMESİZ bir depoya yazıyor.
// Yanlış yazılan bir kayıt geri alınamaz. Ayrıca elle çalıştırılan bir
// araç olduğu için "bir kere denedim, çalıştı" tuzağına en açık yer burası.
//
// Betik ALT SÜREÇ olarak çalıştırılıyor — çünkü gerçek kullanımı bu ve
// `--uygula` bayrağının gerçekten kapı görevi görüp görmediği ancak
// böyle ölçülür.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');
const { baslat, AR, PROJE_KOKU } = require('../yardimci');

const T = baslat('ARSIV AKTARIMI (A3/1)', { kokOneki: 'ar-aktar-' });

const db = require(path.join(AR, 'db'));

const BETIK = path.join(PROJE_KOKU, 'scripts', 'arsiv-aktar.js');

const SEZONLAR = [
  {
    number: 1, title: 'Sezon 1',
    ids: { tmdb: 3572, tvdb: 30272, trakt: 3950 },
    episodes: [
      { number: 1, season: 1, title: 'Pilot', ids: { imdb: 'tt0959621', tmdb: 62085, tvdb: 349232, trakt: 73482 } },
      { number: 2, season: 1, title: 'Cat', ids: { imdb: 'tt1054724', tmdb: 62086, tvdb: 356976, trakt: 73483 } },
    ],
  },
];

/** Diske gerçek bir zarf yazar (diskStore ile aynı biçim). */
function zarfYaz(gorecelYol, zarf) {
  const tam = path.join(T.kok, 'cache', gorecelYol);
  fs.mkdirSync(path.dirname(tam), { recursive: true });
  fs.writeFileSync(tam, zlib.gzipSync(Buffer.from(JSON.stringify(zarf))));
  return tam;
}

function temelZarf(ek) {
  const simdi = Date.now();
  return {
    v: 1, fetchedAt: simdi, expiresAt: simdi + 3600000, hardExpiresAt: simdi + 7200000,
    lastErrorAt: null, isNegative: false, ...ek,
  };
}

function calistir(...args) {
  return spawnSync(process.execPath, ['--no-warnings', BETIK, ...args], {
    encoding: 'utf8',
    env: { ...process.env, LAZYFETCH_ROOT: T.kok, ARCHIVE_ROOT: path.join(T.kok, 'archive') },
  });
}

(async () => {
  // ------------------------------------------------------------------
  // Gerçekçi bir `cache/` kur
  // ------------------------------------------------------------------
  // 1) YENİ biçim: `requestPath` var → tam aktarılabilir
  zarfYaz('trakt/show_seasons/aa/yeni.json.gz', temelZarf({
    provider: 'trakt', family: 'show_seasons', payload: SEZONLAR,
    requestPath: '/shows/1388/seasons', requestQuery: 'extended=full,episodes&translations=tr',
  }));
  // 2) ESKİ biçim + kendi `ids`'i VAR → yol olmadan da kurtarılır
  zarfYaz('trakt/show_detail/bb/eski-kimlikli.json.gz', temelZarf({
    provider: 'trakt', family: 'show_detail',
    payload: { title: 'Breaking Bad', year: 2008, status: 'ended', ids: { trakt: 1388, slug: 'breaking-bad', tmdb: 1396 } },
  }));
  // 3) 🔴 ESKİ biçim + kendi `ids`'i YOK → KURTARILAMAZ (asıl sınır vakası)
  zarfYaz('trakt/show_seasons/cc/eski-yolsuz.json.gz', temelZarf({
    provider: 'trakt', family: 'show_seasons', payload: SEZONLAR,
  }));
  // 4) Kapsam dışı sağlayıcı
  zarfYaz('tmdb/tv_detail/dd/tmdb.json.gz', temelZarf({
    provider: 'tmdb', family: 'tv_detail', payload: { id: 1396, name: 'Breaking Bad' },
    requestPath: '/tv/1396',
  }));
  // 5) Kapsam dışı Trakt ailesi
  zarfYaz('trakt/show_people/ee/kadro.json.gz', temelZarf({
    provider: 'trakt', family: 'show_people', payload: { cast: [{ id: 1 }] },
    requestPath: '/shows/1388/people',
  }));
  // 6) Negatif kayıt — arşiv yokluk bilgisi saklamaz
  zarfYaz('trakt/show_detail/ff/negatif.json.gz', temelZarf({
    provider: 'trakt', family: 'show_detail', payload: null, isNegative: true,
    requestPath: '/shows/999999',
  }));
  // 7) Bozuk dosya — çökmemeli
  const bozuk = path.join(T.kok, 'cache', 'trakt/show_detail/gg/bozuk.json.gz');
  fs.mkdirSync(path.dirname(bozuk), { recursive: true });
  fs.writeFileSync(bozuk, Buffer.from('BU GZIP DEGIL'));

  // ==================================================================
  T.H('KURU CALISMA — hicbir sey yazilmamali');
  // ==================================================================
  const kuru = calistir();
  T.ok('Betik hatasiz bitti', kuru.status === 0, 'cikis ' + kuru.status);
  T.ok('Kuru calisma oldugunu soyluyor', /KURU ÇALIŞMA/.test(kuru.stdout));
  T.ok('2 kayit aktarilabilir gorundu', /Aktarilabilir\s+:\s*2/.test(kuru.stdout), (kuru.stdout.match(/Aktarilabilir.*/) || [''])[0].trim());
  T.ok('Bozuk dosya sayildi, cokme YOK', /okunamayan\s+:\s*1/.test(kuru.stdout));
  T.ok('Negatif kayit ayri sayildi', /negatif kayit\s+:\s*1/.test(kuru.stdout));
  T.ok('Kapsam disi 2 (tmdb + show_people)', /kapsam disi aile\s+:\s*2/.test(kuru.stdout));
  T.ok('🔴 Kurtarilamayan kayit RAPORLANDI', /1 kayit KURTARILAMADI/.test(kuru.stdout));

  db.initArchive();
  T.ok('🔴 KURU CALISMA arsive HICBIR SEY yazmadi',
    db.getDb().prepare('SELECT count(*) c FROM payloads').get().c === 0);
  db.closeArchive();

  // ==================================================================
  T.H('UYGULAMA — yalnizca kurtarilabilirler yaziliyor');
  // ==================================================================
  const uygula = calistir('--uygula');
  T.ok('Betik hatasiz bitti', uygula.status === 0, 'cikis ' + uygula.status);
  T.ok('Uygulama modu oldugunu soyluyor', /UYGULAMA MODU/.test(uygula.stdout));
  T.ok('Basarisiz yazim YOK', !/BASARISIZ/.test(uygula.stdout), (uygula.stdout.match(/BASARISIZ.*/) || ['yok'])[0].trim());

  db.initArchive();
  const h = db.getDb();
  const kimlik = require(path.join(AR, 'identity'));

  T.ok('2 payload yazildi', h.prepare('SELECT count(*) c FROM payloads').get().c === 2,
    h.prepare('SELECT count(*) c FROM payloads').get().c + ' payload');
  T.ok('Hiyerarsi acildi (sezon + bolum entity)',
    h.prepare("SELECT count(*) c FROM entities WHERE type='episode'").get().c === 2 &&
    h.prepare("SELECT count(*) c FROM entities WHERE type='season'").get().c === 1);
  T.ok('🔴 Yollu kayit DOGRU diziye baglandi (istek yolundan)',
    kimlik.findByExternal('trakt:show', '1388') !== null);
  T.ok('🔴 Yolsuz ama kimlikli kayit KURTARILDI (payload ids inden)',
    kimlik.findByExternal('tmdb:show', '1396') !== null);
  T.ok('Ikisi AYNI diziye cozuldu (cift kayit yok)',
    kimlik.findByExternal('trakt:show', '1388') === kimlik.findByExternal('tmdb:show', '1396'),
    h.prepare("SELECT count(*) c FROM entities WHERE type='show'").get().c + ' show entity');
  T.ok('🔴 Kurtarilamayan kayit YAZILMADI (cakisma da uretmedi)',
    h.prepare("SELECT count(*) c FROM sync_log WHERE event='conflict'").get().c === 0);
  T.ok('Kapsam disi aileler yazilmadi',
    h.prepare("SELECT count(*) c FROM payloads WHERE endpoint IN ('tv_detail','show_people')").get().c === 0);
  T.ok('Negatif kayit yazilmadi',
    h.prepare("SELECT count(*) c FROM payloads WHERE kaymak_id LIKE '%999999%'").get().c === 0);

  const oncekiEntity = h.prepare('SELECT count(*) c FROM entities').get().c;
  const oncekiPayload = h.prepare('SELECT count(*) c FROM payloads').get().c;
  db.closeArchive();

  // ==================================================================
  T.H('IDEMPOTANLIK — tekrar calistirmak zararsiz');
  // ==================================================================
  const tekrar = calistir('--uygula');
  T.ok('Ikinci kosum hatasiz', tekrar.status === 0);
  T.ok('🔴 Hicbir YENI kayit uretmedi', /yapim\s+:\s*\d+ -> \d+\s+\(\+0\)/.test(tekrar.stdout),
    (tekrar.stdout.match(/yapim.*/) || [''])[0].trim());

  db.initArchive();
  T.ok('Entity sayisi degismedi', db.getDb().prepare('SELECT count(*) c FROM entities').get().c === oncekiEntity);
  T.ok('Payload sayisi degismedi', db.getDb().prepare('SELECT count(*) c FROM payloads').get().c === oncekiPayload);
  db.closeArchive();

  // ==================================================================
  T.H('Dayaniklilik');
  // ==================================================================
  const kokSuz = spawnSync(process.execPath, ['--no-warnings', BETIK], {
    encoding: 'utf8',
    env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'LAZYFETCH_ROOT' && k !== 'ARCHIVE_ROOT')),
  });
  T.ok('LAZYFETCH_ROOT yokken temiz hata verip cikiyor (cokme degil)',
    kokSuz.status === 1 && /devre dışı/i.test(kokSuz.stderr || ''), 'cikis ' + kokSuz.status);

  T.bitir();
})();
