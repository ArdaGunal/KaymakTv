// ==========================================================================
// KATALOG ARŞİVİ — A1 ŞEMA VE KİMLİK TESTLERİ
// ==========================================================================
// 🔴 BU TAKIMIN EN ÖNEMLİ İDDİASI KİMLİK ÇÖZÜMLEMESİDİR. Şema doğru ama
// kimlik yanlışsa arşiv SESSİZCE çift kayıt biriktirir: aynı dizi iki
// farklı `kaymak_id` altında, ikisi de yarım. A4'te "kapsamımız %80"
// derken aslında %40 oluruz ve bunu fark etmeyiz.
//
// 🔴 GERÇEK SQLITE ÜZERİNDE ÇALIŞIR — sahte (mock) yok. Şemadaki CHECK,
// FOREIGN KEY ve UNIQUE kısıtlarının GERÇEKTEN reddettiği doğrulanıyor.
// İlk taslakta bu takım gerçek bir hata yakaladı: sezon tekillik indeksi
// çıplak `episode_number` kullanıyordu ve SQLite'ta UNIQUE indeks içindeki
// NULL'lar eşit sayılmadığı için AYNI SEZON SONSUZ KEZ eklenebiliyordu.

const fs = require('fs');
const path = require('path');
const { baslat, AR } = require('../yardimci');

const T = baslat('ARSIV SEMASI (A1)', { kokOneki: 'ar-sema-' });

const db = require(path.join(AR, 'db'));
const kimlik = require(path.join(AR, 'identity'));
const depo = require(path.join(AR, 'store'));

(async () => {
  // ======================================================================
  T.H('Acilis ve sema');
  // ======================================================================
  const durum = db.initArchive();
  T.ok('Arsiv acildi', durum.enabled === true, durum.reason || durum.dbPath);
  if (!durum.enabled) {
    // node:sqlite yoksa devam etmenin anlami yok — ama bu bir COKME degil,
    // tasarlanmis bir devre disi kalma (db.js basligi).
    T.ok('node:sqlite bu ortamda yok - kalan iddialar atlaniyor', false, durum.reason);
    T.bitir();
    return;
  }

  T.ok('Varsayilan konum ${LAZYFETCH_ROOT}/archive', durum.root === path.join(T.kok, 'archive'), durum.root);

  const h = db.getDb();
  T.ok('WAL etkin (okuyucu/yazici birbirini bloklamiyor)', h.prepare('PRAGMA journal_mode').get().journal_mode === 'wal');
  T.ok('foreign_keys ACIK (baglanti basina ayar!)', h.prepare('PRAGMA foreign_keys').get().foreign_keys === 1);
  T.ok('synchronous = NORMAL', h.prepare('PRAGMA synchronous').get().synchronous === 1);

  const tablolar = h.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);
  T.ok('Tablolar olustu', JSON.stringify(tablolar) === JSON.stringify(['entities', 'external_ids', 'meta', 'payloads', 'sync_log']), tablolar.join(', '));
  T.ok('v_kapsam gorunumu olustu', h.prepare("SELECT count(*) c FROM sqlite_master WHERE type='view'").get().c === 1);
  T.ok('schema_version = ' + db.HEDEF_SEMA_SURUMU, h.prepare("SELECT value v FROM meta WHERE key='schema_version'").get().v === String(db.HEDEF_SEMA_SURUMU));

  // ======================================================================
  T.H('Kimlik cozumleme - Trakt ids blogu bedava caprazliyor');
  // ======================================================================
  const traktYanit = {
    title: 'Breaking Bad', year: 2008, status: 'ended',
    ids: { trakt: 1388, slug: 'breaking-bad', tvdb: 81189, imdb: 'tt0903747', tmdb: 1396 },
  };
  const disKimlikler = kimlik.traktIdsToExternal('show', traktYanit.ids);
  T.ok('Trakt ids blogu 5 dis kimlige cevrildi', disKimlikler.length === 5, disKimlikler.map((d) => d.source).join(','));
  T.ok('Kaynak adi TIP iceriyor (tmdb:show)', disKimlikler.some((d) => d.source === 'tmdb:show' && d.source_id === '1396'));

  const ilk = kimlik.resolveOrCreate({
    type: 'show', externalIds: disKimlikler,
    derived: { title: traktYanit.title, year: traktYanit.year, status: traktYanit.status },
  });
  T.ok('Ilk gorusme entity YARATTI', ilk.created === true && ilk.kaymak_id.startsWith('show_'), ilk.kaymak_id);

  const ikinci = kimlik.resolveOrCreate({ type: 'show', externalIds: disKimlikler, derived: {} });
  T.ok('🔴 AYNI dizi ikinci kez CIFT KAYIT URETMIYOR', ikinci.created === false && ikinci.kaymak_id === ilk.kaymak_id);

  // Yalnizca TEK bir kimlikle gelen istek de ayni yapimi bulmali
  const tekKimlikle = kimlik.resolveOrCreate({ type: 'show', externalIds: [{ source: 'imdb', source_id: 'tt0903747' }] });
  T.ok('Tek bir dis kimlik bile ayni yapima cozuluyor', tekKimlikle.kaymak_id === ilk.kaymak_id);

  // Arsiv ZAMANLA ZENGINLESIR: ilk gorusmede olmayan bir kimlik sonra baglanir
  const zenginlesme = kimlik.resolveOrCreate({
    type: 'show',
    externalIds: [{ source: 'trakt:show', source_id: '1388' }, { source: 'letterboxd', source_id: 'bb' }],
  });
  T.ok('Yeni bir dis kimlik var olan yapima EKLENIYOR', zenginlesme.kaymak_id === ilk.kaymak_id);
  T.ok('Dis kimlik sayisi 5 -> 6', kimlik.listExternalIds(ilk.kaymak_id).length === 6);

  T.ok('Ileri cozumleme (findByExternal)', kimlik.findByExternal('tmdb:show', 1396) === ilk.kaymak_id);
  T.ok('Bilinmeyen kimlik null donuyor', kimlik.findByExternal('tmdb:show', 999999) === null);

  // ======================================================================
  T.H('Kimlik tuzaklari');
  // ======================================================================
  // TMDB'de dizi 1396 ile film 1396 FARKLI yapimlardir.
  const film = kimlik.resolveOrCreate({
    type: 'movie',
    externalIds: kimlik.traktIdsToExternal('movie', { trakt: 481, slug: 'the-matrix-1999', imdb: 'tt0133093', tmdb: 1396 }),
    derived: { title: 'The Matrix', year: 1999 },
  });
  T.ok('🔴 tmdb:show/1396 ile tmdb:movie/1396 FARKLI yapimlar', film.kaymak_id !== ilk.kaymak_id);
  T.ok('Film icin tvdb kimligi URETILMIYOR', !kimlik.listExternalIds(film.kaymak_id).some((d) => d.source.startsWith('tvdb')));

  // Trakt eksik kimlikleri bazen 0 / null olarak donduruyor
  const bosluklu = kimlik.traktIdsToExternal('show', { trakt: 55, slug: '', tvdb: 0, imdb: null, tmdb: undefined });
  T.ok('🔴 0 / null / bos string KIMLIK SAYILMIYOR', bosluklu.length === 1 && bosluklu[0].source === 'trakt:show', JSON.stringify(bosluklu));

  // ----------------------------------------------------------------------
  // 📏 GERCEK TRAKT YANIT SEKLI (olculdu 2026-08-29,
  // /shows/1388/seasons?extended=full,episodes). Uydurulmus sekil DEGIL.
  // ----------------------------------------------------------------------
  const gercekSezonIds = { plex: { guid: '602e61de66dfdb002c096b16' }, tmdb: 3572, tvdb: 30272, trakt: 3950 };
  const gercekBolumIds = { imdb: 'tt0959621', plex: { guid: '5d9c0fc37b5c2e001e6a7045' }, tmdb: 62085, tvdb: 349232, trakt: 73482 };

  const sezonKimlikleri = kimlik.traktIdsToExternal('season', gercekSezonIds);
  const bolumKimlikleri = kimlik.traktIdsToExternal('episode', gercekBolumIds);

  T.ok('⛔ plex (ic ice NESNE) kimlik olarak ALINMIYOR',
    ![...sezonKimlikleri, ...bolumKimlikleri].some((d) => d.source.includes('plex') || d.source_id.includes('object')),
    JSON.stringify([...sezonKimlikleri, ...bolumKimlikleri].map((d) => d.source)));

  // 🔴 ILK TASLAKTAKI GERCEK HATA: bolumun tmdb/tvdb kimlikleri
  // `tmdb:show`/`tvdb:show` diye etiketleniyordu. tmdb dizi kimligi 62085
  // olan GERCEK bir dizi geldiginde ayni satira cakisir ve arsiv iki farkli
  // yapimi sessizce karistirirdi.
  T.ok('🔴 BOLUM kimligi tmdb:episode olarak etiketleniyor (tmdb:show DEGIL)',
    bolumKimlikleri.some((d) => d.source === 'tmdb:episode' && d.source_id === '62085') &&
    !bolumKimlikleri.some((d) => d.source === 'tmdb:show'));
  T.ok('🔴 BOLUM kimligi tvdb:episode olarak etiketleniyor',
    bolumKimlikleri.some((d) => d.source === 'tvdb:episode' && d.source_id === '349232') &&
    !bolumKimlikleri.some((d) => d.source === 'tvdb:show'));
  T.ok('SEZON kimligi tmdb:season / tvdb:season olarak etiketleniyor',
    sezonKimlikleri.some((d) => d.source === 'tmdb:season' && d.source_id === '3572') &&
    sezonKimlikleri.some((d) => d.source === 'tvdb:season' && d.source_id === '30272'));
  T.ok('Bolumun imdb kimligi tipsiz (globalde benzersiz)',
    bolumKimlikleri.some((d) => d.source === 'imdb' && d.source_id === 'tt0959621'));
  T.ok('Sezon/bolumde slug YOK, uretilmiyor',
    ![...sezonKimlikleri, ...bolumKimlikleri].some((d) => d.source === 'trakt:slug'));

  // 🔴 ASIL SENARYO: tmdb DIZI kimligi 62085 olan gercek bir yapim ile,
  // tmdb BOLUM kimligi 62085 olan bolum ayni satira DUSMEMELI. Ilk
  // taslaktaki `tmdb:show` etiketi tam olarak bunu kirardi.
  const cakisanDizi = kimlik.resolveOrCreate({
    type: 'show', externalIds: kimlik.traktIdsToExternal('show', { trakt: 62085001, tmdb: 62085 }),
  });
  // 🔴 Sema, bolum entity'si icin parentId + sezon/bolum numarasini ZORUNLU
  // tutuyor — A2 yazicisinin uymasi gereken kural. (Ilk taslakta bu test
  // numarasiz bolum yaratmaya calisti ve sema hakli olarak REDDETTI.)
  const bolumunSezonu = kimlik.resolveOrCreate({
    type: 'season', externalIds: kimlik.traktIdsToExternal('season', gercekSezonIds),
    parentId: ilk.kaymak_id, seasonNumber: 1,
  });
  const cakisanBolum = kimlik.resolveOrCreate({
    type: 'episode', externalIds: bolumKimlikleri,
    parentId: bolumunSezonu.kaymak_id, seasonNumber: 1, episodeNumber: 1,
  });
  T.ok('🔴 tmdb:show/62085 ile tmdb:episode/62085 AYRI yapimlar (tip etiketi sayesinde)',
    cakisanDizi.kaymak_id !== cakisanBolum.kaymak_id && cakisanBolum.conflict === false);
  T.ok('Bolum entity si dogru sezona bagli',
    h.prepare('SELECT parent_id p FROM entities WHERE kaymak_id=?').get(cakisanBolum.kaymak_id).p === bolumunSezonu.kaymak_id);
  T.ok('Ayni sezon ikinci kez cozulurken CIFT KAYIT uretmiyor',
    kimlik.resolveOrCreate({
      type: 'season', externalIds: kimlik.traktIdsToExternal('season', gercekSezonIds),
      parentId: ilk.kaymak_id, seasonNumber: 1,
    }).created === false);

  let kimliksizReddedildi = false;
  try { kimlik.resolveOrCreate({ type: 'show', externalIds: [] }); } catch (e) { kimliksizReddedildi = true; }
  T.ok('Dis kimliksiz entity YARATILAMIYOR (bulunamaz oksuz kayit olurdu)', kimliksizReddedildi);

  let kotuTip = false;
  try { kimlik.resolveOrCreate({ type: 'dizi', externalIds: [{ source: 'x', source_id: '1' }] }); } catch (e) { kotuTip = true; }
  T.ok('Bilinmeyen entity tipi reddediliyor', kotuTip);

  // CAKISMA: iki farkli yapima bagli kimlikler tek istekte gelirse
  const cakisma = kimlik.resolveOrCreate({
    type: 'show',
    externalIds: [{ source: 'trakt:show', source_id: '1388' }, { source: 'trakt:movie', source_id: '481' }],
  });
  T.ok('🔴 Cakisma SESSIZCE birlestirilmiyor, isaretleniyor', cakisma.conflict === true);
  T.ok('Cakisma sync_log a yazildi', h.prepare("SELECT count(*) c FROM sync_log WHERE event='conflict'").get().c >= 1);
  T.ok('Var olan bag BASKA yapima cevrilmedi', kimlik.findByExternal('trakt:movie', '481') === film.kaymak_id);

  // ======================================================================
  T.H('Hiyerarsi ve sema kisitlari');
  // ======================================================================
  // Sezon 1 yukaridaki gercek-sekil blogunda zaten yaratildi (trakt:season/3950)
  // — burada 2. sezonu aciyoruz ki "yeni yaratildi" iddiasi anlamli olsun.
  const sezon = kimlik.resolveOrCreate({
    type: 'season', externalIds: [{ source: 'trakt:season', source_id: '3951' }],
    parentId: ilk.kaymak_id, seasonNumber: 2,
  });
  T.ok('Sezon, diziye bagli olarak yaratildi', sezon.created === true);

  let ayniSezon = false;
  try {
    h.prepare('INSERT INTO entities (kaymak_id,type,parent_id,season_number,created_at,updated_at) VALUES (?,?,?,?,?,?)')
      .run('season_sahte', 'season', ilk.kaymak_id, 1, Date.now(), Date.now());
  } catch (e) { ayniSezon = /UNIQUE/i.test(e.message); }
  T.ok('🔴 Ayni dizinin ayni sezonu IKI KEZ olusamiyor (NULL tuzagi kapali)', ayniSezon);

  let numarasiz = false;
  try {
    h.prepare('INSERT INTO entities (kaymak_id,type,parent_id,created_at,updated_at) VALUES (?,?,?,?,?)')
      .run('season_numarasiz', 'season', ilk.kaymak_id, Date.now(), Date.now());
  } catch (e) { numarasiz = /CHECK/i.test(e.message); }
  T.ok('Numarasiz sezon reddediliyor', numarasiz);

  let sahteEbeveyn = false;
  try {
    h.prepare('INSERT INTO entities (kaymak_id,type,parent_id,season_number,created_at,updated_at) VALUES (?,?,?,?,?,?)')
      .run('season_oksuz', 'season', 'YOK_BOYLE_BIR_ID', 9, Date.now(), Date.now());
  } catch (e) { sahteEbeveyn = /FOREIGN KEY/i.test(e.message); }
  T.ok('Var olmayan ebeveyn reddediliyor (FK gercekten acik)', sahteEbeveyn);

  // ======================================================================
  T.H('Payload - gercegin kaynagi');
  // ======================================================================
  const yaz = await depo.upsertPayload({
    kaymakId: ilk.kaymak_id, provider: 'trakt', endpoint: 'show_detail', lang: 'tr', data: traktYanit,
  });
  T.ok('Payload yazildi (gzip)', yaz.ok === true, yaz.bytesRaw + ' -> ' + yaz.bytesGz + ' bayt');

  const oku = await depo.readPayload({ kaymakId: ilk.kaymak_id, provider: 'trakt', endpoint: 'show_detail', lang: 'tr' });
  T.ok('🔴 Payload BIREBIR geri okundu (hicbir alan kaybolmadi)',
    oku.ok && oku.data.ids.tvdb === 81189 && oku.data.status === 'ended' && oku.data.title === 'Breaking Bad');

  await depo.upsertPayload({ kaymakId: ilk.kaymak_id, provider: 'trakt', endpoint: 'show_detail', lang: 'tr', data: { ...traktYanit, status: 'returning' } });
  T.ok('Upsert: latest-wins, yeni satir ACMIYOR',
    h.prepare("SELECT count(*) c FROM payloads WHERE kaymak_id=? AND endpoint='show_detail'").get(ilk.kaymak_id).c === 1);
  T.ok('Upsert guncel veriyi donduruyor',
    (await depo.readPayload({ kaymakId: ilk.kaymak_id, provider: 'trakt', endpoint: 'show_detail', lang: 'tr' })).data.status === 'returning');

  await depo.upsertPayload({ kaymakId: ilk.kaymak_id, provider: 'trakt', endpoint: 'show_detail', lang: 'en', data: traktYanit });
  T.ok('🔴 DIL ayri satir - tr ve en karismiyor',
    h.prepare("SELECT count(*) c FROM payloads WHERE kaymak_id=? AND endpoint='show_detail'").get(ilk.kaymak_id).c === 2);

  await depo.upsertPayload({ kaymakId: ilk.kaymak_id, provider: 'trakt', endpoint: 'show_people', data: { cast: [] } });
  await depo.upsertPayload({ kaymakId: ilk.kaymak_id, provider: 'trakt', endpoint: 'show_people', data: { cast: [] } });
  T.ok("Dilsiz uc '-' sentineli ile TEKILLESIYOR (SQLite NULL tuzagi)",
    h.prepare("SELECT count(*) c FROM payloads WHERE endpoint='show_people'").get().c === 1);

  T.ok('Bulunmayan payload not_found donuyor',
    (await depo.readPayload({ kaymakId: ilk.kaymak_id, provider: 'tmdb', endpoint: 'tv_detail' })).reason === 'not_found');

  // Bozuk payload: SILINMEZ, karantinaya da tasinmaz - arsiv veri atmaz
  h.prepare("UPDATE payloads SET body = ? WHERE endpoint = 'show_people'").run(Buffer.from('BOZUK'));
  const bozuk = await depo.readPayload({ kaymakId: ilk.kaymak_id, provider: 'trakt', endpoint: 'show_people' });
  T.ok('Bozuk payload: cokmuyor, corrupt donuyor', bozuk.ok === false && bozuk.reason === 'corrupt');
  T.ok('🔴 Bozuk satir YERINDE BIRAKILDI (arsiv silmez)',
    h.prepare("SELECT count(*) c FROM payloads WHERE endpoint='show_people'").get().c === 1);
  T.ok('Bozukluk sync_log a yazildi', h.prepare("SELECT count(*) c FROM sync_log WHERE event='error'").get().c >= 1);

  // ======================================================================
  T.H('Silme korumasi - arsiv hicbir seyi silmez');
  // ======================================================================
  let silmeReddedildi = false;
  try { h.prepare('DELETE FROM entities WHERE kaymak_id=?').run(ilk.kaymak_id); } catch (e) { silmeReddedildi = /FOREIGN KEY/i.test(e.message); }
  T.ok('Bagli bir entity SILINEMIYOR (ON DELETE RESTRICT)', silmeReddedildi);

  // ======================================================================
  T.H('Kapsam ve ozet');
  // ======================================================================
  const kapsam = depo.coverage();
  T.ok('v_kapsam calisiyor', kapsam.length >= 3, kapsam.map((r) => `${r.type}/${r.endpoint}/${r.lang}:${r.kayit}`).join(' '));
  const ozet = depo.summary();
  T.ok('Ozet: entity/payload/kimlik sayilari', ozet.entities >= 3 && ozet.payloads >= 3 && ozet.externalIds >= 8,
    `${ozet.entities} entity · ${ozet.payloads} payload · ${ozet.externalIds} kimlik · ${ozet.conflicts} cakisma`);

  // ======================================================================
  T.H('Dayaniklilik ve yedek');
  // ======================================================================
  const yedekYolu = path.join(T.kok, 'yedek.db');
  const yedek = db.backupTo(yedekYolu);
  T.ok('🔴 VACUUM INTO ile CALISAN veritabanindan tutarli yedek', yedek.ok === true, (yedek.bytes / 1024).toFixed(1) + ' KB');
  T.ok('Yedek dosyasi diskte', fs.existsSync(yedekYolu));

  const oncekiPayload = h.prepare('SELECT count(*) c FROM payloads').get().c;
  db.closeArchive();
  db.initArchive();
  T.ok('Yeniden acilista veri duruyor',
    db.getDb().prepare('SELECT count(*) c FROM payloads').get().c === oncekiPayload, oncekiPayload + ' payload');
  T.ok('Ikinci acilis semayi BOZMUYOR (idempotent goc)',
    db.getDb().prepare("SELECT value v FROM meta WHERE key='schema_version'").get().v === String(db.HEDEF_SEMA_SURUMU));

  db.closeArchive();

  // 🔴 ARSIV KAPALIYKEN COKMEZ - sunucu arsiv olmadan da ayakta kalmali
  const altSurec = require('child_process').spawnSync(
    process.execPath,
    ['-e', `delete process.env.LAZYFETCH_ROOT; delete process.env.ARCHIVE_ROOT;
      const d = require(${JSON.stringify(path.join(AR, 'db'))});
      const s = require(${JSON.stringify(path.join(AR, 'store'))});
      const k = require(${JSON.stringify(path.join(AR, 'identity'))});
      if (d.isArchiveEnabled()) process.exit(1);
      if (s.upsertPayload({ kaymakId: 'x', provider: 'trakt', endpoint: 'y', data: {} }).ok) process.exit(1);
      if (s.readPayload({ kaymakId: 'x', provider: 'trakt', endpoint: 'y' }).ok) process.exit(1);
      if (k.resolveOrCreate({ type: 'show', externalIds: [{ source: 'a', source_id: '1' }] }) !== null) process.exit(1);
      if (s.coverage().length !== 0) process.exit(1);
      process.exit(0);`],
    { encoding: 'utf8' }
  );
  T.ok('🔴 Arsiv kapaliyken TUM API sessizce bos donuyor, COKMUYOR', altSurec.status === 0,
    altSurec.status === 0 ? '' : (altSurec.stderr || '').split('\n')[0]);

  T.bitir();
})();
