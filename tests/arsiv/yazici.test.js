// ==========================================================================
// KATALOG ARŞİVİ — A2 YAZICI TESTLERİ
// ==========================================================================
// Kapsam: "kimliği aç, payload'u tek parça bırak" stratejisi ·
// iç içe transaction · hep-ya-da-hiç bütünlüğü · boş yanıt reddi.
//
// 🔴 EN KRİTİK İKİ İDDİA:
//   1. Bir dizinin TÜM hiyerarşisi TEK transaction'da yazılır. Ölçüldü
//      (`scripts/arsiv-benchmark.js`): satır başına transaction'a göre
//      **4,1× hızlı**. Ayrıca SQLite iç içe `BEGIN` kabul etmediği için
//      `db.js`'in derinlik sayacı olmadan kod ÇALIŞMAZDI bile.
//   2. Yarım hiyerarşi yazılmaz. Yarım bir kayıt, hiç olmayandan
//      TEHLİKELİDİR: A4'ün kapsam ölçümü yalan söylemeye başlar.

const path = require('path');
const { baslat, AR } = require('../yardimci');

const T = baslat('ARSIV YAZICI (A2)', { kokOneki: 'ar-yazici-' });

const db = require(path.join(AR, 'db'));
const yazici = require(path.join(AR, 'writer'));
const depo = require(path.join(AR, 'store'));
const kimlik = require(path.join(AR, 'identity'));

// 📏 GERÇEK Trakt şekli (ölçüldü 2026-08-29) — uydurulmuş değil.
const SEZONLAR = [
  {
    number: 1, title: 'Sezon 1',
    ids: { plex: { guid: 'x' }, tmdb: 3572, tvdb: 30272, trakt: 3950 },
    episodes: [
      { number: 1, season: 1, title: 'Pilot', ids: { imdb: 'tt0959621', tmdb: 62085, tvdb: 349232, trakt: 73482 } },
      { number: 2, season: 1, title: 'Cats in the Bag', ids: { imdb: 'tt1054724', tmdb: 62086, tvdb: 356976, trakt: 73483 } },
    ],
  },
  {
    number: 2, title: 'Sezon 2',
    ids: { tmdb: 3573, tvdb: 30273, trakt: 3951 },
    episodes: [
      { number: 1, season: 2, title: 'Seven Thirty-Seven', ids: { imdb: 'tt1232244', tmdb: 62090, tvdb: 438362, trakt: 73495 } },
    ],
  },
];

(async () => {
  const durum = db.initArchive();
  if (!durum.enabled) {
    T.ok('Arsiv acilamadi - kalan iddialar atlaniyor', false, durum.reason);
    T.bitir();
    return;
  }
  const h = db.getDb();

  // ======================================================================
  T.H('Hiyerarsi aciliyor, payload TEK PARCA kaliyor');
  // ======================================================================
  const r = await yazici.archiveShowSeasons({ showId: '1388', seasons: SEZONLAR, lang: 'tr' });
  T.ok('Yazim basarili', r.ok === true, `${r.seasons} sezon / ${r.episodes} bolum`);
  T.ok('2 sezon + 3 bolum entity acildi', r.seasons === 2 && r.episodes === 3);
  T.ok('Toplam 6 entity (1 dizi + 2 sezon + 3 bolum)', h.prepare('SELECT count(*) c FROM entities').get().c === 6);

  T.ok('🔴 PAYLOAD TEK SATIR — bolum basina payload YAZILMADI',
    h.prepare('SELECT count(*) c FROM payloads').get().c === 1);
  T.ok('Payload diziye bagli, endpoint show_seasons',
    h.prepare("SELECT count(*) c FROM payloads WHERE endpoint='show_seasons' AND kaymak_id=?").get(r.showKaymakId).c === 1);

  const geri = await depo.readPayload({ kaymakId: r.showKaymakId, provider: 'trakt', endpoint: 'show_seasons', lang: 'tr' });
  T.ok('Payload birebir geri okunuyor', geri.ok && geri.data.length === 2 && geri.data[0].episodes.length === 2);

  // ======================================================================
  T.H('Kimlik haritasi — bedava caprazlama yakalandi');
  // ======================================================================
  T.ok('Bolum tmdb kimliginden cozulebiliyor', kimlik.findByExternal('tmdb:episode', 62085) !== null);
  T.ok('Bolum imdb kimliginden cozulebiliyor', kimlik.findByExternal('imdb', 'tt0959621') !== null);
  T.ok('Sezon tvdb kimliginden cozulebiliyor', kimlik.findByExternal('tvdb:season', 30272) !== null);
  T.ok('Dizi istek YOLUNDAKI kimlikten cozuldu (yanit kendi ids ini tasimiyor)',
    kimlik.findByExternal('trakt:show', '1388') === r.showKaymakId);

  const bolumId = kimlik.findByExternal('tmdb:episode', 62085);
  const bolumSatir = h.prepare('SELECT type, season_number, episode_number, parent_id, title FROM entities WHERE kaymak_id=?').get(bolumId);
  T.ok('Bolum dogru sezon/bolum numarasi ve basligi tasiyor',
    bolumSatir.type === 'episode' && bolumSatir.season_number === 1 && bolumSatir.episode_number === 1 && bolumSatir.title === 'Pilot');
  T.ok('Bolum SEZONA bagli (diziye degil)',
    bolumSatir.parent_id === kimlik.findByExternal('trakt:season', 3950));

  // ======================================================================
  T.H('Idempotanlik — A2 her yenilemede yeniden yazacak');
  // ======================================================================
  const r2 = await yazici.archiveShowSeasons({ showId: '1388', seasons: SEZONLAR, lang: 'tr' });
  T.ok('Ikinci yazim basarili', r2.ok === true);
  T.ok('🔴 CIFT KAYIT URETMIYOR (hala 6 entity)', h.prepare('SELECT count(*) c FROM entities').get().c === 6);
  T.ok('Payload hala tek satir', h.prepare('SELECT count(*) c FROM payloads').get().c === 1);
  T.ok('Cakisma kaydi olusmadi', h.prepare("SELECT count(*) c FROM sync_log WHERE event='conflict'").get().c === 0);

  // ======================================================================
  T.H('Bos / bozuk yanit ARSIVLENMEZ');
  // ======================================================================
  // 📏 Gercek vaka: Trakt tanimadigi slug icin HTTP 200 + [] donduruyor.
  // Bunu arsivlemek "bu dizinin sezonu yok" yalanini KALICI yapardi.
  T.ok('Bos dizi ([]) reddediliyor', (await yazici.archiveShowSeasons({ showId: 'yok', seasons: [] })).reason === 'bos_yanit');
  T.ok('null reddediliyor', (await yazici.archiveShowSeasons({ showId: 'yok', seasons: null })).reason === 'bos_yanit');
  T.ok('Bos yanit hicbir entity yaratmadi', h.prepare('SELECT count(*) c FROM entities').get().c === 6);
  T.ok('iseYararMi: bos nesne de reddediliyor', yazici.iseYararMi({}) === false && yazici.iseYararMi({ a: 1 }) === true);

  // ======================================================================
  T.H('Ic ice transaction — SQLite BEGIN i ic ice kabul etmez');
  // ======================================================================
  // `archiveShowSeasons` kendi `transaction()` blogunu aciyor ve icinde
  // `resolveOrCreate` da aciyor. Derinlik sayaci olmasaydi "cannot start a
  // transaction within a transaction" hatasi verirdi.
  let icIce = true;
  try {
    await db.transactionAsync(async () => {
      await yazici.archiveShowSeasons({ showId: '999', seasons: SEZONLAR, lang: 'en' });
    });
  } catch (e) { icIce = false; }
  T.ok('🔴 DIS transaction icinden yazim CALISIYOR', icIce);
  T.ok('Ikinci dil ayri payload satiri acti', h.prepare('SELECT count(*) c FROM payloads').get().c === 2);

  // ======================================================================
  T.H('Hep-ya-da-hic — yarim hiyerarsi yazilmaz');
  // ======================================================================
  const oncekiEntity = h.prepare('SELECT count(*) c FROM entities').get().c;
  const oncekiPayload = h.prepare('SELECT count(*) c FROM payloads').get().c;
  let geriAlindi = false;
  try {
    await db.transactionAsync(async () => {
      await yazici.archiveShowSeasons({ showId: '5555', seasons: SEZONLAR, lang: 'tr' });
      throw new Error('yazimin ORTASINDA patla');
    });
  } catch (e) { geriAlindi = true; }
  T.ok('Hata firlatildi', geriAlindi);
  T.ok('🔴 ROLLBACK: yeni entity KALMADI', h.prepare('SELECT count(*) c FROM entities').get().c === oncekiEntity);
  T.ok('🔴 ROLLBACK: yeni payload KALMADI', h.prepare('SELECT count(*) c FROM payloads').get().c === oncekiPayload);
  T.ok('Yarim dizi kimligi de geri alindi', kimlik.findByExternal('trakt:show', '5555') === null);

  // Rollback sonrasi arsiv KULLANILABILIR kalmali (kilit sizmasi olmamali)
  const sonra = await yazici.archiveShowSeasons({ showId: '7777', seasons: SEZONLAR, lang: 'tr' });
  T.ok('Rollback sonrasi arsiv hala yazilabilir', sonra.ok === true);

  // ======================================================================
  T.H('Dispatcher ve dil cozumu');
  // ======================================================================
  T.ok('dilCoz: translations=tr -> tr', yazici.dilCoz({ translations: 'tr' }) === 'tr');
  T.ok('dilCoz: language=en-US -> en', yazici.dilCoz({ language: 'en-US' }) === 'en');
  T.ok("dilCoz: dil yoksa '-' sentineli", yazici.dilCoz({}) === '-');
  T.ok('yoldanKimlik: sayisal -> trakt:show', yazici.yoldanKimlik('show', '1388')[0].source === 'trakt:show');
  T.ok('yoldanKimlik: slug -> trakt:slug', yazici.yoldanKimlik('show', 'breaking-bad')[0].source === 'trakt:slug');

  const d1 = await yazici.archiveCatalogResponse({
    provider: 'trakt', family: 'show_seasons', path: '/shows/1388/seasons',
    query: { extended: 'full,episodes', translations: 'tr' }, data: SEZONLAR,
  });
  T.ok('Dispatcher show_seasons i dogru yonlendiriyor', d1.ok === true);
  T.ok('Kapsam disi aile reddediliyor',
    (await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'show_people', path: '/shows/1388/people', data: { cast: [] } })).reason === 'kapsam_disi_aile');
  T.ok('TMDB saglayicisi bu turda kapsam disi',
    (await yazici.archiveCatalogResponse({ provider: 'tmdb', family: 'tv_detail', path: '/tv/1396', data: { id: 1 } })).reason === 'desteklenmeyen_saglayici');
  T.ok('Cozulemeyen yol reddediliyor',
    (await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'show_seasons', path: '/bozuk/yol', data: SEZONLAR })).reason === 'yol_cozulemedi');

  // Kendi `ids` blogunu tasiyan duz yanit
  const d2 = await yazici.archiveCatalogResponse({
    provider: 'trakt', family: 'show_detail', path: '/shows/1388',
    query: { translations: 'tr' },
    data: { title: 'Breaking Bad', year: 2008, status: 'ended', ids: { trakt: 1388, slug: 'breaking-bad', tmdb: 1396 } },
  });
  T.ok('show_detail yaniti kendi ids inden cozuluyor', d2.ok === true);
  T.ok('Ayni diziye baglandi (yeni entity ACMADI)', d2.kaymakId === r.showKaymakId);
  T.ok('Turetilmis alanlar dolduruldu',
    h.prepare('SELECT title, year, status FROM entities WHERE kaymak_id=?').get(r.showKaymakId).title === 'Breaking Bad');

  T.bitir();
})();
