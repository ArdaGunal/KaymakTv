// ==========================================================================
// ŞEMA GÖÇÜ — v1 -> v2 -> v3 (§C16)
// ==========================================================================
// 🔴 NEDEN AYRI BİR TAKIM: diğer arşiv testleri veritabanını `schema.sql`'den
// SIFIRDAN kuruyor. `schema.sql` her zaman GÜNCEL şemayı üretir — yani o
// testler geçerken bile GÖÇ YOLU hiç koşmaz. Üretimde ise tam tersi: Pi'deki
// dosya v2 ve oraya ancak göç adımıyla ulaşılabilir. Göç, üretimde çalışıp
// testte hiç çalışmayan tek kod yoluydu.
//
// 🔴 §C16'NIN DERSİ BURADA KİLİTLENİYOR: `sync_log.event` üzerindeki CHECK
// `mirror.js`'in sekiz günlük çıktısını sessizce yok etti. Bu takım hem
// kısıtın kalktığını hem de ESKİ SATIRLARIN TAŞINDIĞINI kanıtlar — çünkü
// CHECK'i kaldırmanın SQLite'taki tek yolu tabloyu yeniden kurmak, ve
// "yeniden kurma" veri kaybının klasik yeridir.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { baslat, AR } = require('../yardimci');

const T = baslat('SEMA GOCU (v1 -> v3)', { kokOneki: 'ar-goc-' });
const db = require(path.join(AR, 'db'));
const depo = require(path.join(AR, 'store'));

// Üretimdeki v2 `sync_log` — CHECK'İYLE BİRLİKTE. Bilerek birebir kopya:
// bu takımın ölçtüğü şey "eski dünyadan yeni dünyaya geçiş".
const ESKI_SYNC_LOG = [
  'CREATE TABLE sync_log (',
  '  id        INTEGER PRIMARY KEY,',
  '  at        INTEGER NOT NULL,',
  "  event     TEXT NOT NULL CHECK (event IN ('upsert','conflict','error','backfill','vacuum')),",
  '  provider  TEXT,',
  '  endpoint  TEXT,',
  '  kaymak_id TEXT,',
  '  detail    TEXT',
  ');',
  'CREATE INDEX idx_synclog_at    ON sync_log(at);',
  'CREATE INDEX idx_synclog_event ON sync_log(event);',
].join('\n');

/** Elle bir ESKİ arşiv dosyası kurar ve kökünü döndürür. */
function eskiArsivKur(surum) {
  const kok = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-goc-kaynak-'));
  fs.mkdirSync(path.join(kok, 'archive'), { recursive: true });
  const d = new DatabaseSync(path.join(kok, 'archive', 'katalog.db'));
  d.exec('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);');
  d.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?)").run(String(surum));
  d.exec(ESKI_SYNC_LOG);
  if (surum === 1) {
    // v1'de `retired_at` YOK — v1 -> v2 adımının gerçekten koşması için şart.
    d.exec([
      'CREATE TABLE external_ids (',
      '  source        TEXT NOT NULL,',
      '  source_id     TEXT NOT NULL,',
      '  kaymak_id     TEXT NOT NULL,',
      '  first_seen_at INTEGER NOT NULL,',
      '  last_seen_at  INTEGER NOT NULL,',
      '  PRIMARY KEY (source, source_id)',
      ');',
    ].join('\n'));
  }
  return { kok, d };
}

// ====================================================================
T.H('BASLANGIC — eski dunyada CHECK GERCEKTEN reddediyor');
// ====================================================================
// 🔑 Bu iddia bir "aleti sına" adımı: reddettiğini gösteremezsek, aşağıdaki
// "artık kabul ediyor" iddiası hiçbir şey kanıtlamaz (devir §8 ders 10).
const v2 = eskiArsivKur(2);
const yaz = v2.d.prepare('INSERT INTO sync_log (id, at, event, provider, detail) VALUES (?, ?, ?, ?, ?)');
yaz.run(11, 1000, 'backfill', 'trakt', 'birinci');
yaz.run(22, 2000, 'error', 'trakt', 'ikinci');
yaz.run(33, 3000, 'vacuum', null, 'ucuncu');

let eskiRed = false;
try {
  yaz.run(44, 4000, 'mirror', 'supabase', 'ayna');
} catch (e) {
  eskiRed = /CHECK constraint/i.test(e.message);
}
T.ok('🔴 v2 semasi event=mirror u REDDEDIYOR', eskiRed,
  eskiRed ? 'CHECK constraint failed' : 'REDDETMEDI — test anlamsiz');
T.ok('Gocten once 3 satir var', v2.d.prepare('SELECT count(*) c FROM sync_log').get().c === 3);
v2.d.close();

// ====================================================================
T.H('v2 -> v3 GOCU');
// ====================================================================
process.env.LAZYFETCH_ROOT = v2.kok;
const durum = db.initArchive();
T.ok('Arsiv acildi', durum.enabled, durum.reason || durum.dbPath);

const bag = db.getDb();
const surum = bag.prepare("SELECT value v FROM meta WHERE key='schema_version'").get().v;
T.ok('Sema surumu 3 oldu', surum === '3', 'surum=' + surum);
T.ok('db.js hedef surumuyle TUTARLI', Number(surum) === db.HEDEF_SEMA_SURUMU,
  'meta=' + surum + ' kod=' + db.HEDEF_SEMA_SURUMU);

// ====================================================================
T.H('🔴 YENIDEN KURMA VERI KAYBETMEDI');
// ====================================================================
// Tabloyu DROP edip yeniden yaratan bir göç, veri kaybının klasik yeridir.
// Satır SAYISI yetmez: `id` de korunmalı, çünkü `sync_log.id` bir rowid
// takma adı ve dışarıdan atıfta bulunulabilir.
const kalanlar = bag.prepare('SELECT id, at, event, provider, detail FROM sync_log ORDER BY id').all();
T.ok('Satir sayisi korundu (3)', kalanlar.length === 3, kalanlar.length + ' satir');
T.ok('🔴 id degerleri KORUNDU (11/22/33)',
  JSON.stringify(kalanlar.map((r) => r.id)) === '[11,22,33]',
  kalanlar.map((r) => r.id).join(','));
T.ok('Tum kolonlar tasindi (at/event/provider/detail)',
  kalanlar[0].at === 1000 && kalanlar[0].event === 'backfill'
  && kalanlar[0].provider === 'trakt' && kalanlar[0].detail === 'birinci');
T.ok('NULL kolonlar NULL kaldi', kalanlar[2].provider === null);

const indeksler = bag
  .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='sync_log' ORDER BY name")
  .all().map((r) => r.name);
T.ok('Her iki indeks de yeniden kuruldu',
  indeksler.includes('idx_synclog_at') && indeksler.includes('idx_synclog_event'),
  indeksler.join(', '));

T.ok('Gecici tablo ARTIK YOK',
  bag.prepare("SELECT count(*) c FROM sqlite_master WHERE name='sync_log_yeni'").get().c === 0);

// ====================================================================
T.H('🔑 ASIL AMAC — ayna artik defterine yazabiliyor');
// ====================================================================
T.ok('🔴 logSync event=mirror u YAZDI',
  depo.logSync({ event: 'mirror', provider: 'supabase', detail: 'ayna turu' }) === true);
T.ok('Satir gercekten defterde',
  bag.prepare("SELECT count(*) c FROM sync_log WHERE event='mirror'").get().c === 1);

// 🔴 CHECK kalktı diye DENETİM kalkmadı: tanımadığı bir olay YAZILIR ama
// `console.warn` ile duyurulur. Sessizlik, §C16'nın asıl arızasıydı.
const uyarilar = [];
const eskiWarn = console.warn;
console.warn = (...a) => uyarilar.push(a.join(' '));
const bilinmeyen = depo.logSync({ event: 'zamazingo', detail: 'tanimsiz olay' });
console.warn = eskiWarn;
T.ok('Tanimadigi olay YINE DE yazildi (sessizce dusurulmedi)', bilinmeyen === true);
T.ok('🔴 ...ama UYARI verildi', uyarilar.length === 1 && /TANINMAYAN olay/.test(uyarilar[0]),
  uyarilar[0] || 'uyari YOK');

// ====================================================================
T.H('🔴 v1 arsivi TEK ACILISTA v3 e cikiyor');
// ====================================================================
// Eski göç kodu v1 -> v2 adımından sonra `return` ediyordu. v3 gelince bu,
// v1'deki bir arşivi 2'de bırakıp v3'ün beklediği şemayı HİÇ kurmazdı.
db.closeArchive();
const v1 = eskiArsivKur(1);
v1.d.prepare('INSERT INTO sync_log (id, at, event, detail) VALUES (?,?,?,?)').run(7, 700, 'upsert', 'v1 satiri');
v1.d.close();

process.env.LAZYFETCH_ROOT = v1.kok;
const durum1 = db.initArchive();
T.ok('v1 arsivi acildi', durum1.enabled, durum1.reason || '');
const bag1 = db.getDb();
const surum1 = bag1.prepare("SELECT value v FROM meta WHERE key='schema_version'").get().v;
T.ok('🔴 v1 -> 3 (tek acilista, iki adim ardisik kostu)', surum1 === '3', 'surum=' + surum1);
T.ok('v1 -> v2 adimi da kostu (retired_at kolonu geldi)',
  bag1.prepare('PRAGMA table_info(external_ids)').all().some((k) => k.name === 'retired_at'));
T.ok('v1 satiri kaybolmadi',
  bag1.prepare('SELECT detail d FROM sync_log WHERE id=7').get().d === 'v1 satiri');
T.ok('v1 arsivinde de mirror yazilabiliyor',
  depo.logSync({ event: 'mirror', detail: 'v1 sonrasi ayna' }) === true);

// ====================================================================
T.H('GOC TEKRARLANABILIR — ikinci acilis bir sey BOZMUYOR');
// ====================================================================
db.closeArchive();
const tekrar = db.initArchive();
T.ok('Ikinci acilis sorunsuz', tekrar.enabled, tekrar.reason || '');
const bag2 = db.getDb();
T.ok('Surum hala 3',
  bag2.prepare("SELECT value v FROM meta WHERE key='schema_version'").get().v === '3');
const kalan2 = bag2.prepare('SELECT count(*) c FROM sync_log').get().c;
T.ok('Satirlar hala yerinde (2)', kalan2 === 2, kalan2 + ' satir');

db.closeArchive();
for (const k of [v2.kok, v1.kok]) {
  try { fs.rmSync(k, { recursive: true, force: true }); } catch (_) { /* Windows dosya tanimi */ }
}
T.bitir();
