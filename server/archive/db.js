// ==========================================================================
// KATALOG ARŞİVİ — Bağlantı ve Göç (A1, dosya 1/3)
// ==========================================================================
// TEK İŞİ: SQLite bağlantısını açmak, pragmaları kurmak, şemayı güncel
// tutmak ve "arşiv şu an kullanılabilir mi" sorusunun TEK gerçek kaynağı
// olmak. `server/lazyfetch/paths.js`'in arşiv karşılığı — aynı felsefe:
//
// 🔴 BU DOSYA ASLA THROW ETMEZ. Arşiv açılamazsa (disk yok, izin yok,
// sürücü yüklenemedi) SESSİZCE devre dışı kalır ve sunucunun geri kalanı
// bundan hiç etkilenmez. Arşiv bir LÜKSTÜR; kullanıcının isteği onun
// rehinesi olamaz (03_FAZLAR.md A2: "arşiv yazımı başarısız olursa istek
// BAŞARISIZ OLMAZ").
//
// 🔴 ARŞİV VE CACHE'İN HATA ALANLARI AYRIDIR — bilinçli. `paths.js`
// alt klasörlerden biri açılamazsa TÜM cache'i kapatıyor. Arşivi oraya
// eklemek, bir arşiv sorununun önbelleği de düşürmesi demekti. İki sistem
// aynı SSD'yi paylaşır ama birbirini düşürmez (01_MIMARI.md "cache ≠ arşiv").
//
// 🔴 SÜRÜCÜ: `node:sqlite` — Node ile GELEN yerleşik modül, harici paket
// YOK (03_FAZLAR.md "Paket önerisi"). Alternatifi `better-sqlite3` native
// bir modüldür: Pi'de ARM için derlenmesi gerekir, her `npm ci` build
// toolchain ister ve Expo/EAS tarafına sızma riski taşır.
//
// 📏 PI'DE ÖLÇÜLDÜ (2026-08-29, tahmin DEĞİL — Madde 233): Node v22.23.2 ·
// SQLite **3.51.3** · `node:sqlite` bayraksız yükleniyor. Bel bağladığımız
// dört özellik tek tek denendi:
//   • `COALESCE` ifade indeksi (3.9+)   → sezon tekilliği, NULL tuzağı
//   • kısmi indeks `WHERE` (3.8+)       → aynı indeks
//   • `ON CONFLICT DO UPDATE` (3.24+)   → payload latest-wins upsert
//   • `VACUUM INTO` (3.27+)             → TEK güvenli yedek yöntemi
// Hepsi 3.51.3'te fazlasıyla mevcut.
//
// ⚠️ Node 22'de bu modül "experimental" damgalı ve her açılışta stderr'e
// bir `ExperimentalWarning` yazar — `journalctl -u kaymak` çıktısında
// görünür. Hata DEĞİL. Susturmak için `--no-warnings` gerekir ama o TÜM
// Node uyarılarını susturur; bilinçli olarak susturmuyoruz.
//
// Yine de `require` KORUMALI: sürücü bir gün kaldırılır/değişirse arşiv
// kapanır, sunucu ayakta kalır.

const fs = require('fs');
const path = require('path');

// ⚠️ Korumalı yükleme — Node 22.5 ÖNCESİ bir sürümde veya `node:sqlite`'ın
// bayrak istediği bir yapılandırmada `require` FIRLATIR. Yakalamazsak
// `server.js` açılışta çöker; yakalarsak yalnızca arşiv kapanır.
let sqlite = null;
let sqliteYuklemeHatasi = null;
try {
  sqlite = require('node:sqlite');
} catch (error) {
  sqliteYuklemeHatasi = error.message;
}

const SEMA_YOLU = path.join(__dirname, 'schema.sql');

// Şemanın beklediği sürüm. Artırıldığında `GOCLER` tablosuna karşılık
// gelen adım eklenmeli — yoksa açılış "bilinmeyen sürüm" diye durur.
const HEDEF_SEMA_SURUMU = 1;

let durum = null; // { enabled, db, dbPath } | { enabled: false, reason }

/**
 * Arşivin kök dizinini çözer. **Koda gömülmez** (03_FAZLAR.md operasyonel
 * kurallar): `ARCHIVE_ROOT` varsa o, yoksa `${LAZYFETCH_ROOT}/archive`.
 *
 * Ayrı bir env değişkeni bilinçli: ileride arşiv BAŞKA bir diske (ör.
 * yedeklenen bir volume'e) taşınabilmeli — cache'in yeriyle zincirlenmiş
 * olmamalı. `cache/` yedeklenmez, `archive/` yedeklenir.
 */
function arsivKokunuCoz() {
  if (process.env.ARCHIVE_ROOT && process.env.ARCHIVE_ROOT.trim()) {
    return process.env.ARCHIVE_ROOT.trim();
  }
  const lf = process.env.LAZYFETCH_ROOT;
  if (lf && lf.trim()) return path.join(lf.trim(), 'archive');
  return null;
}

/**
 * Bağlantıyı açar, pragmaları kurar, şemayı göç ettirir.
 * Hiçbir koşulda throw ETMEZ.
 *
 * @returns {{enabled: boolean, reason?: string, dbPath?: string}}
 */
function initArchive() {
  if (durum !== null) return kisaDurum();

  if (!sqlite) {
    durum = { enabled: false, reason: `node:sqlite yuklenemedi (${sqliteYuklemeHatasi})` };
    console.error(`[Arsiv] Devre disi — ${durum.reason}`);
    return kisaDurum();
  }

  const kok = arsivKokunuCoz();
  if (!kok) {
    durum = { enabled: false, reason: 'ARCHIVE_ROOT / LAZYFETCH_ROOT tanimli degil' };
    console.log('[Arsiv] Devre disi — ARCHIVE_ROOT veya LAZYFETCH_ROOT tanimli degil.');
    return kisaDurum();
  }

  try {
    fs.mkdirSync(kok, { recursive: true });
    // Dizin VAR ama salt-okunur bir mount olabilir — gerçek yazma yetkisi
    // asıl kanıttır (paths.js'teki aynı kontrol).
    fs.accessSync(kok, fs.constants.W_OK);

    const dbPath = path.join(kok, 'katalog.db');
    const db = new sqlite.DatabaseSync(dbPath);

    // ------------------------------------------------------------------
    // PRAGMALAR — sırası önemli
    // ------------------------------------------------------------------
    // WAL: okuyucu ve yazıcı birbirini BLOKLAMAZ. A2 arka planda yazarken
    // A4 aynı anda okuyabilmeli. Ayrıca ani kesintide (Pi'de elektrik)
    // rollback journal'a göre belirgin şekilde dayanıklı.
    db.exec('PRAGMA journal_mode = WAL');

    // NORMAL: her yazımda fsync YAPMAZ (FULL öyle yapar). Ani kesintide
    // en fazla SON İŞLEM kaybolur, veritabanı BOZULMAZ. Arşiv verisi
    // sağlayıcıdan yeniden çekilebilir olduğu için bu değiş-tokuş doğru;
    // FULL, Pi'nin SSD'sini bir arşiv yazımı için gereksiz yorardı.
    db.exec('PRAGMA synchronous = NORMAL');

    // 🔴 SQLite'ta yabancı anahtarlar VARSAYILAN OLARAK KAPALIDIR ve ayar
    // BAĞLANTI BAŞINADIR — şemadaki `PRAGMA foreign_keys = ON` yalnızca
    // onu çalıştıran bağlantı için geçerlidir. Burada tekrar kurulmazsa
    // `ON DELETE RESTRICT` korumaları SESSİZCE etkisiz kalırdı.
    db.exec('PRAGMA foreign_keys = ON');

    // Yazıcı kilidi tutuyorsa hemen hata vermek yerine bekle.
    db.exec('PRAGMA busy_timeout = 5000');

    semayiGocEt(db);

    durum = { enabled: true, db, dbPath, root: kok };
    console.log(`[Arsiv] Etkin — ${dbPath}`);
    return kisaDurum();
  } catch (error) {
    durum = { enabled: false, reason: error.message };
    console.error(`[Arsiv] Devre disi — acilamadi: ${error.message}`);
    return kisaDurum();
  }
}

/**
 * Şemayı hedef sürüme taşır.
 *
 * 🔴 ARŞİV GÖÇÜ, CACHE GEÇERSİZ KILMASININ TERSİDİR. LazyFetch zarfında
 * `v` artınca tüm eski kayıtlar ÇÖPE gider (envelope.js) — çünkü orası bir
 * önbellek. Burada eski kayıtlar TAŞINIR; arşiv hiçbir şeyi atmaz.
 * Bu yüzden ileride v2 geldiğinde `GOCLER`'e "ALTER TABLE ..." adımı
 * eklenecek, "DROP + yeniden oluştur" ASLA yazılmayacak.
 */
function semayiGocEt(db) {
  const sema = fs.readFileSync(SEMA_YOLU, 'utf8');
  // schema.sql tamamen `IF NOT EXISTS` — var olan bir veritabaninda
  // zararsiz, bos bir veritabaninda kurulum yapar.
  db.exec(sema);

  const satir = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get();
  const mevcut = satir ? parseInt(satir.value, 10) : 0;

  if (mevcut === HEDEF_SEMA_SURUMU) return;

  if (mevcut > HEDEF_SEMA_SURUMU) {
    // Daha yeni bir kod bu dosyayı yazmış — eski kodla açmak veri
    // bozabilir. Açmayı reddetmek, sessizce yanlış yazmaktan iyidir.
    throw new Error(`Arsiv semasi surumu ${mevcut}, bu kod en fazla ${HEDEF_SEMA_SURUMU} destekliyor. Kodu guncelle.`);
  }

  // mevcut < HEDEF: buraya v2, v3 adımları gelecek. v1'de yapılacak bir
  // şey yok — `schema.sql` zaten kurdu ve sürümü yazdı.
  throw new Error(`Arsiv semasi ${mevcut} -> ${HEDEF_SEMA_SURUMU} gocu tanimli degil.`);
}

function kisaDurum() {
  if (!durum) return { enabled: false, reason: 'baslatilmadi' };
  if (!durum.enabled) return { enabled: false, reason: durum.reason };
  return { enabled: true, dbPath: durum.dbPath, root: durum.root };
}

/** Açık bağlantı — arşiv kapalıysa `null`. Çağıran taraf bunu kontrol ETMELİ. */
function getDb() {
  if (durum === null) initArchive();
  return durum.enabled ? durum.db : null;
}

function isArchiveEnabled() {
  if (durum === null) initArchive();
  return durum.enabled === true;
}

/** Teşhis/log amaçlı — neden kapalı olduğunu insan okunur döner. */
function getArchiveStatus() {
  if (durum === null) initArchive();
  return kisaDurum();
}

// İç içe `transaction()` çağrılarının derinliği. Aşağıdaki kırmızı nota bak.
let islemDerinligi = 0;

/**
 * Bir işi TEK işlem (transaction) içinde çalıştırır.
 *
 * 🔴 GEREKLİ: kimlik çözümlemesi (identity.js) birden çok tabloya yazıyor —
 * `entities` + N adet `external_ids`. Yarıda kesilirse dış kimliği olmayan
 * öksüz bir entity kalır ve bir daha ASLA bulunamaz (arama external_ids
 * üzerinden yapılıyor), yani sessizce çift kayıt üretmeye başlardık.
 *
 * 🔴🔴 İÇ İÇE ÇAĞRIYA DAYANIKLI — İKİ SEBEPLE ZORUNLU:
 *
 * 1. **SQLite iç içe `BEGIN` KABUL ETMEZ** ("cannot start a transaction
 *    within a transaction"). `resolveOrCreate` kendi içinde `transaction()`
 *    çağırıyor; A2 bir dizinin TÜM hiyerarşisini (sezonlar + bölümler) tek
 *    blokta yazmak için onları dıştan saracak. Derinlik sayacı olmasaydı
 *    ikinci çağrı anında patlardı.
 *
 * 2. **PERFORMANS.** Her satırı ayrı transaction'la yazmak, SQLite'ı satır
 *    başına bir `fsync`/WAL commit'ine zorlar. 1.220 bölümlük bir dizide bu
 *    1.220 ayrı commit demek — Pi'nin diskini gereksiz yere döver ve süreyi
 *    kat kat uzatır. Tek transaction'da aynı iş toplu yazılır.
 *    (Bu uyarı kullanıcıdan geldi; ölçümü `scripts/arsiv-benchmark.js`'te.)
 *
 * İç çağrılar DIŞ işleme katılır: kendi `BEGIN`/`COMMIT`'lerini vermezler.
 * Yani "hep ya da hiç" garantisi en dıştaki bloğun tamamını kapsar — bir
 * bölüm yazılamazsa o dizinin hiçbir parçası yazılmamış olur. Arşiv için
 * doğru davranış bu: yarım bir hiyerarşi, hiç olmayandan daha tehlikelidir
 * (kapsam ölçümü yalan söylemeye başlar).
 *
 * `node:sqlite`'ta yerleşik bir transaction sarmalayıcısı yok; klasik
 * BEGIN/COMMIT/ROLLBACK.
 */
function transaction(is) {
  const db = getDb();
  if (!db) return null;

  // İç çağrı: dış işleme katıl, kendi BEGIN'ini AÇMA.
  if (islemDerinligi > 0) {
    islemDerinligi += 1;
    try {
      return is(db);
    } finally {
      islemDerinligi -= 1;
    }
  }

  islemDerinligi = 1;
  db.exec('BEGIN');
  try {
    const sonuc = is(db);
    db.exec('COMMIT');
    return sonuc;
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch (_) { /* zaten kapanmış olabilir */ }
    throw error;
  } finally {
    islemDerinligi = 0;
  }
}

// Dış (en üst seviye) asenkron işlemleri SIRAYA sokar — aşağıdaki nota bak.
let yazimZinciri = Promise.resolve();

/**
 * `transaction()`'ın ASENKRON ikizi: iş fonksiyonu `await` edebilir.
 *
 * 🔴🔴 NEDEN VAR — ÖLÇÜLDÜ (2026-08-29):
 * `node:sqlite`'ın API'si `DatabaseSync`, yani SENKRON. Bir dizinin tüm
 * hiyerarşisini yazmak Node'un TEK iş parçacığını bloklar. Ölçüm:
 * `general-hospital` (10.833 bölüm) yazımı olay döngüsünü geliştirme
 * makinesinde **691 ms**, Pi'de **~5,5 sn** bloklıyor — bu süre boyunca
 * sunucu HİÇBİR HTTP isteğine cevap veremiyor. Arşivi bir "kuyruğa almak"
 * bunu ÇÖZMEZ, çünkü kuyruk da aynı iş parçacığında koşar.
 *
 * Çözüm: transaction AÇIK kalır (bütünlük ve hız korunur), ama yazıcı
 * düzenli aralıklarla olay döngüsüne dönüş yapar (`writer.js` `nefesAl`).
 * SQLite işlemi bağlantı ömrüne bağlıdır, tick'e değil — araya girip
 * dönmek işlemi bozmaz. WAL sayesinde OKUYUCULAR zaten bloklanmaz.
 *
 * 🔴 DIŞ ÇAĞRILAR SIRAYA SOKULUR. İki arşiv yazımı iç içe geçerse aynı
 * bağlantı üzerinde iki `BEGIN` denenir ve veri bozulur. Kuyruğun
 * eşzamanlılığını 1'de tutmak YETMEZ — bu garanti burada, yapısal olarak
 * veriliyor.
 *
 * ⚠️ DEVREDEN ÇIKAN TEK VARSAYIM: bir asenkron yazım "nefes alırken"
 * BAŞKA bir kod `resolveOrCreate` çağırırsa, o çağrı açık işleme KATILIR
 * (derinlik sayacı > 0). Bugün arşive yazan tek yer bu kuyruk olduğu için
 * bu durum oluşmuyor. İleride ikinci bir yazar eklenirse (ör. A3
 * backfill), o da MUTLAKA aynı kuyruktan geçmelidir.
 */
async function transactionAsync(is) {
  const db = getDb();
  if (!db) return null;

  // İç çağrı: dış işleme katıl.
  if (islemDerinligi > 0) {
    islemDerinligi += 1;
    try {
      return await is(db);
    } finally {
      islemDerinligi -= 1;
    }
  }

  // Dış çağrı: önceki yazım bitene kadar bekle (sıraya gir).
  const oncekiler = yazimZinciri;
  let serbestBirak;
  yazimZinciri = new Promise((r) => { serbestBirak = r; });
  await oncekiler.catch(() => { /* onceki yazimin hatasi bizi ilgilendirmez */ });

  islemDerinligi = 1;
  db.exec('BEGIN');
  try {
    const sonuc = await is(db);
    db.exec('COMMIT');
    return sonuc;
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch (_) { /* zaten kapanmış olabilir */ }
    throw error;
  } finally {
    islemDerinligi = 0;
    serbestBirak();
  }
}

/**
 * Çalışan veritabanından TUTARLI bir yedek alır.
 *
 * 🔴 `cp` İLE YEDEK ALINMAZ. WAL modunda veri kısmen `-wal` dosyasındadır;
 * yalnızca `.db` kopyalamak EKSİK, üçünü birden kopyalamak ise kopyalama
 * sırasında yazım olursa BOZUK bir yedek üretir. `VACUUM INTO` tek dosyalık,
 * tutarlı ve sıkıştırılmış bir kopya yazar (SQLite 3.27+).
 */
function backupTo(hedefYol) {
  const db = getDb();
  if (!db) return { ok: false, reason: 'arsiv kapali' };
  try {
    // SQLite yol ayracı olarak `/` bekler; Windows'ta test edilebilsin.
    const guvenliYol = hedefYol.replace(/\\/g, '/').replace(/'/g, "''");
    db.exec(`VACUUM INTO '${guvenliYol}'`);
    return { ok: true, path: hedefYol, bytes: fs.statSync(hedefYol).size };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

/**
 * 🔴 SALT-OKUNUR bağlantı — teşhis araçları için (`lazyfetch-inspect.js`).
 *
 * NEDEN AYRI: `initArchive()` şema DDL'i çalıştırır (`CREATE TABLE IF NOT
 * EXISTS ...`). Denetçi onu çağırdığında, sunucu arşive yazarken bile
 * bir YAZMA kilidi istemiş olur. Denetçinin kendi sözleşmesi ise
 * "hiçbir şey silmez, yazmaz, değiştirmez" (dosya başlığı) — bu çelişkiyi
 * kapatıyoruz.
 *
 * `readOnly: true` SQLite düzeyinde zorlanıyor (denendi: yazma girişimi
 * `attempt to write a readonly database` ile reddediliyor), yani disiplin
 * değil YAPISAL bir garanti. WAL sayesinde sunucu yazarken okumak
 * bloklanmaz.
 *
 * Şema YOKSA (arşiv hiç oluşmamışsa) `null` döner — açmayı DENEMEZ,
 * çünkü salt-okunur açış var olmayan dosyayı yaratmaz, hata verir.
 *
 * @returns {{db: object, dbPath: string}|null} Çağıran taraf `close()`
 *   etmekle yükümlü — bu bağlantı singleton DEĞİLDİR.
 */
function openReadOnly() {
  if (!sqlite) return null;
  const kok = arsivKokunuCoz();
  if (!kok) return null;
  const dbPath = path.join(kok, 'katalog.db');
  if (!fs.existsSync(dbPath)) return null;
  try {
    const db = new sqlite.DatabaseSync(dbPath, { readOnly: true });
    return { db, dbPath };
  } catch (_) {
    return null;
  }
}

/** Test ve düzgün kapanış için. */
function closeArchive() {
  if (durum && durum.enabled) {
    try { durum.db.close(); } catch (_) { /* zaten kapali */ }
  }
  durum = null;
}

module.exports = {
  initArchive,
  isArchiveEnabled,
  getArchiveStatus,
  getDb,
  transaction,
  transactionAsync,
  backupTo,
  openReadOnly,
  closeArchive,
  HEDEF_SEMA_SURUMU,
};
