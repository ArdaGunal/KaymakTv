// ==========================================================================
// M552 — A3 kimlik onarım aracı: her grup + VERİ KAYBI YOK + tekrar koşuda iş yok + hata → ROLLBACK
// ==========================================================================
// Sentetik eski durum SQL ile kurulur (A1 artık birleşme ÜRETMEDİĞİ için yazıcıyla kurulamaz).
// Ağ yok: Trakt yanıtları sözlükle verilir (`/shows/eski-slug` 404 → sezon kimliğiyle yedek yol).

const path = require('path');
const zlib = require('zlib');
const { baslat, AR } = require('../yardimci');

const T = baslat('A3 KIMLIK ONARIMI (M552)', { kokOneki: 'arsiv-onarim-' });
const db = require(path.join(AR, 'db'));
const { planla } = require(path.join(__dirname, '..', '..', 'scripts', 'kimlik-onarim'));
const { uygula, sayim } = require(path.join(__dirname, '..', '..', 'scripts', 'kimlik-onarim', 'uygula'));

const gz = (o) => zlib.gzipSync(Buffer.from(JSON.stringify(o)));
const ep = (season, number, trakt, tmdb, tvdb, title) => ({ season, number, title, ids: { trakt, tmdb, tvdb } });

(async () => {
  db.initArchive();
  const h = db.getDb();
  const t = 1_000;
  const varlik = h.prepare('INSERT INTO entities (kaymak_id, type, parent_id, season_number, episode_number, title, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)');
  const kimlik = h.prepare('INSERT INTO external_ids (source, source_id, kaymak_id, first_seen_at, last_seen_at, retired_at) VALUES (?,?,?,?,?,?)');
  const yuk = h.prepare('INSERT INTO payloads (kaymak_id, provider, endpoint, lang, body, bytes_raw, bytes_gz, fetched_at, updated_at) VALUES (?,?,?,?,?,1,1,?,?)');
  const V = (id, tip, p, s, e, ad) => varlik.run(id, tip, p, s, e, ad, t, t);
  const K = (kd, id, ret = null) => { const [s, v] = kd.split('='); kimlik.run(s, v, id, t, t, ret); };

  // G1 + G1s: dizi 100 · arşivde S1 kaydı iki Trakt sezonunu taşıyor; S1E1 iki Trakt bölümünü; S2E1 S1 altında
  V('show_a', 'show', null, null, null, 'Dizi A'); K('trakt:show=100', 'show_a');
  V('season_a1', 'season', 'show_a', 1, null, 'Season 2 (ezilmiş)'); K('trakt:season=1001', 'season_a1'); K('trakt:season=1002', 'season_a1');
  V('episode_a11', 'episode', 'season_a1', 1, 1, 'İkinci (ezilmiş)');
  for (const kd of ['trakt:episode=5001', 'trakt:episode=5002', 'tmdb:episode=6001', 'tmdb:episode=6002', 'tvdb:episode=7001']) K(kd, 'episode_a11');
  V('episode_a21', 'episode', 'season_a1', 2, 1, 'S2 bölümü'); K('trakt:episode=5003', 'episode_a21');
  yuk.run('show_a', 'trakt', 'show_seasons', '-', gz([
    { number: 1, title: 'Season 1', ids: { trakt: 1001 }, episodes: [ep(1, 1, 5001, 6001, 7001, 'Birinci'), ep(1, 2, 5002, 6002, 7001, 'İkinci')] },
    { number: 2, title: 'Season 2', ids: { trakt: 1002 }, episodes: [ep(2, 1, 5003, 6003, 7003, 'S2 bölümü')] },
  ]), t, t);
  // G2: tek dizi kaydında iki dizi (300 ilk sahip, 301 ayrılır); kayıttaki detay yükü 301'in
  V('show_h', 'show', null, null, null, 'Bly'); K('trakt:show=300', 'show_h'); K('trakt:show=301', 'show_h'); K('tvdb:show=999', 'show_h');
  yuk.run('show_h', 'trakt', 'show_detail', 'tr', gz({ title: 'Bly', ids: { trakt: 301, tvdb: 999 } }), t, t);
  // G3: slug kökü (Trakt 404) — sezonunun kimliği sayısal dizi 200'ün yükünde
  V('show_n', 'show', null, null, null, 'Sayısal'); K('trakt:show=200', 'show_n');
  yuk.run('show_n', 'trakt', 'show_seasons', '-', gz([{ number: 1, ids: { trakt: 1003 }, episodes: [] }]), t, t);
  V('show_k', 'show', null, null, null, null); K('trakt:slug=eski-slug', 'show_k');
  V('season_k1', 'season', 'show_k', 1, null, 'Season 1'); K('trakt:season=1003', 'season_k1');
  // G5: bölüm kaydında film kimliği + film yükü
  V('episode_f', 'episode', 'season_a1', 1, 9, 'Film özel'); K('trakt:episode=5009', 'episode_f'); K('trakt:movie=900', 'episode_f');
  yuk.run('episode_f', 'trakt', 'movie_detail', 'tr', gz({ title: 'Film', year: 2017, ids: { trakt: 900 } }), t, t);

  const yanitlar = {
    '/shows/300?extended=full&translations=tr': { govde: { title: 'Hill', year: 2018, ids: { trakt: 300, tvdb: 999 } }, fetched_at: 2_000 },
    '/shows/300/seasons?extended=full,episodes': { govde: [], fetched_at: 2_000 },
    '/shows/301?extended=full&translations=tr': { govde: { title: 'Bly', year: 2020, ids: { trakt: 301, tvdb: 999 } }, fetched_at: 2_000 },
    '/shows/301/seasons?extended=full,episodes': { govde: [], fetched_at: 2_000 },
    '/shows/eski-slug?extended=full&translations=tr': { govde: null, durum: 404, fetched_at: 2_000 },
  };
  const tumKimlik = () => new Set(h.prepare('SELECT source, source_id FROM external_ids').all().map((r) => `${r.source}=${r.source_id}`));
  const kimde = (kd) => { const [s, v] = kd.split('='); const r = h.prepare('SELECT kaymak_id, retired_at FROM external_ids WHERE source=? AND source_id=?').get(s, v); return r && r.retired_at == null ? r.kaymak_id : null; };

  T.H('Plan (salt okur)');
  const once = sayim(h);
  const kimlikOnce = tumKimlik();
  const { plan, gerekli } = planla(h, 'test', yanitlar);
  T.ok('Eksik Trakt yanıtı yok, uyarı yok', gerekli.length === 0 && plan.uyarilar.length === 0, JSON.stringify(plan.uyarilar));
  T.ok('Plan VERİTABANINA YAZMADI', JSON.stringify(sayim(h)) === JSON.stringify(once));
  T.ok('Beklenen sonra: çoklu-aktif 0/0/0', plan.beklenen.cokluTraktBolum === 0 && plan.beklenen.cokluTraktSezon === 0 && plan.beklenen.cokluTraktDizi === 0, JSON.stringify(plan.beklenen));
  T.ok('Silme eylemi YOK', plan.eylemler.every((e) => !/sil|delete/i.test(e.tur)));

  T.H('Uygula + sonuçlar');
  const { sonra } = uygula(h, plan);
  T.ok('G1: 5002 kendi yuvasında yeni kayda, sahibe özgü olmayan tmdb ile', kimde('trakt:episode=5002') !== 'episode_a11' && kimde('tmdb:episode=6002') === kimde('trakt:episode=5002'));
  T.ok('G1: ortak tvdb sahipte kaldı, başlık sahibe döndü', kimde('tvdb:episode=7001') === 'episode_a11' && h.prepare('SELECT title FROM entities WHERE kaymak_id=?').get('episode_a11').title === 'Birinci');
  const s2 = kimde('trakt:season=1002');
  T.ok('G1s: 1002 yeni S2 sezonunda, yanlış sezondaki bölüm oraya taşındı', s2 && s2 !== 'season_a1' && h.prepare('SELECT parent_id FROM entities WHERE kaymak_id=?').get('episode_a21').parent_id === s2);
  T.ok('G2: 301 yeni dizide, ortak tvdb ilk sahipte, eski yük ayrılana taşındı', kimde('trakt:show=301') !== 'show_h' && kimde('tvdb:show=999') === 'show_h'
    && !!h.prepare("SELECT 1 FROM payloads WHERE kaymak_id=? AND endpoint='show_detail'").get(kimde('trakt:show=301')));
  T.ok('G2: ilk sahibe kendi Trakt detayı yazıldı', JSON.parse(zlib.gunzipSync(h.prepare("SELECT body FROM payloads WHERE kaymak_id='show_h' AND endpoint='show_detail'").get().body)).title === 'Hill');
  T.ok('G3 (404): sezon kimliğiyle bulunan sayısal kayda birleşti', h.prepare('SELECT parent_id FROM entities WHERE kaymak_id=?').get('season_k1').parent_id === 'show_n' && kimde('trakt:slug=eski-slug') === 'show_n');
  T.ok('G5: film kimliği + yükü yeni film kaydında', h.prepare('SELECT type FROM entities WHERE kaymak_id=?').get(kimde('trakt:movie=900')).type === 'movie'
    && !!h.prepare("SELECT 1 FROM payloads WHERE kaymak_id=? AND endpoint='movie_detail'").get(kimde('trakt:movie=900')));

  T.H('🔴 VERİ KAYBI YOK');
  const kimlikSonra = tumKimlik();
  T.ok('Her eski dış kimlik hâlâ var', [...kimlikOnce].every((k) => kimlikSonra.has(k)));
  T.ok('Hiçbir varlık/yük eksilmedi', sonra.varlik >= once.varlik && sonra.yuk >= once.yuk && sonra.kimlik >= once.kimlik, JSON.stringify({ once, sonra }));
  T.ok('foreign_key_check temiz', h.prepare('PRAGMA foreign_key_check').all().length === 0);
  T.ok('Tekrar planda iş kalmadı', planla(h, 'test', yanitlar).plan.eylemler.length === 0);

  T.H('🔴 Hata → ROLLBACK (yarım yazım kalmaz)');
  const sayimOnce = sayim(h);
  const bozuk = { eylemler: [
    { tur: 'varlikEkle', kaymak_id: 'show_rollback', type: 'show', parent_id: null, season_number: null, episode_number: null, title: 'x', year: null, status: null },
    { tur: 'kimlikTasi', source: 'trakt:show', source_id: '424242', kaymak_id: 'show_yok', hedef: 'show_rollback' },
  ], beklenen: { cokluTraktBolum: 0, cokluTraktDizi: 0, cokluTraktSezon: 0 }, parmakIzi: 'test' };
  let firladi = false;
  try { uygula(h, bozuk); } catch (_) { firladi = true; }
  T.ok('Plana uymayan eylem fırlattı', firladi);
  T.ok('İlk eylem de geri alındı (varlık eklenmedi)', !h.prepare("SELECT 1 FROM entities WHERE kaymak_id='show_rollback'").get() && JSON.stringify(sayim(h)) === JSON.stringify(sayimOnce));

  db.closeArchive();
  T.bitir();
})();
