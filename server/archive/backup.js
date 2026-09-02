// ==========================================================================
// KATALOG ARŞİVİ — Otomatik Yedek (A2.5)
// ==========================================================================
// TEK İŞİ: arşivi her gece, BAŞKA BİR FİZİKSEL AYGITA kopyalamak ve eski
// kopyaları döndürmek.
//
// 🔴 NEDEN YAZILDI — TEORİ DEĞİL, YAŞANDI (2026-09-02, Madde 284):
// SSD `EIO: i/o error` vermeye başladı, LazyFetch fail-soft kapandı ve arşiv
// birkaç saat erişilemez kaldı. `03_FAZLAR.md`'nin operasyonel kuralı
// *"`archive/` yedeklenir, `cache/` yedeklenmez"* diyordu — kural yazılıydı,
// UYGULANMAMIŞTI. `backupTo()` A1'de yazıldı ve hiçbir yerden çağrılmadı.
// O gün arşivde 40 MB veri vardı ve tek bir kopyası yoktu.
//
// 🔴 ASLA AYNI DİSKE YEDEKLEME. Yedeğin tek amacı diskin kendisini
// kaybetmeye karşı korunmak; aynı aygıta yazmak hiçbir işe yaramaz. Bu
// yüzden hedef, arşivle AYNI dosya sisteminde çıkarsa yedek ALINMAZ ve
// gürültülü bir uyarı basılır — sessizce işe yaramaz bir yedek üretmek,
// yedek olmamasından daha tehlikelidir (sahte güven).
//
// 🔴 `cp` DEĞİL, `VACUUM INTO`. WAL modunda veri kısmen `-wal` dosyasında;
// yalnızca `.db` kopyalamak EKSİK, üçünü birden kopyalamak kopyalama
// sırasında yazım olursa BOZUK yedek üretir (`db.js` `backupTo`).

const fs = require('fs');
const path = require('path');
const { backupTo, getArchiveStatus, isArchiveEnabled } = require('./db');
const { logSync } = require('./store');

// Kaç kopya tutulur. 7 = bir haftalık geri dönüş. Arşiv ölçüldü: 40 MB
// (2026-09-02), yani 7 kopya ≈ 280 MB — SD kartta rahat. Sayı ölçülmüş
// değil, gerekçelendirilmiş bir başlangıç (04_KARARLAR.md B).
const VARSAYILAN_KOPYA = 7;

// Gece penceresi — süpürücüyle (04:00-06:00) AYNI aralık ama ondan SONRA
// çalışsın diye 05:00'te başlıyor: süpürme diski küçültür, yedek küçülmüş
// hali alır.
const PENCERE_BASI = 5;
const PENCERE_SONU = 7;
const KONTROL_ARALIGI_MS = 60 * 60 * 1000;

/**
 * Yedek dizinini çözer. **Koda gömülmez.**
 * `ARCHIVE_BACKUP_DIR` yoksa kullanıcının ev dizini (Pi'de SD kart) —
 * yani arşivin bulunduğu SSD'den BAŞKA bir aygıt.
 */
function yedekDizini() {
  if (process.env.ARCHIVE_BACKUP_DIR && process.env.ARCHIVE_BACKUP_DIR.trim()) {
    return process.env.ARCHIVE_BACKUP_DIR.trim();
  }
  const ev = process.env.HOME || process.env.USERPROFILE;
  return ev ? path.join(ev, 'kaymak-arsiv-yedek') : null;
}

/**
 * İki yol AYNI dosya sisteminde mi?
 *
 * `fs.statfs` yerine `st_dev` kullanılıyor: aynı aygıttaki iki mount da
 * ayrı `statfs` verebilir, ama `st_dev` fiziksel aygıtı gösterir — bizim
 * sorumuz tam olarak bu.
 */
function ayniAygitMi(a, b) {
  try {
    return fs.statSync(a).dev === fs.statSync(b).dev;
  } catch {
    return false; // kararsızsak engellemiyoruz; asıl kontrol aşağıda loglanıyor
  }
}

/**
 * Bir yedek turu çalıştırır. **Hiçbir koşulda throw ETMEZ.**
 *
 * @returns {Promise<Object|null>} özet (arşiv kapalıysa null)
 */
async function runBackup({ keep = VARSAYILAN_KOPYA, dir = null } = {}) {
  if (!isArchiveEnabled()) return null;

  const hedefDizin = dir || yedekDizini();
  if (!hedefDizin) {
    console.error('[Arsiv yedek] Atlandi — ARCHIVE_BACKUP_DIR ve HOME tanimli degil.');
    return { ok: false, reason: 'hedef_yok' };
  }

  const durum = getArchiveStatus();
  const arsivDizini = path.dirname(durum.dbPath || '');

  try {
    fs.mkdirSync(hedefDizin, { recursive: true });
  } catch (error) {
    console.error(`[Arsiv yedek] Hedef dizin acilamadi: ${error.message}`);
    logSync({ event: 'error', detail: `yedek: hedef dizin acilamadi (${error.message})` });
    return { ok: false, reason: error.message };
  }

  // 🔴 AYNI DİSKE YEDEKLEME KONTROLÜ — sessizce geçilmez.
  if (arsivDizini && ayniAygitMi(arsivDizini, hedefDizin)) {
    const mesaj = `Yedek hedefi arsivle AYNI aygitta (${hedefDizin}). Disk kaybina karsi HICBIR koruma saglamaz — yedek ALINMADI. ARCHIVE_BACKUP_DIR'i baska bir aygita ayarla.`;
    console.error(`[Arsiv yedek] 🔴 ${mesaj}`);
    logSync({ event: 'error', detail: `yedek: ${mesaj}` });
    return { ok: false, reason: 'ayni_aygit', dir: hedefDizin };
  }

  const damga = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const hedef = path.join(hedefDizin, `katalog-${damga}.db`);

  const basladi = Date.now();
  const sonuc = backupTo(hedef);
  if (!sonuc.ok) {
    console.error(`[Arsiv yedek] BASARISIZ: ${sonuc.reason}`);
    logSync({ event: 'error', detail: `yedek: ${sonuc.reason}` });
    return { ok: false, reason: sonuc.reason };
  }

  const dondurulen = kopyalariDondur(hedefDizin, keep);

  const ozet = {
    ok: true,
    path: hedef,
    bytes: sonuc.bytes,
    durationMs: Date.now() - basladi,
    rotated: dondurulen,
    kept: keep,
  };
  console.log(
    `[Arsiv yedek] ${(sonuc.bytes / 1048576).toFixed(1)} MB -> ${hedef} (${ozet.durationMs} ms` +
    (dondurulen ? `, ${dondurulen} eski kopya silindi)` : ')')
  );
  logSync({ event: 'vacuum', detail: `yedek ${(sonuc.bytes / 1048576).toFixed(1)} MB -> ${path.basename(hedef)}` });
  return ozet;
}

/**
 * En yeni `keep` kopyayı bırakır, gerisini siler.
 *
 * ⚠️ Bu, arşiv projesinde dosya SİLEN tek yer — ama sildiği şey ARŞİV
 * DEĞİL, arşivin eski kopyaları. "Arşiv hiçbir şeyi silmez" kuralı katalog
 * verisi içindir; sonsuz yedek biriktirmek diski doldurup ASIL yedeği
 * imkânsız kılardı.
 *
 * 🔴 YALNIZCA KENDİ ÜRETTİĞİ DESENİ siler (`katalog-<damga>.db`) — hedef
 * dizinde başka dosyalar varsa onlara dokunmaz. Kullanıcı yanlışlıkla
 * dolu bir dizini hedef gösterirse veri kaybı olmaz.
 */
function kopyalariDondur(dizin, keep) {
  if (!Number.isFinite(keep) || keep < 1) return 0;
  let dosyalar;
  try {
    dosyalar = fs.readdirSync(dizin)
      .filter((f) => /^katalog-.+\.db$/.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(dizin, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
  } catch {
    return 0;
  }
  let silinen = 0;
  for (const { f } of dosyalar.slice(keep)) {
    try { fs.unlinkSync(path.join(dizin, f)); silinen++; } catch { /* onemli degil */ }
  }
  return silinen;
}

let zamanlayici = null;
let sonYedekGunu = null;

/**
 * Gece yedek zamanlayıcısını kurar. `server.js` açılışta bir kez çağırır.
 * Arşiv kapalıysa hiç kurulmaz (`sweeper.js`'in aynı deseni).
 */
function startBackupSchedule(config) {
  if (!isArchiveEnabled()) {
    console.log('[Arsiv yedek] Kurulmadi — arsiv devre disi.');
    return null;
  }
  if (zamanlayici) return zamanlayici;

  zamanlayici = setInterval(() => {
    const simdi = new Date();
    const saat = simdi.getHours();
    const gun = simdi.toDateString();
    if (saat < PENCERE_BASI || saat >= PENCERE_SONU) return;
    if (sonYedekGunu === gun) return;
    sonYedekGunu = gun;
    runBackup(config).catch(() => { /* runBackup zaten yutuyor */ });
  }, KONTROL_ARALIGI_MS);

  // Süreç kapanmasını engellemesin (sweeper.js'teki aynı gerekçe).
  if (typeof zamanlayici.unref === 'function') zamanlayici.unref();

  console.log(`[Arsiv yedek] Kuruldu — her gun ${PENCERE_BASI}:00-${PENCERE_SONU}:00, ${yedekDizini()}`);
  return zamanlayici;
}

function stopBackupSchedule() {
  if (zamanlayici) { clearInterval(zamanlayici); zamanlayici = null; }
  sonYedekGunu = null;
}

module.exports = {
  runBackup,
  startBackupSchedule,
  stopBackupSchedule,
  yedekDizini,
  kopyalariDondur,
  VARSAYILAN_KOPYA,
  PENCERE_BASI,
  PENCERE_SONU,
};
