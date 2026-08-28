// ==========================================================================
// LAZYFETCH — Disk Katmanı (L1, dosya 4/5) — L1'in KALBİ
// ==========================================================================
// TEK İŞİ: bir zarfı (envelope.js) diske GÜVENLE yazmak/okumak. Bu dosyanın
// tüm tasarımı tek bir soruya cevap: "Raspberry Pi'nin elektriği yazma
// ortasında kesilirse ne olur?"
//
// 🔴 ATOMİK YAZMA (docs/Lazy Down Plan/01_MIMARI.md kural 2 + 03_FAZLAR.md
// L1 doğrulama): asla hedef dosyaya DOĞRUDAN yazılmaz.
//     tmp/<benzersiz>.tmp içine yaz
//         → fsync (veriyi diske fiziksel olarak zorla)
//         → AYNI DOSYA SİSTEMİNDE rename() (POSIX'te atomik)
// `rename()` atomik olduğu için okuyucu HER ZAMAN ya eski (sağlam) ya yeni
// (sağlam) dosyayı görür — yarım/bozuk bir JSON asla servis edilmez.
//
// 🔴 KARANTİNA (01_MIMARI.md "Süpürücü…" + 02_ENVANTER.md): bozuk bir dosya
// bulunursa SİLİNMEZ, `quarantine/`'e taşınır — teşhis için kanıt kalır.
// Okuma tarafı bunu kullanıcıya asla göstermez, sessizce "cache miss" gibi
// davranır (çağıran taraf sağlayıcıya gider).
//
// 🔴 İKİNCİ KADEME PATH GÜVENLİĞİ: key.js'in ürettiği `relativePath` zaten
// güvenli (yalnızca hex+`/`) ama bu dosya kendi başına da "çözülen mutlak
// yol gerçekten cache kökünün İÇİNDE mi" kontrolü yapar — savunma
// derinliği, tek bir katmana güvenilmez.
//
// Sıkıştırma: Node'un yerleşik `zlib`'i kullanılıyor — yeni paket YOK
// (03_FAZLAR.md "Paket önerisi": ilk sürümde harici paket eklenmesin).

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { getLazyFetchDir, isLazyFetchEnabled } = require('./paths');

/**
 * `relativePath`'in (key.js çıktısı) gerçekten `baseDir`'in altında kaldığını
 * doğrular. key.js'in hash tabanlı çıktısı zaten bunu garanti eder ama
 * burada TEKRAR doğrulanır — tek bir dosyanın hatası tüm sistemi açık
 * bırakmasın.
 */
function resolveSafePath(baseDir, relativePath) {
  const resolved = path.resolve(baseDir, relativePath);
  const normalizedBase = path.resolve(baseDir) + path.sep;
  if (!resolved.startsWith(normalizedBase)) {
    throw new Error(`[LazyFetch] Güvensiz yol reddedildi: "${relativePath}" cache kökünün dışına çıkıyor.`);
  }
  return resolved;
}

/**
 * Zarfı (envelope.js çıktısı) atomik olarak diske yazar.
 *
 * Cache kapalıysa (SSD yok/erişilemez) SESSİZCE hiçbir şey yapmaz — bu bir
 * hata değil, "yazacak yer yok" durumudur; çağıran taraf (orchestrator)
 * kesintisiz devam etmeli.
 *
 * @param {string} relativePath  key.js'in `buildCacheKey().relativePath`'i
 * @param {Object} envelope      envelope.js'in `createEnvelope()` çıktısı
 */
async function writeCacheEntry(relativePath, envelope) {
  if (!isLazyFetchEnabled()) return { ok: false, reason: 'disabled' };

  const cacheDir = getLazyFetchDir('cache');
  const tmpDir = getLazyFetchDir('tmp');
  const targetPath = resolveSafePath(cacheDir, relativePath);
  // tmp dosyayı da AYNI SSD'de tutmak zorunludur — rename() yalnızca aynı
  // dosya sistemi içinde atomiktir (farklı mount'lar arasında "copy" olur,
  // yarı-kopyalanmış dosya riski geri gelir).
  const tmpPath = path.join(tmpDir, `${crypto.randomUUID()}.tmp`);

  try {
    await fsp.mkdir(path.dirname(targetPath), { recursive: true });

    const json = JSON.stringify(envelope);
    const compressed = zlib.gzipSync(json);

    const handle = await fsp.open(tmpPath, 'w');
    try {
      await handle.writeFile(compressed);
      await handle.sync(); // fsync — Pi'de elektrik kesintisine karşı gerçek güvence
    } finally {
      await handle.close();
    }

    // Atomik yayın noktası. Buradan sonra dosya ya HİÇ yoktu ya da TAM.
    await fsp.rename(tmpPath, targetPath);
    return { ok: true, path: targetPath, bytes: compressed.length };
  } catch (error) {
    // Yarım kalan tmp dosyayı temizlemeyi dene — başarısız olursa önemli
    // değil, `tmp/` zaten süpürücünün (L6) düzenli temizlediği bir alan.
    await fsp.unlink(tmpPath).catch(() => {});
    console.error(`[LazyFetch] Yazma başarısız (${relativePath}): ${error.message}`);
    return { ok: false, reason: error.message };
  }
}

/**
 * Bir zarfı diskten okur. Üç sonuç mümkün:
 *   - { ok: true, envelope }   → başarılı
 *   - { ok: false, reason: 'not_found' } → dosya hiç yok (normal cache miss)
 *   - { ok: false, reason: 'corrupt' }   → dosya vardı ama bozuktu, KARANTİNAYA taşındı
 *
 * Hiçbir durumda throw ETMEZ — çağıran taraf her zaman "veri var mı yok
 * mu" sorusuna sade bir cevap alır, bozuk dosya kullanıcıya asla sızmaz.
 */
async function readCacheEntry(relativePath) {
  if (!isLazyFetchEnabled()) return { ok: false, reason: 'disabled' };

  const cacheDir = getLazyFetchDir('cache');
  const targetPath = resolveSafePath(cacheDir, relativePath);

  let compressed;
  try {
    compressed = await fsp.readFile(targetPath);
  } catch (error) {
    if (error.code === 'ENOENT') return { ok: false, reason: 'not_found' };
    console.error(`[LazyFetch] Okuma hatası (${relativePath}): ${error.message}`);
    return { ok: false, reason: 'read_error' };
  }

  try {
    const json = zlib.gunzipSync(compressed);
    const envelope = JSON.parse(json);
    return { ok: true, envelope };
  } catch (error) {
    // Bozuk gzip veya bozuk JSON — dosya var ama güvenilmez. Karantinaya
    // taşınır, SİLİNMEZ (teşhis kanıtı). Taşıma da başarısız olursa (ör.
    // izin sorunu) en azından okuma tarafı "yok" gibi davranmaya devam eder.
    await quarantineFile(targetPath, relativePath, error.message);
    return { ok: false, reason: 'corrupt' };
  }
}

async function quarantineFile(absolutePath, relativePath, errorMessage) {
  const quarantineDir = getLazyFetchDir('quarantine');
  if (!quarantineDir) return; // cache bu sırada devre dışı kaldıysa sessizce vazgeç

  // Orijinal iç içe klasör yapısını KORUMAYA çalışmıyoruz — teşhis için tek
  // düz dosya yeterli, hash zaten adın içinde benzersiz. Dosya adına hangi
  // anahtarın bozulduğu okunabilir kalsın diye relativePath'in son parçası
  // (hash.json.gz) + zaman damgası kullanılır.
  const safeName = relativePath.replace(/[\\/]/g, '_');
  const quarantinePath = path.join(quarantineDir, `${Date.now()}__${safeName}`);

  try {
    await fsp.rename(absolutePath, quarantinePath);
    console.error(`[LazyFetch] Bozuk kayıt karantinaya alındı: ${relativePath} (${errorMessage}) -> ${quarantinePath}`);
  } catch (moveError) {
    // Taşıma başarısız olursa en azından bozuk dosyayı silmeyi dene — aksi
    // halde her okuma denemesi aynı bozuk dosyaya tekrar tekrar çarpar.
    console.error(`[LazyFetch] Karantinaya taşınamadı (${moveError.message}), siliniyor: ${relativePath}`);
    await fsp.unlink(absolutePath).catch(() => {});
  }
}

module.exports = {
  writeCacheEntry,
  readCacheEntry,
  // Yalnızca test için dışa veriliyor.
  resolveSafePath,
};
