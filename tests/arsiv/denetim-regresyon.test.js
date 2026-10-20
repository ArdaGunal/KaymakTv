// ==========================================================================
// DIŞ DENETİM REGRESYONU — arşiv tarafı (M549 A1 · M550 Paket C)
// ==========================================================================
// Kaynak: `docs/Lazy Down Plan/07_DENETIM_TEYIT_VE_PLAN_2026-10-20.md`. Her blok, canlıda bulunan ya da
// deponun gerçek modülleriyle YENİDEN ÜRETİLEN bir hatayı kilitler (R1–R6). Düzeltmeden önce bu
// iddiaların her biri KALIYORDU (üretim betiği: oturum scratchpad'i `uretim/uret.js`).
//
// ⚠️ R7/R8 (O-1: işlem dışı yazım açık işleme sızar / açık işlemde yedek düşer) Paket D'nin işi —
// düzeltmesiyle birlikte eklenecek; bugün eklense hatayı KANITLAYAN (kalan) test olurdu.

const path = require('path');
const zlib = require('zlib');
const { baslat, AR } = require('../yardimci');

const T = baslat('DIS DENETIM REGRESYONU — ARSIV (M549/M550)', { kokOneki: 'arsiv-denetim-' });
const db = require(path.join(AR, 'db'));
const yazici = require(path.join(AR, 'writer'));
const depo = require(path.join(AR, 'store'));
const kimlik = require(path.join(AR, 'identity'));
const { kanonikMi, sorguBicimi, kapiKaydet, kapiDurumu, kapiSayaciniSifirla } = require(path.join(AR, 'kanonik'));

const ac = (b) => JSON.parse(zlib.gunzipSync(b).toString('utf8'));
const SEZON_SORGU = { extended: 'full,episodes' };
const DETAY_SORGU = { extended: 'full', translations: 'tr' };

(async () => {
  T.ok('Arsiv acildi', db.initArchive().enabled);
  const h = db.getDb();
  const aktifTrakt = (kid, kaynak = 'trakt:episode') => h.prepare(
    'SELECT source_id FROM external_ids WHERE kaymak_id = ? AND source = ? AND retired_at IS NULL'
  ).all(kid, kaynak).map((r) => r.source_id);

  // ======================================================================
  T.H('R1 · K-3a — cift bolum ayni tvdb kimligini paylasiyor (Deadliest Catch S10E11/E12)');
  // ======================================================================
  const CIFT = [{
    number: 10, ids: { trakt: 90010, tvdb: 990010 },
    episodes: [
      { season: 10, number: 11, title: 'Women Drivers', ids: { trakt: 212650, tvdb: 4918345, tmdb: 991214, imdb: 'tt3829606' } },
      { season: 10, number: 12, title: 'Mutiny', ids: { trakt: 212651, tvdb: 4918345, tmdb: 993413, imdb: 'tt3856900' } },
    ],
  }];
  const r1 = await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'show_seasons', path: '/shows/9001/seasons', query: SEZON_SORGU, data: CIFT });
  T.ok('Yazim basarili', r1.ok === true, r1.reason);
  const e11 = kimlik.findByExternal('trakt:episode', '212650');
  const e12 = kimlik.findByExternal('trakt:episode', '212651');
  T.ok('🔴 IKI ayri bolum kaydi (eskiden TEK kayitta birlesiyordu)', e11 && e12 && e11 !== e12);
  const bolum = (kid) => h.prepare('SELECT episode_number b, title FROM entities WHERE kaymak_id = ?').get(kid);
  T.ok('Her biri KENDI yuvasinda ve KENDI adiyla', bolum(e11).b === 11 && bolum(e11).title === 'Women Drivers' && bolum(e12).b === 12 && bolum(e12).title === 'Mutiny');
  T.ok('Her kayitta TEK aktif trakt:episode', aktifTrakt(e11).length === 1 && aktifTrakt(e12).length === 1);
  T.ok('Paylasilan tvdb ilk sahibinde kaldi (repoint YOK)', kimlik.findByExternal('tvdb:episode', '4918345') === e11);
  T.ok("E12'nin kendi tmdb/imdb kimligi KENDI kaydinda", kimlik.findByExternal('tmdb:episode', '993413') === e12 && kimlik.findByExternal('imdb', 'tt3856900') === e12);
  T.ok('Engellenen birlesme sync_log a yazildi (IKINCIL_ANAHTAR_REDDI)',
    h.prepare("SELECT count(*) c FROM sync_log WHERE detail LIKE 'IKINCIL_ANAHTAR_REDDI:%'").get().c === 1);
  await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'show_seasons', path: '/shows/9001/seasons', query: SEZON_SORGU, data: CIFT });
  T.ok('Ikinci yazim kayit acmadi, ret satiri TEKRARLANMADI (gurultu yok)',
    h.prepare("SELECT count(*) c FROM entities WHERE type='episode' AND season_number=10").get().c === 2 &&
    h.prepare("SELECT count(*) c FROM sync_log WHERE detail LIKE 'IKINCIL_ANAHTAR_REDDI:%'").get().c === 1);
  const st = depo.summary();
  T.ok('IKINCIL_ANAHTAR_REDDI alarm SAYILMAZ (rutin)', st.conflicts === 0 && st.kimlikDegisimi >= 1, JSON.stringify({ c: st.conflicts, k: st.kimlikDegisimi }));

  // ======================================================================
  T.H('R2/R3 · K-3b/c — iki dizi ayni tvdb:show u paylasiyor (Hill House / Bly Manor)');
  // ======================================================================
  const detay = (title, trakt, slug, imdb, tmdb) => ({ title, year: 2018, ids: { trakt, slug, imdb, tvdb: 345246, tmdb } });
  await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'show_detail', path: '/shows/134526', query: DETAY_SORGU, data: detay('The Haunting of Hill House', 134526, 'the-haunting-of-hill-house', 'tt6763664', 72844) });
  await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'show_detail', path: '/shows/169891', query: DETAY_SORGU, data: detay('The Haunting of Bly Manor', 169891, 'the-haunting-of-bly-manor', 'tt10970552', 109958) });
  const hill = kimlik.findByExternal('trakt:show', '134526');
  const bly = kimlik.findByExternal('trakt:show', '169891');
  T.ok('🔴 IKI ayri dizi kaydi (eskiden tek kayitta birlesiyordu)', hill && bly && hill !== bly);
  const baslik = (kid) => h.prepare('SELECT title FROM entities WHERE kaymak_id = ?').get(kid).title;
  T.ok('Basliklar dogru (biri digerinin ustune yazilmadi)', baslik(hill) === 'The Haunting of Hill House' && baslik(bly) === 'The Haunting of Bly Manor');

  const sezon = (sezonTrakt, bas) => [{ number: 1, ids: { trakt: sezonTrakt },
    episodes: [1, 2, 3].map((n) => ({ season: 1, number: n, title: `B${n}`, ids: { trakt: bas + n, tvdb: bas * 10 + n, tmdb: bas * 100 + n } })) }];
  const degisimOnce = h.prepare("SELECT count(*) c FROM sync_log WHERE detail LIKE 'KIMLIK_DEGISIMI:%'").get().c;
  await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'show_seasons', path: '/shows/134526/seasons', query: SEZON_SORGU, data: sezon(5001, 600000) });
  await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'show_seasons', path: '/shows/169891/seasons', query: SEZON_SORGU, data: sezon(5002, 700000) });
  await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'show_seasons', path: '/shows/134526/seasons', query: SEZON_SORGU, data: sezon(5001, 600000) });
  T.ok('🔴 Yazim sirasi KIMLIK_DEGISIMI uretmedi (eskiden Bly Manor yuvalari ele geciriyordu)',
    h.prepare("SELECT count(*) c FROM sync_log WHERE detail LIKE 'KIMLIK_DEGISIMI:%'").get().c === degisimOnce);
  const aktifSay = (ids) => h.prepare(`SELECT count(*) c FROM external_ids WHERE source='trakt:episode' AND retired_at IS NULL AND source_id IN (${ids.map(() => '?').join(',')})`).get(...ids).c;
  T.ok('Iki dizinin bolumleri de AKTIF (3/3 + 3/3)', aktifSay(['600001', '600002', '600003']) === 3 && aktifSay(['700001', '700002', '700003']) === 3);
  T.ok('Her dizinin kendi sezonu', h.prepare('SELECT count(*) c FROM entities WHERE type=? AND parent_id IN (?, ?)').get('season', hill, bly).c === 2);

  // ======================================================================
  T.H('R4 · O-6 — emekliye ayrilmis kimlik guvenliyse yeniden etkinlesir');
  // ======================================================================
  // A3 onariminin dayandigi davranis: birlesik kayittan diger kimlikler tasininca, emekli kalan asil
  // sahibin kimligi bir sonraki yazimda geri gelir. Burada emekliligi dogrudan kuruyoruz.
  const hillB1 = kimlik.findByExternal('trakt:episode', '600001');
  h.prepare("UPDATE external_ids SET retired_at = ? WHERE source = 'trakt:episode' AND source_id = '600001'").run(Date.now() - 1000);
  T.ok('Hazirlik: kimlik emekli', aktifTrakt(hillB1).length === 0);
  await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'show_seasons', path: '/shows/134526/seasons', query: SEZON_SORGU, data: sezon(5001, 600000) });
  T.ok('🔴 Geri gelen kimlik yeniden ETKIN (eskiden sonsuza dek emekli kaliyordu)', aktifTrakt(hillB1).join() === '600001');
  T.ok('KIMLIK_GERI_DONDU kaydi yazildi', h.prepare("SELECT count(*) c FROM sync_log WHERE detail LIKE 'KIMLIK_GERI_DONDU:%'").get().c === 1);
  // Yuvada BASKA aktif trakt:episode varsa ETKINLESMEZ (iki aktif = birlesme olurdu).
  const ikiAktif = kimlik.findByExternal('trakt:episode', '600002');
  h.prepare("UPDATE external_ids SET retired_at = ? WHERE source = 'trakt:episode' AND source_id = '600002'").run(Date.now() - 1000);
  h.prepare("INSERT INTO external_ids (source, source_id, kaymak_id, first_seen_at, last_seen_at) VALUES ('trakt:episode', '600999', ?, ?, ?)").run(ikiAktif, Date.now(), Date.now());
  await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'show_seasons', path: '/shows/134526/seasons', query: SEZON_SORGU, data: sezon(5001, 600000) });
  T.ok('Yuvada baska aktif kimlik varken emekli kimlik etkinlesmez', aktifTrakt(ikiAktif).join() === '600999');

  // ======================================================================
  T.H('R5 · K-1 — kanonik olmayan varyant arsiv yuvasini EZMEZ');
  // ======================================================================
  const TAM = [{ number: 1, ids: { trakt: 8101 }, episodes: [{ season: 1, number: 1, title: 'P', ids: { trakt: 8102, tvdb: 8103 }, runtime: 47 }] }];
  await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'show_seasons', path: '/shows/8100/seasons', query: SEZON_SORGU, data: TAM });
  const varyant = await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'show_seasons', path: '/shows/8100/seasons', query: {}, data: [{ number: 1, ids: { trakt: 8101 } }] });
  T.ok('Varyant reddedildi (kanonik_degil)', varyant.ok === false && varyant.reason === 'kanonik_degil', varyant.reason);
  const kid8100 = kimlik.findByExternal('trakt:show', '8100');
  const yuk = ac(h.prepare("SELECT body FROM payloads WHERE kaymak_id=? AND endpoint='show_seasons'").get(kid8100).body);
  T.ok('🔴 Arsivdeki yuk BOLUMLERIYLE duruyor', Array.isArray(yuk[0].episodes) && yuk[0].episodes[0].runtime === 47);
  T.ok('TMDB dilsiz istek de reddedilir', (await yazici.archiveCatalogResponse({ provider: 'tmdb', family: 'tv_detail', path: '/tv/1', query: {}, data: { id: 1 } })).reason === 'kanonik_degil');

  T.H('kanonikMi — ureticilerin bicimi (liste uretici kodundan cikarildi)');
  T.ok('sezon: extended=full,episodes', kanonikMi('trakt', 'show_seasons', { extended: 'full,episodes' }));
  T.ok('sezon + translations REDDEDILIR (istemci gondermiyor)', !kanonikMi('trakt', 'show_seasons', { extended: 'full,episodes', translations: 'tr' }));
  T.ok('detay: extended=full + translations tr/en', kanonikMi('trakt', 'show_detail', { extended: 'full', translations: 'tr' }) && kanonikMi('trakt', 'movie_detail', { extended: 'full', translations: 'en' }));
  T.ok('detay eksik / fazla parametre REDDEDILIR', !kanonikMi('trakt', 'show_detail', { translations: 'tr' }) && !kanonikMi('trakt', 'show_detail', { extended: 'full', translations: 'tr', foo: '1' }));
  T.ok('dizi deger (ayni parametre iki kez) REDDEDILIR', !kanonikMi('trakt', 'show_detail', { extended: ['full', 'full'], translations: 'tr' }));
  T.ok('TMDB: language tr-TR / en-US', kanonikMi('tmdb', 'tv_detail', { language: 'tr-TR' }) && !kanonikMi('tmdb', 'tv_detail', { language: 'trk' }));
  T.ok('Tanimsiz aile false', !kanonikMi('trakt', 'show_related', { extended: 'full' }));

  T.H('M551 · kapi sayaci — ret sessiz kalmaz, sorgu YANSITILMAZ (herkese acik /api/health)');
  T.ok('Bos sorgu -> (bos)', sorguBicimi({}) === '(bos)' && sorguBicimi(null) === '(bos)');
  T.ok('Izinli deger gorunur', sorguBicimi({ translations: 'tr', extended: 'full' }) === 'extended=full · translations=tr');
  const kotu = sorguBicimi({ extended: '<script>x</script>', '<img onerror=1>': 'a', api_key: 'GIZLI123' });
  T.ok('🔴 Bilinmeyen deger ? , bilinmeyen anahtar yalniz SAYI', kotu === 'extended=? · +2 bilinmeyen', kotu);
  T.ok('Dizi deger yalniz uzunluk', sorguBicimi({ extended: ['full', 'full'] }) === 'extended=[2]');
  kapiSayaciniSifirla();
  const uyari = console.warn; const satirlar = []; console.warn = (m) => satirlar.push(String(m));
  try {
    kapiKaydet('trakt', 'show_seasons', { extended: 'full,episodes' }, true);
    kapiKaydet('trakt', 'show_seasons', {}, false);
    kapiKaydet('trakt', 'show_seasons', {}, false);
    kapiKaydet('trakt', 'show_related', {}, false); // kapsam disi aile — ret SAYILMAZ
    for (let i = 0; i < 80; i++) kapiKaydet('trakt', 'show_detail', { extended: `x${i}` }, false);
  } finally { console.warn = uyari; }
  const kd = kapiDurumu();
  T.ok('Gecen 1 / reddedilen 82 (kapsam disi sayilmadi)', kd.gecen === 1 && kd.reddedilen === 82 && !kd.aileler['trakt/show_related'], JSON.stringify({ g: kd.gecen, r: kd.reddedilen }));
  T.ok('Aile kirilimi + son ret bicimi', kd.aileler['trakt/show_seasons'].reddedilen === 2 && kd.aileler['trakt/show_seasons'].sonRet.bicim === '(bos)');
  T.ok('Ayni bicim gunluge BIR kez yazildi', satirlar.filter((s) => s.includes('trakt/show_seasons (bos)')).length === 1);
  T.ok('🔴 Degisken degerle gunluk sisirilemez (bilinmeyen deger hep ?)', satirlar.length === 2, String(satirlar.length));
  kd.aileler['trakt/show_seasons'].gecen = 999;
  T.ok('kapiDurumu kopya doner (cagiran sayaci bozamaz)', kapiDurumu().aileler['trakt/show_seasons'].gecen === 1);
  kapiSayaciniSifirla();

  // ======================================================================
  T.H('R6 · O-8 — daha eski veri daha yeniyi EZMEZ');
  // ======================================================================
  const yeni = await depo.upsertPayload({ kaymakId: kid8100, provider: 'trakt', endpoint: 'show_detail', lang: 'tr', data: { v: 'yeni' }, fetchedAt: 2_000 });
  const eski = await depo.upsertPayload({ kaymakId: kid8100, provider: 'trakt', endpoint: 'show_detail', lang: 'tr', data: { v: 'eski' }, fetchedAt: 1_000 });
  const govde = () => ac(h.prepare("SELECT body FROM payloads WHERE kaymak_id=? AND endpoint='show_detail' AND lang='tr'").get(kid8100).body);
  T.ok('Yeni yazildi, eski ATLANDI (daha_yeni_var)', yeni.ok && !yeni.atlandi && eski.ok && eski.atlandi === 'daha_yeni_var');
  T.ok('🔴 Govde yeni kaldi', govde().v === 'yeni');
  await depo.upsertPayload({ kaymakId: kid8100, provider: 'trakt', endpoint: 'show_detail', lang: 'tr', data: { v: 'esit' }, fetchedAt: 2_000 });
  T.ok('Esit damga yazar (ayni yanitin tekrari zararsiz)', govde().v === 'esit');

  // ======================================================================
  T.H('O-7 — slug ile gelen istek arsivde KOK ACMAZ');
  // ======================================================================
  const varlik0 = h.prepare('SELECT count(*) c FROM entities').get().c;
  const slugsuz = await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'show_seasons', path: '/shows/twin-peaks/seasons', query: SEZON_SORGU, data: TAM });
  T.ok('🔴 Bilinmeyen slug: yazilmaz, kayit ACILMAZ (canlida 3 basliksiz kok boyle dogdu)',
    slugsuz.reason === 'slug_kok_bilinmiyor' && h.prepare('SELECT count(*) c FROM entities').get().c === varlik0, slugsuz.reason);
  const sluglu = await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'show_seasons', path: '/shows/the-haunting-of-bly-manor/seasons', query: SEZON_SORGU, data: sezon(5002, 700000) });
  T.ok('Bilinen slug: o dizinin kaydina yazilir', sluglu.ok === true && sluglu.showKaymakId === bly, sluglu.reason);

  // ======================================================================
  T.H('O-5 / tur kapisi — tipli kimlik BASKA turde bir yapima bagliysa (Madde 288 mirasi)');
  // ======================================================================
  const bolumKaydi = kimlik.findByExternal('trakt:episode', '212650');
  h.prepare("INSERT INTO external_ids (source, source_id, kaymak_id, first_seen_at, last_seen_at) VALUES ('trakt:movie', '258811', ?, ?, ?)").run(bolumKaydi, Date.now(), Date.now());
  const baslikOnce = baslik(bolumKaydi);
  const film = await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'movie_detail', path: '/movies/258811', query: DETAY_SORGU, data: { title: 'SAO Film', year: 2017, ids: { trakt: 258811 } } });
  T.ok('🔴 Film yuku BOLUM kaydina YAZILMADI', h.prepare("SELECT count(*) c FROM payloads WHERE kaymak_id=? AND endpoint='movie_detail'").get(bolumKaydi).c === 0, film.reason);
  T.ok('Bolumun basligi film adiyla EZILMEDI', baslik(bolumKaydi) === baslikOnce);
  T.ok('TUR_UYUSMAZ alarm olarak kaydedildi', h.prepare("SELECT count(*) c FROM sync_log WHERE detail LIKE 'TUR_UYUSMAZ:%'").get().c >= 1);

  // ======================================================================
  T.H('Null korumalari — cozum null dondugunde yazici TypeError FIRLATMAZ');
  // ======================================================================
  // episode_detail: dizi bilinen, sezon bilinen; bolumun TUM kimlikleri baska turde bir yapima bagli.
  h.prepare("INSERT INTO external_ids (source, source_id, kaymak_id, first_seen_at, last_seen_at) VALUES ('trakt:episode', '777001', ?, ?, ?)").run(hill, Date.now(), Date.now());
  let firlatti = false;
  let ep;
  try {
    ep = await yazici.archiveCatalogResponse({ provider: 'trakt', family: 'episode_detail', path: '/shows/134526/seasons/1/episodes/9', query: DETAY_SORGU, data: { title: 'X', season: 1, number: 9, ids: { trakt: 777001 } } });
  } catch (e) { firlatti = true; }
  T.ok('🔴 Firlatmadi, temiz sonuc dondu (kimlik_cakismasi)', !firlatti && ep && ep.ok === false && ep.reason === 'kimlik_cakismasi', ep && ep.reason);
  T.ok('Kimliksiz kayit ACILMADI', h.prepare("SELECT count(*) c FROM sync_log WHERE detail LIKE 'KIMLIKSIZ_KAYIT_ENGELLENDI:%'").get().c >= 1);

  T.bitir();
})().catch((e) => { console.error(e); process.exit(1); });
